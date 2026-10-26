// Kart Race 3D's maths (public/games/kart-race-3d/geom3d.js): road and wall shapes, smoothing
// between views, and the chase camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import '../public/games/kart-race-3d/geom3d.js';
import { buildTrack, buildArena, TRACKS, ARENAS, FIELD, TRACK_WIDTH } from '../server/games/kart-race.js';

const G = globalThis.ArkKartGeom;
const Road = globalThis.ArkKartTrack;

/** Does segment p1-p2 cross segment q1-q2? */
function crosses(p1, p2, q1, q2) {
  const side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return side(p1, p2, q1) * side(p1, p2, q2) < 0 && side(q1, q2, p1) * side(q1, q2, p2) < 0;
}

test('heightAt is flat for now', () => {
  assert.equal(G.heightAt(5, 7), 0);
});

test('the road ribbon spans the road on every track and arena', () => {
  const all = TRACKS.map((_, i) => buildTrack(i)).concat(ARENAS.map((_, i) => buildArena(i)));
  for (const tr of all) {
    const n = tr.line.length;
    const { positions, indices } = G.ribbon(Road.outline(tr.line, -tr.width / 2), Road.outline(tr.line, tr.width / 2));
    assert.equal(positions.length, 2 * n * 3, tr.name);
    assert.equal(indices.length, 6 * n, tr.name);
    assert.ok(Array.from(indices).every((i) => i < 2 * n), tr.name);
    const d = Math.hypot(positions[3] - positions[0], positions[5] - positions[2]);
    assert.ok(Math.abs(d - tr.width) < 0.01, `${tr.name}: ${d}`);
    assert.equal(positions[1], 0, 'flat');
  }
});

test('wall segments are the barrier inside faces plus the field border', () => {
  const tr = buildTrack(0);
  const segs = G.wallSegments(tr, tr.edge, FIELD);
  assert.equal(segs.length, 2 * tr.line.length + 4);
  for (const s of segs) {
    for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]]) {
      assert.ok(x >= 0 && x <= FIELD.w && y >= 0 && y <= FIELD.h, `${x},${y}`);
    }
  }
});

test('smoother: blends halfway between two views, 50 ms behind', () => {
  const s = G.smoother();
  s.push(0, [{ x: 0, y: 0, angle: 0 }]);
  s.push(100, [{ x: 2, y: 0, angle: 0 }]);
  assert.ok(Math.abs(s.at(100)[0].x - 1) < 1e-9);
});

test('smoother: turns the short way across west', () => {
  const s = G.smoother();
  s.push(0, [{ x: 0, y: 0, angle: 3.1 }]);
  s.push(100, [{ x: 0, y: 0, angle: -3.1 }]);
  assert.ok(Math.abs(s.at(100)[0].angle) > 3.1, String(s.at(100)[0].angle));
});

test('smoother: a jump of more than 2 units snaps', () => {
  const s = G.smoother();
  s.push(0, [{ x: 0, y: 0, angle: 0 }]);
  s.push(100, [{ x: 10, y: 0, angle: 0 }]);
  assert.equal(s.at(100)[0].x, 10);
});

test('smoother: null before any view, the newest after it', () => {
  const s = G.smoother();
  assert.equal(s.at(0), null);
  s.push(0, [{ x: 1, y: 2, angle: 0 }]);
  assert.deepEqual(s.at(500), [{ x: 1, y: 2, angle: 0 }]);
  s.push(100, [{ x: 2, y: 2, angle: 0 }]);
  assert.equal(s.at(1000)[0].x, 2);
});

test('chase: the eye is behind the kart and the look point ahead of it', () => {
  const c = G.chase({ x: 10, y: 9, angle: 0 });
  assert.ok(Math.abs(c.eye[0] - 6.8) < 1e-9 && Math.abs(c.eye[1] - 9) < 1e-9);
  assert.equal(c.eyeH, 1.6);
  assert.ok(Math.abs(c.look[0] - 12.5) < 1e-9 && Math.abs(c.look[1] - 9) < 1e-9);
});

test('follow: moves part of the way, never past the goal', () => {
  const r = G.follow([0, 0], [10, -10], 16);
  assert.ok(r[0] > 0 && r[0] < 10 && r[1] < 0 && r[1] > -10);
  const far = G.follow([0], [10], 1e6);
  assert.ok(far[0] <= 10 && far[0] > 9.99);
});

test('clampEye: an eye behind a wall comes back in front of it, on a shared barrier too', () => {
  const wall = [[5, -10, 5, 10]];
  const e = G.clampEye([0, 0], [8, 0], wall, 0.2);
  assert.ok(e[0] < 5 && e[0] >= 5 - 0.2 - 0.01, String(e));
  assert.deepEqual(G.clampEye([0, 0], [3, 0], wall, 0.2), [3, 0], 'no wall in the way');
  const hp = TRACKS.findIndex((t) => t.name === 'Hairpins');
  assert.ok(hp >= 0);
  const tr = buildTrack(hp);
  const segs = G.wallSegments(tr, tr.edge, FIELD);
  for (let i = 0; i < tr.line.length; i += 10) {
    const p = Road.pointAt(tr, i / tr.line.length);
    const kart = [p.x, p.y];
    const eye = G.clampEye(kart, G.chase({ x: p.x, y: p.y, angle: p.angle }).eye, segs);
    assert.ok(!segs.some((s) => crosses(kart, eye, [s[0], s[1]], [s[2], s[3]])), `sample ${i}`);
  }
});

test('the default road width is what the ribbon test assumes', () => {
  assert.equal(buildTrack(0).width, TRACK_WIDTH);
});

test('an open ribbon has no closing quad (a seam the stripes can run across cleanly)', () => {
  const a = [[0, 0], [1, 0], [2, 0]];
  const b = [[0, 1], [1, 1], [2, 1]];
  const { positions, indices } = G.ribbon(a, b, true);
  assert.equal(positions.length, 3 * 2 * 3);
  assert.equal(indices.length, 6 * 2);
  assert.ok(!Array.from(indices).some((i, k) => k >= 6 && i === 0), 'nothing joins the end back to the start');
});

test('wall lines: a barrier shared by two stretches is drawn once, each side up to the middle', () => {
  const hp = TRACKS.findIndex((t) => t.name === 'Hairpins');
  const tr = buildTrack(hp);
  const reach = tr.width / 2 + tr.out;
  const W = G.wallLines(tr, tr.edge, reach);
  let shared = 0;
  for (const side of ['left', 'right']) {
    tr.line.forEach((_, i) => {
      const thick = Math.hypot(W[side].outer[i][0] - W[side].inner[i][0], W[side].outer[i][1] - W[side].inner[i][1]);
      const isShared = tr.edge[side][i] < reach - 1e-9;
      if (isShared) shared++;
      assert.ok(Math.abs(thick - (isShared ? Road.BARRIER / 2 : Road.BARRIER)) < 1e-6, `${side} ${i}: ${thick}`);
    });
  }
  assert.ok(shared > 100, 'Hairpins has long shared stretches');
});
