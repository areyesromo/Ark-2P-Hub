import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { findPort, startHub } from '../desktop/hub.js';

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
    assert.ok(fs.existsSync(path.join(dataDir, 'tls-cert.pem')), 'its https certificate lives in the data folder');
  } finally {
    if (hub) await hub.close();
    await busy.release();
  }
  assert.equal(await findPort(41741), 41741, 'the port is free again');
});
