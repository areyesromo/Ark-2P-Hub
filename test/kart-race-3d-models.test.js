// Kart Race 3D's racer models (public/games/kart-race-3d/models/, built by tools/kart-models/):
// the parts the game moves, the size the game expects, and the triangle and texture budgets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { readGlb, nodeNames, triangles, bounds, imageSize, floats } from './helpers-glb.js';

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

const BONES = ['hips', 'spine', 'chest', 'neck', 'head',
  ...['shoulder', 'upper_arm', 'forearm', 'hand', 'thigh', 'shin', 'foot'].flatMap((b) => [b + '_l', b + '_r']),
  'tail_1', 'tail_2', 'tail_3'];

/** Each node's world matrix (its parents' transforms down to it). */
function worlds(json) {
  const parent = {};
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
  const local = (n) => new THREE.Matrix4().compose(
    new THREE.Vector3(...(n.translation || [0, 0, 0])),
    new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])),
    new THREE.Vector3(...(n.scale || [1, 1, 1])));
  const world = (i) => (parent[i] === undefined ? local(json.nodes[i]) : world(parent[i]).multiply(local(json.nodes[i])));
  return (name) => world(json.nodes.findIndex((n) => n.name === name));
}

/** An accessor's numbers, floats or normalised integers. */
function numbers(json, bin, i) {
  const a = json.accessors[i];
  if (a.componentType === 5126) return floats(json, bin, i);
  const view = json.bufferViews[a.bufferView];
  const size = { VEC4: 4 }[a.type];
  const bytes = a.componentType === 5121 ? 1 : 2;
  const stride = view.byteStride || size * bytes;
  const start = (view.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let n = 0; n < a.count; n++) {
    const e = [];
    for (let k = 0; k < size; k++) e.push(bytes === 1 ? bin.readUInt8(start + n * stride + k) / 255 : bin.readUInt16LE(start + n * stride + k * 2) / 65535);
    out.push(e);
  }
  return out;
}

test('rex.glb is one skinned mesh with its 22 bones', () => {
  const { json } = readGlb(DIR + 'rex.glb');
  assert.equal((json.skins || []).length, 1);
  const names = json.skins[0].joints.map((j) => json.nodes[j].name).sort();
  assert.deepEqual(names, [...BONES].sort());
  const skinned = json.meshes.filter((m) => m.primitives.every((p) => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined));
  assert.equal(skinned.length, 1);
  assert.ok(triangles(json) <= 8000, String(triangles(json)));
});

test("every vertex's weights add up to 1", () => {
  const { json, bin } = readGlb(DIR + 'rex.glb');
  const prim = json.meshes.find((m) => m.primitives[0].attributes.WEIGHTS_0 !== undefined).primitives[0];
  for (const w of numbers(json, bin, prim.attributes.WEIGHTS_0)) assert.ok(Math.abs(w[0] + w[1] + w[2] + w[3] - 1) < 0.01, String(w));
});

test("the left arm's bones are on the left, the head above the chest", () => {
  const { json } = readGlb(DIR + 'rex.glb');
  const w = worlds(json);
  const at = (name) => new THREE.Vector3().setFromMatrixPosition(w(name));
  assert.ok(at('upper_arm_l').z < 0 && at('upper_arm_r').z > 0, `${at('upper_arm_l').z} ${at('upper_arm_r').z}`);
  assert.ok(at('head').y > at('chest').y);
});

test("rex-kart.glb's steering wheel turns on the column, with grips", () => {
  const { json } = readGlb(DIR + 'rex-kart.glb');
  const steer = json.nodes.findIndex((n) => n.name === 'steer');
  assert.ok(steer !== -1, 'a steer node');
  const kids = (json.nodes[steer].children || []).map((c) => json.nodes[c].name);
  assert.ok(kids.includes('grip_l') && kids.includes('grip_r'), JSON.stringify(kids));
  const at = (name) => new THREE.Vector3().setFromMatrixPosition(worlds(json)(name));
  assert.ok(at('grip_l').z < 0 && at('grip_r').z > 0, 'grip_l on the left, in the kart frame');
  // In reach of the driver's hands: below the wheel's centre (the near side of a tilted wheel).
  assert.ok(at('grip_l').y < at('steer').y && at('grip_r').y < at('steer').y);
  assert.ok(json.nodes[steer].mesh !== undefined, 'the steering wheel is a mesh of its own');
  assert.ok(triangles(json) <= 10000, String(triangles(json)));
});

test('each model has one 1024 texture and stays small', () => {
  for (const file of ['rex-kart.glb', 'rex.glb']) {
    const { json, bin } = readGlb(DIR + file);
    assert.equal((json.images || []).length, 1, file);
    const size = imageSize(json, bin, 0);
    assert.equal(size.width, 1024, file);
    assert.equal(size.height, 1024, file);
    assert.ok(fs.statSync(DIR + file).size < 1.5e6, file);
  }
});

/** Every texture coordinate of a node's mesh, as glTF has them (v runs down from the top). */
function uvs(json, bin, name) {
  const mesh = json.meshes[node(json, name).mesh];
  return mesh.primitives.flatMap((p) => floats(json, bin, p.attributes.TEXCOORD_0));
}

test("the kart's wheels are painted from their own part of the texture", () => {
  // The wheel area is the texture's bottom-right quarter-strip: u 0.5-1, v 0.75-1 (glTF's v runs down).
  const { json, bin } = readGlb(DIR + 'rex-kart.glb');
  const inWheels = ([u, v]) => u >= 0.5 - 1e-4 && v >= 0.75 - 1e-4;
  for (const w of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const all = uvs(json, bin, w);
    assert.ok(all.length > 0 && all.every(inWheels), w);
  }
  assert.ok(!uvs(json, bin, 'body').some(inWheels), 'the body keeps out of the wheel area');
});
