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
