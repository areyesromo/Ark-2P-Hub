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
  const sets = [];
  const context = vm.createContext({
    performance: { now: () => 1000 },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    document: { documentElement: {} },
  });
  context.window = context;
  vm.runInContext(fs.readFileSync('public/games/kart-race/racers.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('public/games/kart-race-3d/geom3d.js', 'utf8'), context);
  context.ArkMini = {
    scene3d: async () => ({ THREE, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), onFrame: (fn) => { frame = fn; }, dispose() {} }),
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
  return { s, frame: () => frame(), sets };
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
