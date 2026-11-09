// Kart Race 3D's racer models (public/games/kart-race-3d/models/, built by tools/kart-models/):
// the parts the game moves, the size the game expects, and the triangle and texture budgets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGlb, nodeNames, triangles, bounds } from './helpers-glb.js';

const DIR = 'public/games/kart-race-3d/models/';
const node = (json, name) => json.nodes.find((n) => n.name === name);

test('rex-kart.glb has its parts', () => {
  const { json } = readGlb(DIR + 'rex-kart.glb');
  for (const name of ['body', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr', 'seat', 'column']) {
    assert.ok(nodeNames(json).includes(name), name);
  }
});

test('rex-kart.glb is within budget', () => {
  const { json } = readGlb(DIR + 'rex-kart.glb');
  assert.ok(triangles(json) <= 10000, String(triangles(json)));
});

test('rex-kart.glb is 1.75 long, on the ground, centred', () => {
  const { min, max } = bounds(readGlb(DIR + 'rex-kart.glb').json);
  assert.ok(Math.abs(max[0] - min[0] - 1.75) <= 0.035, String(max[0] - min[0]));
  assert.ok(Math.abs(min[1]) <= 0.02, String(min[1]));
  assert.ok(Math.abs(max[0] + min[0]) <= 0.05, String(max[0] + min[0]));
});

test('the front-left wheel is front and left (left is -z)', () => {
  const { json } = readGlb(DIR + 'rex-kart.glb');
  const fl = node(json, 'wheel_fl').translation;
  const rr = node(json, 'wheel_rr').translation;
  assert.ok(fl[0] > 0 && fl[2] < 0, String(fl));
  assert.ok(rr[0] < 0 && rr[2] > 0, String(rr));
});

test('rex.glb has its parts', () => {
  const { json } = readGlb(DIR + 'rex.glb');
  for (const name of ['torso', 'head', 'arm_l', 'arm_r']) assert.ok(nodeNames(json).includes(name), name);
});

test('rex.glb is within budget', () => {
  const { json } = readGlb(DIR + 'rex.glb');
  assert.ok(triangles(json) <= 8000, String(triangles(json)));
});

test('the head pivot is above the shoulders; the left arm is on the left', () => {
  const { json } = readGlb(DIR + 'rex.glb');
  const head = node(json, 'head').translation;
  const l = node(json, 'arm_l').translation;
  const r = node(json, 'arm_r').translation;
  assert.ok(head[1] > l[1] - 0.05, `${head} ${l}`);
  assert.ok(l[2] < 0 && r[2] > 0, `${l} ${r}`);
});
