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
  server = createApp({ port: 0, publicUrl: '', dataDir, adminPassword: '' });
  const addr = await server.listen();
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function api(method, route, body, token) {
  const res = await fetch(url + route, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
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

test('ADMIN_PASSWORD from the environment works without setup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-env-'));
  const s = new Settings(dir, { envPassword: 'hunter2' });
  assert.equal(s.hasPassword, true);
  assert.equal(s.checkPassword('hunter2'), true);
  assert.equal(s.checkPassword('nope'), false);
  assert.throws(() => s.createPassword('other'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('setup, login and changing the join address updates the TV QR live', async () => {
  // First run: setup is needed and settings are locked.
  let r = await api('GET', '/api/admin/status');
  assert.equal(r.body.needsSetup, true);
  assert.equal((await api('PUT', '/api/admin/settings', { joinUrl: 'http://1.2.3.4:3000' })).status, 401);

  // Create the password (too short is rejected), and it can't be created twice.
  assert.equal((await api('POST', '/api/admin/setup', { password: 'ab' })).status, 400);
  r = await api('POST', '/api/admin/setup', { password: 'letmein' });
  assert.ok(r.body.token);
  assert.equal((await api('POST', '/api/admin/setup', { password: 'takeover' })).status, 409);

  // Password is stored hashed, never in plain text.
  const saved = fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8');
  assert.ok(!saved.includes('letmein'));

  // Login.
  assert.equal((await api('POST', '/api/admin/login', { password: 'wrong' })).status, 401);
  const { body: login } = await api('POST', '/api/admin/login', { password: 'letmein' });
  assert.ok(login.token);

  // A TV that opened the hub via localhost (Docker / kiosk)...
  const tv = connect(url, { transports: ['websocket'], forceNew: true });
  const created = await new Promise((resolve) => tv.emit('host:create', { origin: 'http://localhost:3000' }, resolve));
  const room = server.rooms.get(created.code);
  assert.notEqual(room.joinUrl, `http://192.168.1.50:3000/play/?room=${created.code}`);

  // ...gets a new QR code as soon as the admin saves the address.
  const newQr = new Promise((resolve) => tv.once('host:qr', resolve));
  const newState = new Promise((resolve) =>
    tv.on('room:state', (s) => s.joinUrl.startsWith('http://192.168.1.50:3000') && resolve(s)),
  );
  r = await api('PUT', '/api/admin/settings', { joinUrl: '192.168.1.50:3000' }, login.token);
  assert.deepEqual(r.body, { joinUrl: 'http://192.168.1.50:3000' });
  assert.match((await newQr).qr, /^data:image\/png;base64,/);
  const state = await newState;
  assert.equal(state.joinUrl, `http://192.168.1.50:3000/play/?room=${created.code}`);
  assert.equal(state.joinGuess, false);

  // Bad input is rejected; the setting survives a restart (new Settings on the same folder).
  assert.equal((await api('PUT', '/api/admin/settings', { joinUrl: 'ftp://nope' }, login.token)).status, 400);
  assert.equal(new Settings(dataDir, { envPassword: '' }).joinUrl, 'http://192.168.1.50:3000');

  // Logout invalidates the token.
  await api('POST', '/api/admin/logout', null, login.token);
  assert.equal((await api('PUT', '/api/admin/settings', { joinUrl: '' }, login.token)).status, 401);
  tv.close();
});

test('login is rate limited after repeated wrong passwords', async () => {
  let last;
  for (let i = 0; i < 11; i++) last = await api('POST', '/api/admin/login', { password: `wrong${i}` });
  assert.equal(last.status, 429);
});
