// Kart Race 3D's racer models on the TV, without WebGL: loading each model once per page
// (models3d.js), and a kart swapping its placeholder for the model and moving its parts (karts3d.js).
// Three.js runs for real (scene graph only); the GLB loader is a fake that builds named parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

// The model's real numbers (tools/kart-models/rex.json): joints, seat, column and steering wheel.
const CFG = JSON.parse(fs.readFileSync('tools/kart-models/rex.json', 'utf8'));
const BONE_CHAINS = [['hips', 'hips', null], ['spine', 'spine', 'hips'], ['chest', 'chest', 'spine'], ['neck', 'neck', 'chest'], ['head', 'head', 'neck'],
  ...['l', 'r'].flatMap((s) => [['shoulder_' + s, 'shoulder_' + s, 'chest'], ['upper_arm_' + s, 'upper_arm_' + s, 'shoulder_' + s], ['forearm_' + s, 'elbow_' + s, 'upper_arm_' + s],
    ['hand_' + s, 'hand_' + s, 'forearm_' + s], ['thigh_' + s, 'thigh_' + s, 'hips'], ['shin_' + s, 'knee_' + s, 'thigh_' + s], ['foot_' + s, 'ankle_' + s, 'shin_' + s]]),
  ['tail_1', 'tail_1', 'hips'], ['tail_2', 'tail_2', 'tail_1'], ['tail_3', 'tail_3', 'tail_2']];

/** A joint's position in the game frame (the `_r` joints mirror the `_l` ones). */
function joint(name) {
  const j = CFG.rex.joints;
  if (j[name]) return new THREE.Vector3(...j[name]);
  const l = j[name.replace(/_r$/, '_l')];
  return new THREE.Vector3(l[0], l[1], -l[2]);
}

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
    const seat = new THREE.Object3D();
    seat.name = 'seat';
    seat.position.set(...CFG.kart.seat);
    scene.add(seat);
    // The steering wheel on its column (local +y along it), its grips on the rim, as the build makes them.
    const st = CFG.kart.steer;
    const axis = new THREE.Vector3(...CFG.kart.column.axis).normalize();
    const steer = mesh('steer', ...st.centre, new THREE.TorusGeometry(st.radius, 0.02, 4, 12));
    steer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    scene.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0);
    const twelve = up.clone().sub(axis.clone().multiplyScalar(up.dot(axis))).normalize();
    const right = new THREE.Vector3(0, 0, 1);
    right.sub(axis.clone().multiplyScalar(right.dot(axis))).sub(twelve.clone().multiplyScalar(right.dot(twelve))).normalize();
    const a = (st.gripAngle * Math.PI) / 180;
    for (const [name, side] of [['grip_l', -1], ['grip_r', 1]]) {
      const g = new THREE.Object3D();
      g.name = name;
      const world = new THREE.Vector3(...st.centre).add(twelve.clone().multiplyScalar(st.radius * Math.cos(a))).add(right.clone().multiplyScalar(side * st.radius * Math.sin(a)));
      g.position.copy(steer.worldToLocal(world));
      steer.add(g);
    }
  } else {
    // Rex: a skinned mesh on the 22 bones, at the joints the build uses.
    const bones = {};
    for (const [name, at, parent] of BONE_CHAINS) {
      const b = new THREE.Bone();
      b.name = name;
      const p = joint(at);
      if (parent) {
        b.position.copy(p.clone().sub(joint(BONE_CHAINS.find((c) => c[0] === parent)[1])));
        bones[parent].add(b);
      } else b.position.copy(p);
      bones[name] = b;
    }
    const list = BONE_CHAINS.map((c) => bones[c[0]]);
    const geo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const n = geo.attributes.position.count;
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
    const rex = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
    rex.name = 'rex';
    const rig = new THREE.Group();
    rig.name = 'rig';
    rig.add(bones.hips, rex);
    rex.bind(new THREE.Skeleton(list));
    scene.add(rig);
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
  for (const file of ['kart-race/racers.js', 'kart-race-3d/geom3d.js', 'kart-race-3d/rig3d.js', 'kart-race-3d/body3d.js', 'kart-race-3d/models3d.js', 'kart-race-3d/karts3d.js']) {
    vm.runInContext(fs.readFileSync('public/games/' + file, 'utf8'), context);
  }
  const calls = [];
  context.KRModels.cloner = async () => cloneSkinned; // (the page imports SkeletonUtils)
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

/** A part's world position. */
const at = (o) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };

test('the hands stay on the wheel through a turn', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 30);
  const o = (n) => k.obj.getObjectByName(n);
  assert.ok(o('steer').quaternion.angleTo(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...CFG.kart.column.axis).normalize())) > 0.05, 'the wheel turned');
  // On the rim: as far from the wheel's centre as its grips, in the wheel's plane (a hand slides
  // round the rim when the turn carries its grip out of reach).
  for (const s of ['l', 'r']) {
    const h = o('steer').worldToLocal(at(o('hand_' + s)));
    const g = o('grip_' + s).position;
    const off = Math.abs(Math.hypot(h.x, h.z) - Math.hypot(g.x, g.z)) + Math.abs(h.y - g.y);
    assert.ok(off < 0.02, `hand_${s} is ${off.toFixed(3)} off the rim`);
  }
});

test('a throw lets go with the right hand only', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 15, { da: 0, kart: { used: 'bomb' } });
  const o = (n) => k.obj.getObjectByName(n);
  assert.ok(at(o('hand_r')).distanceTo(at(o('grip_r'))) > 0.05, 'the right hand is off the wheel');
  assert.ok(at(o('hand_l')).distanceTo(at(o('grip_l'))) < 0.02, 'the left stays on');
});

test('spinning out puts both hands up', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 1, { da: 0 });
  const head = at(k.obj.getObjectByName('head')).y;
  drive(k, 20, { da: 0, kart: { spin: true } });
  for (const s of ['l', 'r']) assert.ok(at(k.obj.getObjectByName('hand_' + s)).y > head - 0.05, 'hand_' + s);
});

test('winning lifts the left fist off the wheel', async () => {
  const { k, ready } = kart();
  await ready();
  drive(k, 20, { da: 0, kart: { finished: true }, place: 1 });
  const o = (n) => k.obj.getObjectByName(n);
  assert.ok(at(o('hand_l')).distanceTo(at(o('grip_l'))) > 0.05);
  assert.ok(at(o('hand_r')).distanceTo(at(o('grip_r'))) < 0.02);
});

test('two Rexes move on their own', async () => {
  const { win, ready } = kart();
  await ready();
  const a = win.KRKarts.make(THREE, 'rex', '#ff0000', null, true);
  const b = win.KRKarts.make(THREE, 'rex', '#00ff00', null, false);
  await flush();
  drive(a, 20, { da: 0, kart: { spin: true } });
  drive(b, 20, { da: 0 });
  const local = (kk) => kk.obj.worldToLocal(at(kk.obj.getObjectByName('hand_r')));
  assert.ok(local(a).distanceTo(local(b)) > 0.05);
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

/** How far (radians) the chest bone turned between two frames. */
function chestStep(k, frame) {
  const chest = k.obj.getObjectByName('chest');
  const before = chest.quaternion.clone();
  frame();
  return before.angleTo(chest.quaternion);
}

test("a boost starting doesn't snap the driver's body", async () => {
  const { k, ready } = kart();
  await ready();
  let pose = { x: 0, y: 0, angle: 0 };
  let t = 1000;
  const step = (view) => { pose = { x: pose.x + 0.14, y: 0, angle: 0 }; t += 16; k.set(pose, view, t, 2); };
  for (let i = 0; i < 30; i++) step({});
  const jump = chestStep(k, () => step({ boosting: true }));
  assert.ok(jump < 0.03, `the chest turned ${jump.toFixed(3)} rad in one frame`);
});

test('a new race (a jump across the field) moves the driver smoothly', async () => {
  const { k, ready } = kart();
  await ready();
  let t = 1000;
  for (let i = 0; i < 30; i++) { t += 16; k.set({ x: i * 0.14, y: 0, angle: 0 }, {}, t, 2); }
  const jump = chestStep(k, () => { t += 16; k.set({ x: 60, y: 40, angle: 2 }, {}, t, 2); });
  const after = chestStep(k, () => { t += 16; k.set({ x: 60.14, y: 40, angle: 2 }, {}, t, 2); });
  assert.ok(jump < 0.03 && after < 0.03, `${jump.toFixed(3)} then ${after.toFixed(3)} rad`);
});

test("disposing a Rex frees his own bones' texture", async () => {
  const { win, ready } = kart();
  await ready();
  const a = win.KRKarts.make(THREE, 'rex', '#ff0000', null, true);
  await flush();
  let freed = 0;
  a.obj.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose = () => freed++; });
  a.dispose();
  assert.equal(freed, 1);
});
