// Online play: the quick tunnel, the rooms that invite someone online, and Settings over the internet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Tunnel, START_MS } from '../server/tunnel.js';
import { Online, overInternet } from '../server/online.js';
import { Settings } from '../server/settings.js';
import { RoomManager } from '../server/rooms.js';

const io = { to: () => ({ emit() {} }) };

/** A stand-in for the cloudflared program: says what it would, when told to. */
function fakeCloudflared() {
  const runs = [];
  const spawn = (bin, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; child.emit('exit', 0); };
    runs.push({ bin, args, child });
    return child;
  };
  return { spawn, runs, last: () => runs[runs.length - 1] };
}

function timers() {
  const list = [];
  return { list, setTimer: (fn, ms) => { const t = { fn, ms }; list.push(t); return t; }, clearTimer: (t) => { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); } };
}

test('the quick tunnel: starts cloudflared for this port, reads the address it prints, stops it', () => {
  const cf = fakeCloudflared();
  const seen = [];
  const t = new Tunnel({ port: 3000, bin: 'cloudflared', spawn: cf.spawn, onChange: (s) => seen.push(s.status), ...timers() });
  t.start();
  assert.deepEqual(cf.last().args, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:3000']);
  assert.equal(t.state.status, 'starting');
  t.start(); // (already going: not a second one)
  assert.equal(cf.runs.length, 1);
  cf.last().child.stderr.emit('data', 'INF |  https://brave-otter-sky.trycloudflare.com                  |\n');
  assert.deepEqual(t.state, { status: 'on', url: 'https://brave-otter-sky.trycloudflare.com', error: null });
  t.stop();
  assert.ok(cf.last().child.killed);
  assert.equal(t.state.status, 'off');
  assert.deepEqual(seen, ['starting', 'on', 'off']);
});

test('the quick tunnel: not installed, quits early, or no address in time: an error that says so', () => {
  const missing = new Tunnel({ port: 3000, spawn: () => { const c = new EventEmitter(); setImmediate(() => c.emit('error', Object.assign(new Error('spawn cloudflared ENOENT'), { code: 'ENOENT' }))); return c; }, ...timers() });
  missing.start();
  return new Promise((done) => setImmediate(() => {
    assert.equal(missing.state.status, 'error');
    assert.match(missing.state.error, /isn't installed/);
    const cf = fakeCloudflared();
    const quits = new Tunnel({ port: 3000, spawn: cf.spawn, ...timers() });
    quits.start();
    cf.last().child.emit('exit', 1);
    assert.equal(quits.state.status, 'error');
    const tm = timers();
    const slow = new Tunnel({ port: 3000, spawn: fakeCloudflared().spawn, ...tm });
    slow.start();
    assert.equal(tm.list[0].ms, START_MS);
    tm.list[0].fn();
    assert.equal(slow.state.status, 'error');
    assert.match(slow.state.error, /30 seconds/);
    done();
  }));
});

function setup({ own = '' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-online-'));
  const settings = new Settings(dir, { envPassword: '' });
  if (own) settings.setOnline({ tunnelUrl: own });
  const cf = fakeCloudflared();
  const rooms = new RoomManager(io, {});
  let online;
  const tunnel = new Tunnel({ port: 3000, spawn: cf.spawn, onChange: () => online && online.refresh(), ...timers() });
  online = new Online({ settings, tunnel, rooms, qr: async (url) => 'qr:' + url });
  return { settings, cf, rooms, tunnel, online, dir };
}

test('a room invites someone online: the tunnel starts, its address and QR reach the room, and it stops with the last invite', async () => {
  const { cf, rooms, tunnel, online, dir } = setup();
  const a = rooms.create();
  const b = rooms.create();
  assert.deepEqual(await online.invite(a, true), { ok: true });
  assert.equal(a.publicState().online.status, 'starting');
  cf.last().child.stderr.emit('data', 'https://quiet-fox.trycloudflare.com');
  await online.refresh();
  const info = a.publicState().online;
  assert.equal(info.url, 'https://quiet-fox.trycloudflare.com/play/?room=' + a.code + '&k=' + a.onlineKey);
  assert.equal(info.watchUrl, 'https://quiet-fox.trycloudflare.com/host/?watch=' + a.code + '&k=' + a.onlineKey);
  assert.equal(info.qr, 'qr:' + info.url);
  assert.equal(b.publicState().online, null, 'only the room that invited');
  assert.equal(a.publicState().onlineAllowed, true);
  await online.invite(b, true);
  assert.equal(cf.runs.length, 1, 'one tunnel for every room');
  await online.invite(a, false);
  assert.equal(tunnel.state.status, 'on', 'b is still online');
  await online.invite(b, false);
  assert.equal(tunnel.state.status, 'off');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('your own tunnel address from Settings is used instead (no quick tunnel); turned off, there\'s no inviting', async () => {
  const { settings, cf, rooms, online, dir } = setup({ own: 'https://ark.example.com' });
  const a = rooms.create();
  await online.invite(a, true);
  assert.equal(cf.runs.length, 0);
  assert.equal(a.publicState().online.url, 'https://ark.example.com/play/?room=' + a.code + '&k=' + a.onlineKey);
  assert.equal(online.status().status, 'on');
  settings.setOnline({ allowed: false });
  assert.match((await online.invite(rooms.create(), true)).error, /turned off/);
  await online.stopAll();
  assert.equal(a.publicState().online, null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('over the internet: a tunnel\'s request is told apart (Cloudflare\'s header, or your own address)', () => {
  assert.equal(overInternet({ 'cf-connecting-ip': '1.2.3.4', host: 'x.trycloudflare.com' }), true);
  assert.equal(overInternet({ host: '192.168.1.5:3000' }), false);
  assert.equal(overInternet({ host: 'ark.example.com' }, 'https://ark.example.com'), true);
  assert.equal(overInternet({ host: 'ARK.example.com' }, 'https://ark.example.com'), true);
  assert.equal(overInternet({ host: 'localhost:3000' }, 'https://ark.example.com'), false);
});

// ---- through the real server ----
import { io as connect } from 'socket.io-client';
const connectIo = connect;
import { createApp } from '../server/app.js';

async function server() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-online-app-'));
  const app = createApp({ port: 0, publicUrl: '', dataDir: dir, adminPassword: 'pw', https: false });
  const addr = await app.listen();
  const url = `http://127.0.0.1:${addr.port}`;
  return { app, url, dir, close: async () => { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const emit = (s, ev, data) => new Promise((r) => s.emit(ev, data, r));
const tunnelHeaders = { 'cf-connecting-ip': '203.0.113.9' };

test('over the internet: Settings is refused, the TV page only opens as a remote screen, and no rooms are made from outside', async () => {
  const s = await server();
  try {
    assert.equal((await fetch(s.url + '/admin/', { headers: tunnelHeaders })).status, 403);
    assert.equal((await fetch(s.url + '/api/admin/status', { headers: tunnelHeaders })).status, 403);
    assert.equal((await fetch(s.url + '/admin/')).status, 200, 'at home it opens');
    const tv = await fetch(s.url + '/host/', { headers: tunnelHeaders, redirect: 'manual' });
    assert.equal(tv.status, 302);
    assert.equal((await fetch(s.url + '/host/?watch=ABCD', { headers: tunnelHeaders })).status, 200);
    assert.equal((await fetch(s.url + '/play/', { headers: tunnelHeaders })).status, 200);
    const outside = connect(s.url, { extraHeaders: tunnelHeaders, transports: ['websocket'] });
    const res = await emit(outside, 'host:create', { origin: 'https://x.trycloudflare.com' });
    assert.match(res.error, /internet/);
    outside.close();
  } finally {
    await s.close();
  }
});

test('the remote screen: it sees the room like the TV, but can\'t start a game, seat the computer or invite anyone', async () => {
  const s = await server();
  try {
    const tv = connect(s.url, { transports: ['websocket'] });
    const room = await emit(tv, 'host:create', { origin: s.url });
    const watcher = connect(s.url, { transports: ['websocket'] });
    const states = [];
    watcher.on('room:state', (st) => states.push(st));
    assert.equal((await emit(watcher, 'watch:join', { code: 'ZZZZ' })).error, 'No room with that code.');
    assert.deepEqual(await emit(watcher, 'watch:join', { code: room.code }), { ok: true, code: room.code });
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(states.length && states[states.length - 1].code === room.code, 'it gets the room');
    assert.match((await emit(watcher, 'lobby:start', { gameId: 'pong' })).error, /remote screen/);
    assert.match((await emit(watcher, 'bot:join', { level: 'easy' })).error, /remote screen/);
    assert.match((await emit(watcher, 'host:online', { on: true })).error, /TV/);
    tv.close();
    watcher.close();
  } finally {
    await s.close();
  }
});

test('Settings: online play on or off, your own https address (checked), and stopping everything', async () => {
  const s = await server();
  try {
    const call = async (method, route, body, token) => {
      const res = await fetch(s.url + route, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, body: await res.json() };
    };
    assert.equal((await call('GET', '/api/admin/online')).status, 401);
    const { body: login } = await call('POST', '/api/admin/login', { password: 'pw' });
    const tok = login.token;
    let r = await call('GET', '/api/admin/online', null, tok);
    assert.equal(r.body.allowed, true);
    assert.equal(r.body.status, 'off');
    assert.equal((await call('PUT', '/api/admin/online', { tunnelUrl: 'http://plain.example.com' }, tok)).status, 400);
    r = await call('PUT', '/api/admin/online', { tunnelUrl: 'https://ark.example.com/play/' }, tok);
    assert.equal(r.body.ownUrl, 'https://ark.example.com');
    assert.equal(r.body.status, 'on');
    r = await call('PUT', '/api/admin/online', { allowed: false, tunnelUrl: '' }, tok);
    assert.equal(r.body.allowed, false);
    assert.equal(r.body.ownUrl, '');
    assert.equal((await call('POST', '/api/admin/online/stop', null, tok)).body.status, 'off');
  } finally {
    await s.close();
  }
});

// ---- from review: the internet gets only what it was invited to ----

test('over the internet, Settings stays shut whatever the spelling (case, double slashes, %-encoding)', async () => {
  const s = await server();
  try {
    for (const p of ['/API/admin/status', '/api/Admin/status', '/Api/Admin/online', '//admin/', '/%61dmin/', '/ADMIN/', '/Admin/index.html']) {
      assert.equal((await fetch(s.url + p, { headers: tunnelHeaders })).status, 403, p);
    }
    const setup = await fetch(s.url + '/API/ADMIN/setup', { method: 'POST', headers: { ...tunnelHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'takeover' }) });
    assert.equal(setup.status, 403, 'no taking over a hub without a password');
  } finally {
    await s.close();
  }
});

test('over the internet, only the room that invited someone can be joined or watched, with its invite key; tries are limited', async () => {
  const s = await server();
  const open = [];
  const connect = (...args) => { const c = connectIo(...args); open.push(c); return c; };
  try {
    const tv = connect(s.url, { transports: ['websocket'] });
    const a = await emit(tv, 'host:create', { origin: s.url });
    const tv2 = connect(s.url, { transports: ['websocket'] });
    const b = await emit(tv2, 'host:create', { origin: s.url });
    const roomA = s.app.rooms.get(a.code);
    await s.app.online.invite(roomA, true); // (no cloudflared here: the invite still makes its key)
    const key = roomA.onlineKey;
    assert.match(key, /^[0-9a-f]{16}$/);
    const outside = () => connect(s.url, { extraHeaders: tunnelHeaders, transports: ['websocket'] });
    const o = outside();
    assert.match((await emit(o, 'player:join', { code: b.code, name: 'Eve' })).error, /invite/, 'a room that didn\'t invite anyone');
    assert.match((await emit(o, 'watch:join', { code: b.code })).error, /invite/);
    assert.match((await emit(o, 'player:join', { code: a.code, name: 'Eve', key: 'wrong' })).error, /invite/, 'the right room, the wrong key');
    assert.ok((await emit(o, 'watch:join', { code: a.code, key })).ok);
    assert.ok((await emit(outside(), 'player:join', { code: a.code, name: 'Bob', key })).ok);
    // At home, no key is needed.
    assert.ok((await emit(connect(s.url, { transports: ['websocket'] }), 'player:join', { code: b.code, name: 'Ana' })).ok);
    // Guessing: after a run of wrong tries from one address, it's refused for a while.
    const g = outside();
    for (let i = 0; i < 25; i++) await emit(g, 'watch:join', { code: 'QQQQ', key: 'x' });
    assert.match((await emit(g, 'watch:join', { code: a.code, key })).error, /Too many/);
    // Online play turned off in Settings: nobody gets in from outside, even with the key.
    s.app.online.settings.setOnline({ allowed: false });
    const elsewhere = connect(s.url, { extraHeaders: { 'cf-connecting-ip': '198.51.100.7' }, transports: ['websocket'] }); // (not the one that guessed)
    assert.match((await emit(elsewhere, 'watch:join', { code: a.code, key })).error, /turned off/);
  } finally {
    open.forEach((c) => c.close());
    await s.close();
  }
});

test('the tunnel: cloudflared\'s own error (api.trycloudflare.com) isn\'t taken for the address', () => {
  const cf = fakeCloudflared();
  const t = new Tunnel({ port: 3000, spawn: cf.spawn, ...timers() });
  t.start();
  cf.last().child.stderr.emit('data', 'ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp: lookup api.trycloudflare.com: no such host\n');
  assert.equal(t.state.status, 'starting');
  cf.last().child.emit('exit', 1);
  assert.equal(t.state.status, 'error');
});

test('the tunnel comes back if it drops while a room is online; your own address set stops the quick one; cleared, a quick one starts', async () => {
  const { settings, cf, rooms, tunnel, online, dir } = setup();
  const a = rooms.create();
  await online.invite(a, true);
  cf.last().child.stderr.emit('data', 'https://one-two.trycloudflare.com');
  await online.refresh();
  cf.last().child.emit('exit', 0); // (dropped)
  await new Promise((r) => setImmediate(r));
  assert.equal(cf.runs.length, 2, 'started again');
  assert.equal(tunnel.state.status, 'starting');
  settings.setOnline({ tunnelUrl: 'https://ark.example.com' });
  await online.refresh();
  assert.equal(tunnel.state.status, 'off', 'the quick tunnel goes');
  assert.equal(a.publicState().online.url, 'https://ark.example.com/play/?room=' + a.code + '&k=' + a.onlineKey);
  settings.setOnline({ tunnelUrl: '' });
  await online.refresh();
  assert.equal(cf.runs.length, 3, 'a quick one again');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('your own tunnel through a proxy that rewrites Host: its forwarding headers still mark it as from outside', () => {
  assert.equal(overInternet({ host: '127.0.0.1:3000', 'x-forwarded-for': '203.0.113.9' }, 'https://ark.example.com'), true);
  assert.equal(overInternet({ host: '127.0.0.1:3000', forwarded: 'for=203.0.113.9' }, 'https://ark.example.com'), true);
  assert.equal(overInternet({ host: '192.168.1.5:3000' }, 'https://ark.example.com'), false);
});
