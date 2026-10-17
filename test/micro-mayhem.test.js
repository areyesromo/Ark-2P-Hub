import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { MicroMayhem } from '../server/games/micro-mayhem.js';
import { TIMING } from '../server/games/minis/runner.js';
import { listGames } from '../server/games/index.js';

/** A micro each player passes or fails by saying so. */
const stub = {
  id: 'say', kind: 'micro', name: 'Say', order: 'SAY!', howTo: 'pass or fail', durationMs: 2000,
  create(api) {
    const res = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (res[slot] !== null) return;
        res[slot] = input.type === 'pass';
        if (res[0] !== null && res[1] !== null) api.end({ pass: res.slice() });
      },
      view: () => ({}),
    };
  },
};

function game(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const g = new MicroMayhem(ctx, [stub]);
  g.start();
  /** Play one micro: each player passes (true) or fails (false). */
  const round = (a, b) => {
    ctx.advance(TIMING.introMicroMs);
    g.onInput(0, { type: a ? 'pass' : 'fail' });
    g.onInput(1, { type: b ? 'pass' : 'fail' });
    ctx.advance(TIMING.resultMicroMs);
  };
  return { g, ctx, round };
}

test('Micro Mayhem: speeds up a level every 5 micros', () => {
  const { g, round } = game();
  assert.equal(g.hostView().level, 1);
  assert.equal(g.scale(), 1);
  for (let i = 0; i < 5; i++) round(true, true);
  assert.equal(g.hostView().level, 2);
  assert.equal(g.scale(), 0.85);
  for (let i = 0; i < 40; i++) round(true, true);
  assert.equal(g.hostView().level, 10);
  assert.equal(g.scale(), 0.45);
});

test('Micro Mayhem: fast pace starts at speed 3', () => {
  const { g } = game({ pace: 'fast' });
  assert.equal(g.hostView().level, 3);
});

test('Micro Mayhem: a fail costs a life; out of lives loses', () => {
  const { g, round } = game();
  assert.deepEqual(g.hostView().lives, [3, 3]);
  round(true, false);
  assert.deepEqual(g.hostView().lives, [3, 2]);
  assert.deepEqual(g.hostView().scores, [3, 2]);
  round(true, false);
  round(false, false);
  const v = g.hostView();
  assert.deepEqual(v.lives, [2, 0]);
  assert.equal(v.phase, 'over');
  assert.equal(v.winner, 0);
  assert.equal(v.draw, false);
});

test('Micro Mayhem: both out together goes to sudden death', () => {
  const { g, round } = game();
  round(false, false);
  round(false, false);
  round(false, false);
  let v = g.hostView();
  assert.equal(v.phase, 'intro');
  assert.equal(v.suddenDeath, true);
  assert.deepEqual(v.lives, [1, 1]);
  round(false, false);
  assert.equal(g.hostView().suddenDeath, true);
  assert.equal(g.hostView().phase, 'intro');
  round(true, true);
  assert.equal(g.hostView().phase, 'intro');
  round(false, true);
  v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.winner, 1);
});

test('Micro Mayhem: 5 lives setting; rematch resets', () => {
  const { g, round } = game({ lives: 5 });
  assert.deepEqual(g.hostView().lives, [5, 5]);
  assert.equal(g.hostView().startLives, 5);
  for (let i = 0; i < 5; i++) round(true, false);
  assert.equal(g.hostView().phase, 'over');
  g.onInput(0, { type: 'rematch' });
  assert.deepEqual(g.hostView().lives, [5, 5]);
  assert.equal(g.hostView().level, 1);
});

test('Micro Mayhem is in the lobby as a competitive game', () => {
  const g = listGames().find((x) => x.id === 'micro-mayhem');
  assert.ok(g);
  assert.equal(g.category, 'competitive');
});
