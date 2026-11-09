// Kart Race 3D's movement maths (public/games/kart-race-3d/rig3d.js): wheel roll, steering,
// where Rex looks, and his reactions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race-3d/rig3d.js';

const R = globalThis.KRRig;
const at = (x, y, angle = 0) => ({ x, y, angle });

test('roll: forward along the heading is distance / radius', () => {
  assert.equal(R.roll(at(0, 0), at(0.5, 0), 0.25), 2);
});

test('roll: reversing rolls backwards', () => {
  assert.equal(R.roll(at(1, 0), at(0.5, 0), 0.25), -2);
});

test('roll: stopped or first frame is 0', () => {
  assert.equal(R.roll(at(1, 1), at(1, 1), 0.25), 0);
  assert.equal(R.roll(null, at(1, 1), 0.25), 0);
});

test('roll: a jump past TELEPORT is 0', () => {
  assert.equal(R.roll(at(0, 0), at(5, 0), 0.25), 0);
});

test('turnRate wraps across ±π', () => {
  const r = R.turnRate(at(0, 0, 3.1), at(0, 0, -3.1), 1000);
  assert.ok(Math.abs(r - (2 * Math.PI - 6.2)) < 1e-9, String(r));
  assert.equal(R.turnRate(null, at(0, 0, 1), 16), 0);
  assert.equal(R.turnRate(at(0, 0, 0), at(0, 0, 1), 0), 0);
});

test('steerGoal caps at 25°', () => {
  assert.equal(R.STEER_MAX, (25 * Math.PI) / 180);
  assert.equal(R.steerGoal(100), R.STEER_MAX);
  assert.equal(R.steerGoal(-100), -R.STEER_MAX);
  assert.ok(Math.abs(R.steerGoal(0.4) - 0.1) < 1e-12);
});

test('headGoal caps at 30°', () => {
  assert.equal(R.HEAD_MAX, (30 * Math.PI) / 180);
  assert.equal(R.headGoal(100), R.HEAD_MAX);
  assert.equal(R.headGoal(-100), -R.HEAD_MAX);
});

test('reaction: spin first, then a win in first place, else none', () => {
  assert.equal(R.reaction({ spin: true, finished: true }, 1), 'spin');
  assert.equal(R.reaction({ finished: true }, 1), 'win');
  assert.equal(R.reaction({ finished: true }, 2), null);
  assert.equal(R.reaction({}, 1), null);
  assert.equal(R.reaction(null, 1), null);
});

test('moves: steering, arms up when spun, a left fist pump when winning', () => {
  assert.deepEqual(R.moves(null, 0.2, 0.3, 0), { column: 0.2, armL: 0, armR: 0, headYaw: 0.3 });
  const spin = R.moves('spin', 0.2, 0.3, 0);
  assert.equal(spin.armL, 2.2);
  assert.equal(spin.armR, 2.2);
  assert.equal(spin.column, 0);
  const win = R.moves('win', 0.2, 0.3, 0);
  assert.equal(win.armR, 0);
  assert.ok(win.armL >= 1.6);
  assert.equal(win.column, 0);
});

test('bob is 0 when stopped on flat road', () => {
  assert.equal(R.bob(0, 0, 123), 0);
  assert.ok(Math.abs(R.bob(0, 1, 0)) <= 0.05); // a big drop is capped
});

test('ease moves a fifth of the way', () => {
  assert.ok(Math.abs(R.ease(0, 1) - 0.2) < 1e-12);
});
