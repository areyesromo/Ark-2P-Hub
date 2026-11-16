import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { normalizeJoinUrl, resolveJoin } from '../server/network.js';
import { Settings } from '../server/settings.js';

let server;
let url;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-admin-'));
  server = createApp({ port: 0, publicUrl: '', dataDir });
  const addr = await server.listen();
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function api(method, route, body, headers = {}) {
  const res = await fetch(url + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('normalizeJoinUrl accepts what people type', () => {
  assert.equal(normalizeJoinUrl('192.168.1.50:3000'), 'http://192.168.1.50:3000');
  assert.equal(normalizeJoinUrl(' https://ark.lan/play/?x=1 '), 'https://ark.lan');
  assert.equal(normalizeJoinUrl(''), '');
  assert.throws(() => normalizeJoinUrl('ftp://x'));
  assert.throws(() => normalizeJoinUrl('http://'));
});

test('a saved join address beats the TV origin; PUBLIC_URL beats both', () => {
  const saved = resolveJoin({ savedUrl: 'http://10.0.0.5:3000', hostOrigin: 'http://192.168.1.2:3000', port: 3000 });
  assert.deepEqual(saved, { base: 'http://10.0.0.5:3000', source: 'settings', guess: false });
  const env = resolveJoin({ publicUrl: 'http://pi:3000', savedUrl: 'http://10.0.0.5:3000', port: 3000 });
  assert.equal(env.source, 'env');
});

test('Settings has no password: changing the join address updates the TV QR live', async () => {
  const r0 = await api('GET', '/api/admin/status');
  assert.equal(r0.status, 200);
  assert.equal(r0.body.needsSetup, undefined);
  assert.equal((await api('POST', '/api/admin/login', { password: 'x' })).status, 404, 'no logging in any more');

  // A TV that opened the hub via localhost (Docker / kiosk)...
  const tv = connect(url, { transports: ['websocket'], forceNew: true });
  const created = await new Promise((resolve) => tv.emit('host:create', { origin: 'http://localhost:3000' }, resolve));
  const room = server.rooms.get(created.code);
  assert.notEqual(room.joinUrl, `http://192.168.1.50:3000/play/?room=${created.code}`);

  // ...gets a new QR code as soon as Settings saves the address.
  const newQr = new Promise((resolve) => tv.once('host:qr', resolve));
  const newState = new Promise((resolve) =>
    tv.on('room:state', (s) => s.joinUrl.startsWith('http://192.168.1.50:3000') && resolve(s)),
  );
  const r = await api('PUT', '/api/admin/settings', { joinUrl: '192.168.1.50:3000' });
  assert.deepEqual(r.body, { joinUrl: 'http://192.168.1.50:3000' });
  assert.match((await newQr).qr, /^data:image\/png;base64,/);
  const state = await newState;
  assert.equal(state.joinUrl, `http://192.168.1.50:3000/play/?room=${created.code}`);
  assert.equal(state.joinGuess, false);

  // Bad input is rejected; the setting survives a restart (new Settings on the same folder).
  assert.equal((await api('PUT', '/api/admin/settings', { joinUrl: 'ftp://nope' })).status, 400);
  assert.equal(new Settings(dataDir).joinUrl, 'http://192.168.1.50:3000');
  tv.close();
});

test('Settings changes only come from the hub\'s own pages (another website can\'t send them)', async () => {
  // A plain form post (no JSON) or a request from another site is refused, and nothing changes.
  const form = await fetch(url + '/api/admin/stats/reset', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
  assert.equal(form.status, 403);
  const plain = await fetch(url + '/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{"joinUrl":""}' });
  assert.equal(plain.status, 403);
  assert.equal((await api('PUT', '/api/admin/settings', { joinUrl: '' }, { Origin: 'http://evil.example' })).status, 403);
  assert.equal(new Settings(dataDir).joinUrl, 'http://192.168.1.50:3000');
  // Nor can another site show the page in a frame.
  const page = await fetch(url + '/admin/');
  assert.equal(page.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  // From the hub's own page (same host) it's fine.
  assert.equal((await api('PUT', '/api/admin/settings', { joinUrl: '192.168.1.50:3000' }, { Origin: url })).status, 200);
});

test('an old password in the settings file is dropped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-old-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ passwordHash: 'scrypt$aa$bb', joinUrl: 'http://10.0.0.2:3000' }));
  const s = new Settings(dir);
  s.setTheme('neon');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
  assert.deepEqual(saved, { joinUrl: 'http://10.0.0.2:3000', theme: 'neon' });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('trophies: everyone\'s count, one player\'s whole set (locked ones too), and a reset from Settings', async () => {
  let r = await api('GET', '/api/trophies');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.players, []);
  assert.ok(r.body.total >= 20);
  r = await api('GET', '/api/trophies/' + encodeURIComponent('Ana'));
  assert.equal(r.body.count, 0);
  assert.equal(r.body.trophies.length, r.body.total);
  assert.ok(r.body.trophies.every((t) => t.how && t.at === null));
  assert.deepEqual((await api('POST', '/api/admin/trophies/reset')).body, { ok: true });
});

test('theme: picked in Settings, served as /theme.css, and every screen told when it changes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-theme-'));
  const hub = createApp({ port: 0, dataDir: dir, https: false });
  const { port } = await hub.listen();
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, route, body) => {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const css = async () => (await fetch(base + '/theme.css')).text();
  try {
    assert.match(await css(), /default theme/, 'the original look: nothing to add');
    assert.equal((await call('GET', '/api/admin/status')).body.theme, 'default');
    assert.equal((await call('PUT', '/api/admin/theme', { theme: 'disco' })).status, 400);
    // A TV in a room hears about the change straight away.
    const tv = connect(base, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve) => tv.emit('host:create', {}, resolve));
    const told = new Promise((resolve) => tv.once('hub:theme', resolve));
    for (const theme of ['neon', 'cozy']) {
      assert.deepEqual((await call('PUT', '/api/admin/theme', { theme })).body, { theme });
      assert.equal(await css(), fs.readFileSync(path.join('public', 'shared', 'themes', `${theme}.css`), 'utf8'));
    }
    assert.equal((await told).theme, 'neon');
    // Kept across a restart (the settings file), and back to the default.
    assert.equal(new Settings(dir).theme, 'cozy');
    await call('PUT', '/api/admin/theme', { theme: 'default' });
    assert.match(await css(), /default theme/);
    tv.close();
  } finally {
    await hub.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('theme from the TV: only Player 1\'s controller, and every screen hears about it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-tvtheme-'));
  const hub = createApp({ port: 0, dataDir: dir, https: false });
  const { port } = await hub.listen();
  const base = `http://127.0.0.1:${port}`;
  const emit = (s, ev, data) => new Promise((resolve) => s.emit(ev, data, resolve));
  const tv = connect(base, { transports: ['websocket'], forceNew: true });
  const phone = connect(base, { transports: ['websocket'], forceNew: true });
  try {
    const { code } = await emit(tv, 'host:create', {});
    // Player 1 on a phone: the TV can't change it (that phone has Settings).
    assert.ok((await emit(phone, 'player:join', { code, name: 'Ana' })).ok);
    assert.match((await emit(tv, 'host:theme', { theme: 'neon' })).error, /Player 1/);
    assert.match((await emit(phone, 'host:theme', { theme: 'neon' })).error, /TV/, 'not from a phone');
    phone.emit('player:leave');
    await new Promise((r) => setTimeout(r, 100));
    // Player 1 on a controller: yes.
    assert.equal((await emit(tv, 'pad:join', { name: 'Pad' })).slot, 0);
    assert.match((await emit(tv, 'host:theme', { theme: 'disco' })).error, /No such theme/);
    const told = new Promise((resolve) => phone.once('hub:theme', resolve));
    assert.deepEqual(await emit(tv, 'host:theme', { theme: 'cozy' }), { ok: true, theme: 'cozy' });
    assert.equal((await told).theme, 'cozy');
    assert.equal(new Settings(dir).theme, 'cozy');
  } finally {
    tv.close();
    phone.close();
    await hub.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
