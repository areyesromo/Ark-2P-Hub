// Sunset Canyon's scenery (public/games/kart-race-3d/canyon3d.js): where the rocks, arches, dam and
// paddock go (kept off the road), and the pieces built from that layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../public/games/kart-race/track.js';
import { buildTrack } from '../server/games/kart-race.js';
import { TRACKS_3D } from '../server/games/kart-tracks-3d.js';

const Road = globalThis.ArkKartTrack;
const HALF = 3.5;
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
  trackWidth: 7,
  wallOut: OUT,
  field: { w: 128, h: 72 },
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
  for (const c of cliffs) assert.ok(c.x + c.r < 0 || c.x - c.r > 128 || c.y + c.r < 0 || c.y - c.r > 72, JSON.stringify(c));
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
  assert.ok(dam.y < -20, String(dam.y));
  assert.ok(dam.x > 0 && dam.x < 128);
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
