import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';

let server;
let url;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-vendor-'));
  server = createApp({ port: 0, publicUrl: '', dataDir, adminPassword: '' });
  const addr = await server.listen();
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('three.js add-ons are served with "three" pointing at the hub copy (one three.js for all)', async () => {
  const res = await fetch(url + '/vendor/three-addons/loaders/GLTFLoader.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  const src = await res.text();
  assert.match(src, /from '\/vendor\/three\/three\.module\.min\.js'/);
  assert.doesNotMatch(src, /from 'three'/);
  assert.match(src, /from '\.\.\/utils\/BufferGeometryUtils\.js'/, 'relative imports stay');
});

test('three.js add-ons: only .js files inside the add-ons folder', async () => {
  for (const bad of ['/vendor/three-addons/../../package.json', '/vendor/three-addons/%2e%2e/%2e%2e/package.json', '/vendor/three-addons/loaders/nope.js', '/vendor/three-addons/libs/draco/README.md']) {
    const res = await fetch(url + bad);
    assert.equal(res.status, 404, bad);
  }
});

test('the Party Board tile model is served', async () => {
  const res = await fetch(url + '/games/party-board/models/tile.glb');
  assert.equal(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString(), 'glTF');
});
