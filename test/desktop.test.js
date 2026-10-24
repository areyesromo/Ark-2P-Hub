import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { findPort, startHub, isOwnUrl } from '../desktop/hub.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-desktop-'));

/** Hold a port busy until release() is called. */
function occupy(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(port, () => resolve({ release: () => new Promise((r) => s.close(r)) }));
  });
}

test('desktop: findPort gives the first free port from the one asked for', async () => {
  const free = await findPort(41730);
  assert.equal(free, 41730);
  const busy = await occupy(41730);
  try {
    assert.equal(await findPort(41730), 41731, 'skips a busy port');
  } finally {
    await busy.release();
  }
});

test('desktop: the hub starts on the next free port, keeps its data in the given folder, and closes cleanly', async () => {
  const dataDir = tmp();
  const busy = await occupy(41740);
  let hub;
  try {
    hub = await startHub({ dataDir, port: 41740, commit: 'app-test' });
    assert.equal(hub.port, 41741, 'port 41740 was taken');
    assert.equal(hub.url, 'http://localhost:41741');
    const health = await fetch(hub.url + '/healthz');
    assert.equal(health.status, 200);
    const host = await fetch(hub.url + '/host/');
    assert.match(await host.text(), /<html/i);
    const version = await (await fetch(hub.url + '/version')).json();
    assert.equal(version.commit, 'app-test');
    // What's new: CHANGELOG.md's notes after the version the TV last ran, up to this one.
    const news = await (await fetch(hub.url + '/whats-new.json?since=0.0.1')).json();
    assert.equal(news.version, version.version);
    assert.ok(news.entries.length > 0 && news.entries.every((e) => e.items.length), 'notes up to this version');
    assert.deepEqual((await (await fetch(hub.url + '/whats-new.json?since=' + version.version)).json()).entries, [], 'nothing new');
    assert.equal((await fetch(hub.url + '/whats-new.json?since=<script>')).status, 200, 'a bad since is ignored');
    assert.ok(fs.existsSync(path.join(dataDir, 'tls-cert.pem')), 'its https certificate lives in the data folder');
  } finally {
    if (hub) await hub.close();
    await busy.release();
  }
  assert.equal(await findPort(41741), 41741, 'the port is free again');
});

test('desktop: the server fails cleanly when its port is taken (no hang)', async () => {
  const busy = await occupy(41750);
  try {
    const { createApp } = await import('../server/app.js'); // (loaded late: startHub sets its version first)
    const server = createApp({ port: 41750, dataDir: tmp() });
    await assert.rejects(server.listen(), /EADDRINUSE/);
  } finally {
    await busy.release();
  }
});

test('desktop: if the port is grabbed just after it was found free, the hub moves on to the next', async () => {
  const dataDir = tmp();
  let grabbed = null;
  // Grab the port the moment it has been found free (as another program might).
  const hub = await startHub({ dataDir, port: 41760, commit: 'app-test', onPortFound: async (p) => { if (!grabbed) grabbed = await occupy(p); } });
  try {
    assert.equal(hub.port, 41761);
    assert.equal((await fetch(hub.url + '/healthz')).status, 200);
  } finally {
    await hub.close();
    await grabbed.release();
  }
});

test("desktop: only the hub's own pages stay in the app window", () => {
  const base = 'http://localhost:3000';
  assert.equal(isOwnUrl('http://localhost:3000/host/', base), true);
  assert.equal(isOwnUrl('http://localhost:3000/stats/', base), true);
  assert.equal(isOwnUrl('http://localhost:3000.evil.com/', base), false);
  assert.equal(isOwnUrl('http://localhost:30001/', base), false);
  assert.equal(isOwnUrl('https://example.com/', base), false);
  assert.equal(isOwnUrl('not a url', base), false);
});
