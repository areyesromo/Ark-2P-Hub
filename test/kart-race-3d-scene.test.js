// Kart Race 3D's scene (public/games/kart-race-3d/kart3d.js) without WebGL: a fake renderer, world and
// karts, to check what each frame asks of the karts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

/** A scene with fake parts; returns it, the frame callback and every set() call each kart got. */
async function scene() {
  let frame = null;
  let draw = null;
  const overview = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
  let clock = 1000;
  const sets = [];
  const context = vm.createContext({
    performance: { now: () => clock },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    document: { documentElement: {} },
  });
  context.window = context;
  vm.runInContext(fs.readFileSync('public/games/kart-race/racers.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('public/games/kart-race-3d/geom3d.js', 'utf8'), context);
  context.ArkMini = {
    scene3d: async (el, opts) => (draw = opts.draw, { THREE, scene: new THREE.Scene(), camera: overview, onFrame: (fn) => { frame = fn; }, dispose() {} }),
  };
  context.KRThings = { make: () => ({ group: new THREE.Group(), update() {}, dispose() {} }) };
  context.KRWorld = { build: () => ({ group: new THREE.Group(), segments: [], dispose() {} }) };
  context.KRKarts = {
    make: (T, racer) => {
      const slot = sets.length;
      sets.push([]);
      return { obj: new THREE.Group(), racer, marker: null, set: (pose, k, now, place) => sets[slot].push({ k, place }), dispose() {} };
    },
  };
  vm.runInContext(fs.readFileSync('public/games/kart-race-3d/kart3d.js', 'utf8'), context);
  const s = await context.KR3D.create({ classList: { toggle() {} } });
  /** The two halves' cameras, as the next draw renders them. */
  const cameras = () => {
    const out = [];
    draw({ setScissorTest() {}, setViewport() {}, setScissor() {}, render: (sc, cam) => out.push(cam) }, null, 1600, 900);
    return out;
  };
  return { s, frame: () => frame(), sets, cameras, overview, tick: (ms) => { clock += ms; } };
}

const kartView = (finished) => ({ x: 5, y: 5, angle: 0, racer: 'rex', finished, spin: false });
const view = (phase, finished) => ({
  phase,
  race: 1,
  field: { w: 40, h: 30 },
  track: { index: 0, points: [[0, 0], [10, 0], [10, 10]] },
  trackWidth: 4,
  karts: [kartView(finished), { ...kartView(false), racer: 'dash' }],
  positions: [1, 2],
});

test('the karts keep moving while the finish shows, so the winner can celebrate', async () => {
  const { s, frame, sets } = await scene();
  s.update(view('race', false));
  frame();
  s.update(view('finish', true));
  frame();
  const last = sets[0][sets[0].length - 1];
  assert.equal(last.k.finished, true, 'the winner saw the finish');
  assert.equal(last.place, 1);
});

test("looking back turns only that half's camera round", async () => {
  const { s, frame, cameras, tick } = await scene();
  const v = view('race', false);
  v.karts = [
    { x: 20, y: 20, angle: 0, racer: 'rex', back: true, look: 0 },
    { x: 20, y: 30, angle: 0, racer: 'dash', back: false, look: 0 },
  ];
  s.update(v);
  for (let i = 0; i < 30; i++) {
    tick(16);
    frame();
  }
  const [p1, p2] = cameras();
  assert.ok(p1.position.x > 20, 'P1 looks back from in front: ' + p1.position.x);
  assert.ok(p2.position.x < 20, 'P2 still behind: ' + p2.position.x);
});

test('the cameras see the whole big field', async () => {
  const { s, cameras, overview } = await scene();
  const v = view('race', false);
  v.field = { w: 288, h: 162 };
  s.update(v);
  for (const cam of cameras()) assert.equal(cam.far, 720);
  assert.equal(overview.far, 720);
  assert.ok(overview.position.distanceTo(new THREE.Vector3(288, 0, 0)) < 720, 'the far corner is in view');
  // From that high, a near plane of 0.1 leaves too little depth precision: kerbs and road flicker.
  assert.ok(overview.near >= 288 / 100, 'overview near ' + overview.near);
  for (const cam of cameras()) assert.ok(cam.near <= 0.1, 'the chase cameras keep a close near plane');
});
