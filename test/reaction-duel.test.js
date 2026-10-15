import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReactionDuel, TIMING, WIN_SCORE } from '../server/games/reaction-duel.js';
import { fakeCtx } from './helpers.js';

function setup() {
  const ctx = fakeCtx();
  const game = new ReactionDuel(ctx, () => 0); // rng 0 -> shortest wait
  game.start();
  return { ctx, game };
}

const toGo = (ctx) => ctx.advance(TIMING.readyMs + TIMING.minWaitMs);

test('round flows ready -> wait -> go', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'ready');
  ctx.advance(TIMING.readyMs);
  assert.equal(game.phase, 'wait');
  ctx.advance(TIMING.minWaitMs);
  assert.equal(game.phase, 'go');
});

test('first tap after GO wins the point and records reaction time', () => {
  const { ctx, game } = setup();
  toGo(ctx);
  ctx.advance(250);
  game.onInput(1, { type: 'tap' });
  game.onInput(0, { type: 'tap' }); // too late, ignored
  assert.equal(game.phase, 'result');
  assert.deepEqual(game.scores, [0, 1]);
  assert.deepEqual(game.result, { kind: 'tap', winner: 1, ms: 250 });
  assert.equal(game.hostView().bestMs[1], 250);
});

test('tapping before GO is a false start and gives the opponent the point', () => {
  const { ctx, game } = setup();
  ctx.advance(TIMING.readyMs);
  game.onInput(0, { type: 'tap' });
  assert.deepEqual(game.scores, [0, 1]);
  assert.equal(game.result.kind, 'false-start');
  assert.equal(game.result.offender, 0);
  // The pending GO timer must have been cancelled.
  ctx.advance(TIMING.resultMs - 1);
  assert.equal(game.phase, 'result');
});

test('taps during ready are ignored', () => {
  const { game } = setup();
  game.onInput(0, { type: 'tap' });
  assert.equal(game.phase, 'ready');
  assert.deepEqual(game.scores, [0, 0]);
});

test('nobody tapping voids the round', () => {
  const { ctx, game } = setup();
  toGo(ctx);
  ctx.advance(TIMING.noTapMs);
  assert.equal(game.phase, 'result');
  assert.equal(game.result.kind, 'no-tap');
  assert.deepEqual(game.scores, [0, 0]);
});

test('first to WIN_SCORE wins, and rematch resets', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) {
    toGo(ctx);
    game.onInput(0, { type: 'tap' });
    if (i < WIN_SCORE - 1) ctx.advance(TIMING.resultMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(ctx.pendingTimers(), 0);

  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'ready');
  assert.deepEqual(game.scores, [0, 0]);
  assert.equal(game.round, 1);
});

test('player view tells each phone which slot it is', () => {
  const { game } = setup();
  assert.equal(game.playerView(0).you, 0);
  assert.equal(game.playerView(1).you, 1);
});
