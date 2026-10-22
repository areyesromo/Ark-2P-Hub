import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { makeSelfSigned, loadOrCreateCert } from '../server/tls.js';

test('the self-signed certificate is valid X.509 for the names given, signed by its own key', () => {
  const { key, cert } = makeSelfSigned({ names: ['localhost', '192.168.1.50'], now: new Date('2026-01-01T00:00:00Z') });
  const x = new crypto.X509Certificate(cert);
  assert.equal(x.subject, 'CN=Ark 2P Hub');
  assert.equal(x.subjectAltName, 'DNS:localhost, IP Address:192.168.1.50');
  assert.ok(x.verify(x.publicKey));
  assert.ok(x.checkPrivateKey(crypto.createPrivateKey(key)));
  assert.equal(x.ca, false);
  assert.ok(new Date(x.validTo) > new Date('2035-12-01'), 'good for ten years');
});

test('the certificate is made once and kept in the data folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-tls-'));
  const a = loadOrCreateCert(dir, ['localhost']);
  const b = loadOrCreateCert(dir, ['localhost']);
  assert.equal(a.cert, b.cert);
  assert.ok(fs.existsSync(path.join(dir, 'tls-key.pem')));
  fs.rmSync(dir, { recursive: true, force: true });
});

/** GET over http, or over https trusting the hub's own certificate (`ca`). */
const get = (url, ca) =>
  new Promise((resolve, reject) => {
    if (!url.startsWith('https:')) return fetch(url).then((r) => r.text().then((body) => resolve({ status: r.status, body })), reject);
    const req = https.get(url, { ca, agent: false }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, secure: res.socket.encrypted === true }));
    });
    req.on('error', reject);
  });

test('one port serves both http and https, and phones on either reach the same rooms', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-dual-'));
  const server = createApp({ port: 0, publicUrl: 'http://tv.local:3000', dataDir: dir });
  const { port } = await server.listen();
  try {
    const plain = await get(`http://127.0.0.1:${port}/healthz`);
    assert.equal(plain.status, 200);
    const ca = fs.readFileSync(path.join(dir, 'tls-cert.pem'), 'utf8');
    const secure = await get(`https://127.0.0.1:${port}/healthz`, ca);
    assert.equal(secure.status, 200);
    assert.equal(secure.secure, true);
    assert.equal(JSON.parse(secure.body).ok, true);

    // The TV on http, a phone on https: same room.
    const tv = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
    const phone = connect(`https://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true, ca });
    const call = (s, ev, data) => new Promise((resolve) => s.emit(ev, data, resolve));
    const { code } = await call(tv, 'host:create', {});
    const joined = await call(phone, 'player:join', { code, name: 'Ana' });
    assert.equal(joined.ok, true);
    assert.equal(server.rooms.get(code).players[0].name, 'Ana');
    tv.close();
    phone.close();
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('HTTPS=off (https: false) serves plain http only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-plain-'));
  const server = createApp({ port: 0, publicUrl: '', dataDir: dir, https: false });
  const { port } = await server.listen();
  try {
    assert.equal((await get(`http://127.0.0.1:${port}/healthz`)).status, 200);
    await assert.rejects(get(`https://127.0.0.1:${port}/healthz`, makeSelfSigned().cert));
    assert.ok(!fs.existsSync(path.join(dir, 'tls-cert.pem')), 'no certificate made');
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every certificate made is well formed (the random serial never starts with a padding zero)', () => {
  // A serial whose first byte came out 0 broke about 1 certificate in 400; this many would show it.
  for (let i = 0; i < 1500; i++) new crypto.X509Certificate(makeSelfSigned().cert);
});
