// Kart Race 3D's racer models on the TV, without WebGL: loading each model once per page
// (models3d.js), and a kart swapping its placeholder for the model and moving its parts (karts3d.js).
// Three.js runs for real (scene graph only); the GLB loader is a fake that builds named parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A fake GLB, as GLTFLoader resolves it: { scene } with the parts the build names. */
function fakeGltf(url) {
  const scene = new THREE.Group();
  const mesh = (name, x, y, z, geo = new THREE.BoxGeometry(0.1, 0.1, 0.1)) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    m.name = name;
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  if (url.endsWith('rex-kart.glb')) {
    mesh('body', 0, 0.3, 0);
    for (const [id, x, z] of [['fl', 0.35, -0.45], ['fr', 0.35, 0.45], ['rl', -0.55, -0.45], ['rr', -0.55, 0.45]]) {
      mesh('wheel_' + id, x, 0.2, z, new THREE.CylinderGeometry(0.2, 0.2, 0.1).rotateX(Math.PI / 2));
    }
    for (const [name, x, y] of [['seat', -0.25, 0.32], ['column', 0.17, 0.6]]) {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(x, y, 0);
      scene.add(o);
    }
  } else {
    mesh('torso', 0, 0.2, 0);
    mesh('head', 0.06, 0.39, 0);
    mesh('arm_l', 0.09, 0.32, -0.2);
    mesh('arm_r', 0.09, 0.32, 0.2);
  }
  return { scene };
}

/** A vm page with the racers, the 3D maths, the model loader and the karts; `loader` fakes GLTFLoader. */
function page(loader = async (url) => fakeGltf(url)) {
  const errors = [];
  const context = vm.createContext({
    console: { error: (...a) => errors.push(a), log() {}, warn() {} },
    performance: { now: () => 0 },
    document: {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ beginPath() {}, roundRect() {}, fill() {}, fillText() {} }) }),
    },
  });
  context.window = context;
  for (const file of ['kart-race/racers.js', 'kart-race-3d/geom3d.js', 'kart-race-3d/rig3d.js', 'kart-race-3d/models3d.js', 'kart-race-3d/karts3d.js']) {
    vm.runInContext(fs.readFileSync('public/games/' + file, 'utf8'), context);
  }
  const calls = [];
  context.KRModels.loader = (url) => {
    calls.push(url);
    return loader(url);
  };
  return { win: context, errors, calls };
}

test('get returns null for a racer without a model', () => {
  const { win } = page();
  assert.equal(win.KRModels.get(THREE, 'not-rex'), null);
  assert.equal(win.KRModels.has('rex'), true);
});

test('get loads each file once per page', async () => {
  const { win, calls } = page();
  const a = win.KRModels.get(THREE, 'rex');
  const b = win.KRModels.get(THREE, 'rex');
  assert.equal(a, b);
  await a;
  assert.deepEqual(calls.sort(), ['/games/kart-race-3d/models/rex-kart.glb', '/games/kart-race-3d/models/rex.glb']);
});

test('wheelRadius comes from the wheel', async () => {
  const { win } = page();
  const m = await win.KRModels.get(THREE, 'rex');
  assert.ok(Math.abs(m.wheelRadius - 0.2) < 1e-6, String(m.wheelRadius));
  assert.ok(m.kart.getObjectByName('wheel_fl'));
  assert.ok(m.driver.getObjectByName('head'));
});

test('a failed load rejects and logs once', async () => {
  const { win, errors } = page(async () => { throw new Error('404'); });
  await assert.rejects(win.KRModels.get(THREE, 'rex'));
  await assert.rejects(win.KRModels.get(THREE, 'rex'));
  assert.equal(errors.length, 1);
});

/** A kart on a page, and a promise that settles once its model has had the chance to arrive. */
function kart(opts = {}) {
  const p = page(opts.loader);
  const k = p.win.KRKarts.make(THREE, opts.racer || 'rex', opts.color || '#ff0000', null, Boolean(opts.player));
  const ready = async () => {
    try { await p.win.KRModels.get(THREE, 'rex'); } catch { /* a failed load */ }
    await flush();
  };
  return { ...p, k, ready };
}

/** Drive `n` frames 16 ms apart: forward by dx a frame, turning by da a frame. */
function drive(k, n, { dx = 0.1, da = 0.02, kart: view = {}, place } = {}) {
  let pose = { x: 0, y: 0, angle: 0 };
  for (let i = 0; i < n; i++) {
    pose = { x: pose.x + dx * Math.cos(pose.angle), y: pose.y + dx * Math.sin(pose.angle), angle: pose.angle + da };
    k.set(pose, view, 1000 + i * 16, place);
  }
}

test('a kart shows the placeholder until the model loads', async () => {
  const { k, ready } = kart();
  assert.ok(k.obj.getObjectByName('placeholder'));
  assert.equal(k.obj.getObjectByName('wheel_fl'), undefined);
  await ready();
  assert.ok(k.obj.getObjectByName('wheel_fl'));
  assert.ok(k.obj.getObjectByName('head'));
  assert.equal(k.obj.getObjectByName('placeholder'), undefined);
});

test('a racer without a model keeps the placeholder', async () => {
  const { k, ready } = kart({ racer: 'dash' });
  await ready();
  assert.ok(k.obj.getObjectByName('placeholder'));
});

test('a failed load keeps the placeholder', async () => {
  const { k, ready } = kart({ loader: async () => { throw new Error('404'); } });
  await ready();
  assert.equal(k.obj.getObjectByName('wheel_fl'), undefined);
  assert.ok(k.obj.getObjectByName('placeholder'));
});

test('a kart disposed before its model loads never swaps', async () => {
  const { k, ready } = kart();
  k.dispose();
  await ready();
  assert.equal(k.obj.getObjectByName('wheel_fl'), undefined);
});

test('turning right steers the front wheels right; every wheel rolls forward', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 20);
  const o = (n) => k.obj.getObjectByName(n);
  assert.ok(o('wheel_fl').rotation.y < 0, String(o('wheel_fl').rotation.y));
  assert.ok(o('wheel_fr').rotation.y < 0);
  assert.equal(o('wheel_rr').rotation.y, 0);
  assert.ok(o('wheel_rr').rotation.z < 0, String(o('wheel_rr').rotation.z));
  assert.ok(o('wheel_fl').rotation.z < 0);
});

test('reversing rolls the wheels backwards', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 10, { dx: -0.1, da: 0 });
  assert.ok(k.obj.getObjectByName('wheel_rl').rotation.z > 0);
});

test('the head looks into the bend and the hands follow the wheel', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 20);
  const o = (n) => k.obj.getObjectByName(n);
  assert.ok(o('head').rotation.y < 0, String(o('head').rotation.y));
  assert.ok(o('arm_l').rotation.z > 0, 'left hand up when turning right');
  assert.ok(o('arm_r').rotation.z < 0, 'right hand down');
});

test('spinning out puts both arms up', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 1, { kart: { spin: true } });
  assert.ok(Math.abs(k.obj.getObjectByName('arm_l').rotation.z - 2.2) < 1e-9);
  assert.ok(Math.abs(k.obj.getObjectByName('arm_r').rotation.z - 2.2) < 1e-9);
});

test('winning pumps the left fist', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 1, { da: 0, kart: { finished: true }, place: 1 });
  assert.ok(k.obj.getObjectByName('arm_l').rotation.z >= 1.6);
  assert.equal(k.obj.getObjectByName('arm_r').rotation.z, 0);
});

test('disposing a kart keeps the model the other karts share', async () => {
  const { win, ready } = kart();
  await ready();
  const model = await win.KRModels.get(THREE, 'rex');
  let freed = 0;
  for (const root of [model.kart, model.driver]) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose = () => freed++;
        o.material.dispose = () => freed++;
      }
    });
  }
  const a = win.KRKarts.make(THREE, 'rex', '#ff0000', null, true);
  const b = win.KRKarts.make(THREE, 'rex', '#00ff00', null, false);
  await flush();
  a.dispose();
  assert.equal(freed, 0);
  assert.ok(b.obj.getObjectByName('wheel_fl'));
});

test("a player's kart gets a ring in its colour; a computer's doesn't", async () => {
  const ring = (k) => {
    let found = null;
    k.obj.traverse((o) => { if (o.isMesh && o.geometry.type === 'RingGeometry') found = o; });
    return found;
  };
  const p = kart({ player: true });
  await p.ready();
  assert.equal(ring(p.k).material.color.getHex(), 0xff0000);
  const c = kart({ player: false });
  await c.ready();
  assert.equal(ring(c.k), null);
});
