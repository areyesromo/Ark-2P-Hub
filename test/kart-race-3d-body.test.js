// Kart Race 3D's driver motion maths (public/games/kart-race-3d/body3d.js): springs, the arm reach,
// which reaction plays and how it blends, the pose, and the tail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race-3d/body3d.js';

const B = globalThis.KRBody;
const run = (ms, dt, goal, settle) => {
  let s = { x: 0, v: 0 };
  for (let t = 0; t < ms; t += dt) s = B.spring(s, goal, dt, settle);
  return s.x;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('spring settles at its goal, the same at 30 and 60 fps', () => {
  const a = run(1000, 16.7, 1, 120);
  const b = run(1000, 33.3, 1, 120);
  assert.ok(Math.abs(a - 1) < 0.001, String(a));
  assert.ok(Math.abs(b - 1) < 0.001, String(b));
  assert.ok(Math.abs(a - b) < 0.01);
});

test("a dropped frame doesn't overshoot", () => {
  const s = B.spring({ x: 0, v: 0 }, 1, 200, 120);
  assert.ok(s.x >= 0 && s.x <= 1 && Number.isFinite(s.v), JSON.stringify(s));
});

test('ik2 reaches a reachable grip, keeping the bones their length', () => {
  const shoulder = [0, 0, 0];
  const r = B.ik2(shoulder, [0.15, 0, 0], [0.3, 0, 0], [0.2, -0.1, 0.05], [0, -1, 0]);
  assert.ok(dist(r.hand, [0.2, -0.1, 0.05]) < 0.01, JSON.stringify(r));
  assert.ok(Math.abs(dist(shoulder, r.elbow) - 0.15) < 0.001);
  assert.ok(Math.abs(dist(r.elbow, r.hand) - 0.15) < 0.001);
  assert.ok(r.elbow[1] < 0, 'the elbow bends toward the pole');
});

test('ik2 points straight at a grip out of reach, all numbers finite', () => {
  const r = B.ik2([0, 0, 0], [0.15, 0, 0], [0.3, 0, 0], [1, 0, 0], [0, -1, 0]);
  assert.ok(dist(r.hand, [0.3, 0, 0]) < 0.001, JSON.stringify(r));
  assert.ok([...r.elbow, ...r.hand].every(Number.isFinite));
  const same = B.ik2([0, 0, 0], [0.15, 0, 0], [0.3, 0, 0], [0, 0, 0], [0, -1, 0]); // a grip on the shoulder
  assert.ok([...same.elbow, ...same.hand].every(Number.isFinite));
});

test('reaction priority: spin, then the finish, then items', () => {
  const r = (k, place, finishing) => B.reaction(k, place, finishing);
  assert.deepEqual({ ...r({ spin: true, used: 'bomb' }, 1, false) }, { name: 'spin', arms: 'both' });
  assert.deepEqual({ ...r({ finished: true }, 1, true) }, { name: 'win', arms: 'left' });
  assert.deepEqual({ ...r({ finished: true }, 2, true) }, { name: 'sad', arms: 'none' });
  assert.deepEqual({ ...r({ used: 'banana' }, 2, false) }, { name: 'drop', arms: 'left' });
  assert.deepEqual({ ...r({ used: 'seeker' }, 2, false) }, { name: 'throw', arms: 'right' });
  assert.deepEqual({ ...r({ used: 'shield' }, 2, false) }, { name: 'use', arms: 'right' });
  assert.deepEqual({ ...r({ used: 'swap' }, 2, false) }, { name: 'point', arms: 'right' });
  assert.equal(r({}, 2, false), null);
  assert.equal(r(null, 1, false), null);
});

test('blend: in over 0.2 s, out over 0.25 s', () => {
  assert.ok(Math.abs(B.blend({ weight: 0 }, true, 100).weight - 0.5) < 0.01);
  assert.equal(B.blend({ weight: 0 }, true, 200).weight, 1);
  assert.ok(Math.abs(B.blend({ weight: 1 }, false, 125).weight - 0.5) < 0.01);
  assert.equal(B.blend({ weight: 0.1 }, false, 1000).weight, 0);
});

test('react: a new reaction waits for the old one to fade out, never snapping', () => {
  let s = B.react(null, { name: 'throw', arms: 'right' }, 200);
  assert.equal(s.name, 'throw');
  assert.equal(s.weight, 1);
  s = B.react(s, { name: 'spin', arms: 'both' }, 50); // the spin takes over…
  assert.equal(s.name, 'throw', '…once the throw has faded');
  assert.ok(s.weight < 1 && s.weight > 0);
  for (let i = 0; i < 10; i++) s = B.react(s, { name: 'spin', arms: 'both' }, 50);
  assert.equal(s.name, 'spin');
  for (let i = 0; i < 20; i++) s = B.react(s, null, 50);
  assert.equal(s.weight, 0);
});

const base = { steer: 0, rate: 0, speed: 5, boosting: false, braking: false, dh: 0, jolt: 0, now: 1000, reaction: null };

test('pose: the wheel turns 2.5x the steer, capped at 60 degrees', () => {
  assert.ok(Math.abs(B.pose({ ...base, steer: 0.1 }).wheel - 0.25) < 1e-9);
  assert.ok(Math.abs(B.pose({ ...base, steer: 1 }).wheel - 1.0472) < 1e-4);
  assert.ok(Math.abs(B.pose({ ...base, steer: -1 }).wheel + 1.0472) < 1e-4);
});

test('pose: a one-arm reaction lets go with that hand only', () => {
  const p = B.pose({ ...base, reaction: { name: 'throw', arms: 'right', weight: 1, t: 100 } });
  assert.deepEqual({ ...p.ikWeight }, { l: 1, r: 0 });
  const spin = B.pose({ ...base, reaction: { name: 'spin', arms: 'both', weight: 0.5, t: 0 } });
  assert.deepEqual({ ...spin.ikWeight }, { l: 0.5, r: 0.5 });
  assert.deepEqual({ ...B.pose(base).ikWeight }, { l: 1, r: 1 });
});

test('pose: leans into a bend and back on a boost, within the limits', () => {
  const turn = B.pose({ ...base, rate: 10 }); // hard right
  const lean = (p, bone) => (p.turns[bone] || []).filter(([a]) => a === 'x').reduce((s, [, v]) => s + v, 0);
  assert.ok(lean(turn, 'spine') + lean(turn, 'chest') > 0 && lean(turn, 'spine') + lean(turn, 'chest') <= (10 * Math.PI) / 180 + 1e-9);
  const pitch = (p) => (p.turns.chest || []).filter(([a]) => a === 'z').reduce((s, [, v]) => s + v, 0) + (p.turns.spine || []).filter(([a]) => a === 'z').reduce((s, [, v]) => s + v, 0);
  const still = { ...base, now: 0 }; // (no breathing at t = 0)
  assert.ok(pitch(B.pose({ ...still, boosting: true })) > 0.1, 'rocks back on a boost');
  assert.ok(pitch(B.pose({ ...still, braking: true })) < -0.05, 'tips forward braking');
});

test('tail trails opposite the bend, the tip most', () => {
  let s = null;
  for (let i = 0; i < 60; i++) s = B.tail(s, 2, 6, 0, 16);
  assert.ok(s.yaw.every((y) => y < 0), JSON.stringify(s.yaw));
  assert.ok(Math.abs(s.yaw[2]) > Math.abs(s.yaw[0]));
});
