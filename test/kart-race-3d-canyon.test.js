// Sunset Canyon's scenery (public/games/kart-race-3d/canyon3d.js): where the rocks, arches, dam and
// paddock go (kept off the road), and the pieces built from that layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import '../public/games/kart-race/track.js';
import { buildTrack } from '../server/games/kart-race.js';
import { TRACKS_3D } from '../server/games/kart-tracks-3d.js';

const Road = globalThis.ArkKartTrack;
const HALF = 6; // (half the big tracks' 12-wide road)
const OUT = 1.25;

/** A page with the canyon code loaded. */
function page() {
  const context = vm.createContext({ ArkKartTrack: Road, Math });
  context.window = context;
  vm.runInContext(fs.readFileSync('public/games/kart-race-3d/canyon3d.js', 'utf8'), context);
  return context;
}

const sunset = buildTrack(0, TRACKS_3D);
const view = {
  track: { points: sunset.points, scenery: { kind: 'canyon', arches: [0.396, 0.85] } },
  trackWidth: sunset.width,
  wallOut: OUT,
  field: sunset.field,
};
const road = Road.build(sunset.points);

/** The distance from (x, y) to the nearest point of the whole centre line. */
function dist(x, y) {
  let best = Infinity;
  for (const p of road.line) best = Math.min(best, Math.hypot(p[0] - x, p[1] - y));
  return best;
}

/** Is (x, y) inside the loop the centre line draws? */
function inside(x, y) {
  let hit = false;
  const l = road.line;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    if ((l[i][1] > y) !== (l[j][1] > y) && x < ((l[j][0] - l[i][0]) * (y - l[i][1])) / (l[j][1] - l[i][1]) + l[i][0]) hit = !hit;
  }
  return hit;
}

test('no canyon without scenery', () => {
  assert.equal(page().KRCanyon.layout({ ...view, track: { points: sunset.points } }), null);
});

test('the same canyon every time', () => {
  const a = JSON.stringify(page().KRCanyon.layout(view));
  const b = JSON.stringify(page().KRCanyon.layout(view));
  assert.equal(a, b);
});

test('cliffs stand outside the field', () => {
  const cliffs = page().KRCanyon.layout(view).rocks.filter((r) => r.kind === 'cliff');
  assert.ok(cliffs.length > 30, String(cliffs.length));
  for (const c of cliffs) assert.ok(c.x + c.r < 0 || c.x - c.r > view.field.w || c.y + c.r < 0 || c.y - c.r > view.field.h, JSON.stringify(c));
});

test('rocks in the field keep off the road', () => {
  const rocks = page().KRCanyon.layout(view).rocks.filter((r) => r.kind !== 'cliff');
  assert.equal(rocks.filter((r) => r.kind === 'mesa').length, 1);
  assert.ok(rocks.length > 10, String(rocks.length));
  for (const r of rocks) assert.ok(dist(r.x, r.y) >= HALF + OUT + 3 + r.r - 1e-6, JSON.stringify(r));
});

test('two arches straddle the road, legs clear of every stretch', () => {
  const arches = page().KRCanyon.layout(view).arches;
  assert.equal(arches.length, 2);
  for (const a of arches) {
    assert.ok(dist(a.x, a.y) < 0.5, JSON.stringify(a));
    assert.ok(a.clear >= 7);
    const o = a.inner / 2 + a.legR;
    for (const s of [-1, 1]) {
      const lx = a.x - Math.sin(a.angle) * o * s;
      const ly = a.y + Math.cos(a.angle) * o * s;
      assert.ok(dist(lx, ly) >= HALF + OUT + 0.5 + a.legR - 1e-6, `leg ${s} of ${JSON.stringify(a)}`);
    }
  }
});

test('the dam is in the distance', () => {
  const dam = page().KRCanyon.layout(view).dam;
  assert.ok(dam.y < -45, String(dam.y));
  assert.ok(dam.x > 0 && dam.x < view.field.w);
});

test('the paddock is by the start, off the road, outside the loop', () => {
  const paddock = page().KRCanyon.layout(view).paddock;
  const start = Road.pointAt(road, 0);
  assert.ok(paddock.length >= 4);
  assert.ok(paddock.some((p) => p.kind === 'tent'));
  assert.ok(paddock.some((p) => p.kind === 'canopy'));
  for (const p of paddock) {
    assert.ok(dist(p.x, p.y) >= HALF + OUT + 1, JSON.stringify(p));
    assert.ok(!inside(p.x, p.y), 'outside the loop: ' + JSON.stringify(p));
    assert.ok(Math.hypot(p.x - start.x, p.y - start.y) <= 40, JSON.stringify(p));
  }
});

test('boulders keep clear of the paddock', () => {
  const l = page().KRCanyon.layout(view);
  for (const b of l.rocks.filter((r) => r.kind === 'boulder')) {
    for (const p of l.paddock) assert.ok(Math.hypot(b.x - p.x, b.y - p.y) >= 3 + b.r - 1e-6, JSON.stringify([b, p]));
  }
});

/** Everything drawn in a group: its meshes, with each one's triangles (an instanced mesh: per copy, times its copies). */
function drawn(group) {
  const meshes = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    meshes.push({ o, tris: tris * (o.isInstancedMesh ? o.count : 1) });
  });
  return meshes;
}

test('build gives nothing without scenery', () => {
  assert.equal(page().KRCanyon.build(THREE, { ...view, track: { points: sunset.points } }), null);
});

test('the canyon is one group with every rock in one instanced mesh', () => {
  const c = page();
  const { group } = c.KRCanyon.build(THREE, view);
  assert.equal(group.name, 'canyon');
  const inst = drawn(group).filter((m) => m.o.isInstancedMesh);
  assert.equal(inst.length, 1);
  assert.ok(inst[0].o.count > 100, String(inst[0].o.count));
  const pieces = {};
  group.traverse((o) => { if (o.userData.piece) pieces[o.userData.piece] = (pieces[o.userData.piece] || 0) + 1; });
  assert.equal(pieces.dam, 1);
  assert.equal(pieces.arch, 2);
  assert.ok(pieces.tent >= 1 && pieces.canopy >= 1 && pieces.flag >= 1, JSON.stringify(pieces));
});

test('the canyon stays within its draw-call and triangle budget', () => {
  const meshes = drawn(page().KRCanyon.build(THREE, view).group);
  const tris = meshes.reduce((n, m) => n + m.tris, 0);
  assert.ok(meshes.length <= 40, 'draw calls ' + meshes.length);
  assert.ok(tris <= 80000, 'triangles ' + tris);
});

test('pieces stand where the layout says', () => {
  const c = page();
  const arches = c.KRCanyon.layout(view).arches;
  const objs = [];
  c.KRCanyon.build(THREE, view).group.traverse((o) => { if (o.userData.piece === 'arch') objs.push(o); });
  arches.forEach((a, i) => {
    assert.ok(Math.abs(objs[i].position.x - a.x) < 1e-6 && Math.abs(objs[i].position.z - a.y) < 1e-6);
    assert.ok(Math.abs(objs[i].rotation.y + a.angle) < 1e-9);
  });
});

test('dispose frees each geometry and material once', () => {
  const built = page().KRCanyon.build(THREE, view);
  const calls = new Map();
  built.group.traverse((o) => {
    if (!o.isMesh) return;
    for (const thing of [o.geometry].concat(o.material)) {
      if (calls.has(thing)) continue;
      calls.set(thing, 0);
      thing.dispose = () => calls.set(thing, calls.get(thing) + 1);
    }
  });
  built.dispose();
  for (const [thing, n] of calls) assert.equal(n, 1, thing.type);
});

/** A page with the world builder and the canyon; `fills` records every canvas colour painted. */
function worldPage() {
  const fills = [];
  const g2d = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, set fillStyle(v) { fills.push(v); }, strokeStyle: '', lineWidth: 1 };
  const context = vm.createContext({ ArkKartTrack: Road, Math, document: { createElement: () => ({ width: 0, height: 0, getContext: () => g2d }) } });
  context.window = context;
  for (const f of ['geom3d.js', 'canyon3d.js', 'world3d.js']) vm.runInContext(fs.readFileSync('public/games/kart-race-3d/' + f, 'utf8'), context);
  return { win: context, fills };
}

const worldView = (scenery) => ({
  ...view,
  track: { points: sunset.points, boosts: [], start: Road.pointAt(road, 0), scenery },
});

test("Sunset Canyon's world has the canyon, sand and orange barriers", () => {
  const { win, fills } = worldPage();
  const world = win.KRWorld.build(THREE, worldView({ kind: 'canyon', arches: [0.396, 0.85] }));
  assert.ok(world.group.getObjectByName('canyon'));
  assert.equal(world.group.children[0].material.color.getHex(), 0xd9a066);
  assert.ok(fills.includes('#f97316'), fills.join());
});

test("other tracks' worlds are unchanged", () => {
  const { win, fills } = worldPage();
  const world = win.KRWorld.build(THREE, worldView(null));
  assert.equal(world.group.getObjectByName('canyon'), undefined);
  assert.equal(world.group.children[0].material.color.getHex(), 0x3f8f3a);
  assert.ok(fills.includes('#ef4444'));
  assert.ok(!fills.includes('#f97316'));
});

test('disposing the world frees the canyon once', () => {
  const { win } = worldPage();
  const world = win.KRWorld.build(THREE, worldView({ kind: 'canyon', arches: [0.396, 0.85] }));
  const calls = new Map();
  world.group.getObjectByName('canyon').traverse((o) => {
    if (!o.isMesh) return;
    for (const thing of [o.geometry].concat(o.material)) {
      if (calls.has(thing)) continue;
      calls.set(thing, 0);
      thing.dispose = () => calls.set(thing, calls.get(thing) + 1);
    }
  });
  world.dispose();
  for (const [thing, n] of calls) assert.equal(n, 1, thing.type);
});

test('the dam faces the track across the north, with its lake behind it', () => {
  const { group } = page().KRCanyon.build(THREE, view);
  let dam = null;
  group.traverse((o) => { if (o.userData.piece === 'dam') dam = o; });
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(dam);
  assert.ok(box.max.x - box.min.x > box.max.z - box.min.z, 'wider across than deep');
  assert.ok(box.max.z < 0, 'beyond the north edge: ' + box.max.z);
  // The cameras (kart3d.js) see 2.5 field-widths: keep the lake well inside that.
  assert.ok(box.min.z > -0.5 * view.field.w, 'lake not too far back: ' + box.min.z);
  const meshes = dam.children.filter((o) => o.isMesh);
  const z = (m) => new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z;
  const wall = meshes[0];
  const falls = meshes.filter((m) => m.geometry.type === 'PlaneGeometry' && m.material.transparent !== undefined && m !== wall && Math.abs(z(m) - z(wall)) < 5);
  assert.ok(falls.length === 2 && falls.every((f) => z(f) > z(wall)), 'the falls are on the track side');
});

test('dispose also frees the rocks instance buffers', () => {
  const built = page().KRCanyon.build(THREE, view);
  let rocks = null;
  built.group.traverse((o) => { if (o.isInstancedMesh) rocks = o; });
  let freed = 0;
  rocks.dispose = () => { freed++; };
  built.dispose();
  assert.equal(freed, 1);
});

test('boulders: more of them on the big field, up to 80', () => {
  const n = page().KRCanyon.layout(view).rocks.filter((r) => r.kind === 'boulder').length;
  assert.ok(n > 36 && n <= 80, String(n));
});

test('the big tracks are what the canyon is laid out for', () => {
  assert.equal(sunset.width, 12);
  assert.deepEqual(sunset.field, { w: 288, h: 162 });
});
