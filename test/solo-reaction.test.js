import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { ReactionDuel, soloReaction, SOLO, TIMING as DUEL } from '../server/games/reaction-duel.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

// (it was 1P's Reaction Rush: now Reaction Duel's 1 player mode, server/games/reaction-duel.js)
const ROUNDS = SOLO.rounds;
const PENALTY_MS = SOLO.penaltyMs;
const TIMING = { readyMs: DUEL.readyMs, slowMs: SOLO.slowMs };
const ReactionRush = function (ctx, rng) { return new ReactionDuel(ctx, rng, { solo: true }); };

function untilGo(ctx, g) {
  for (let i = 0; i < 1000 && g.phase !== 'go'; i++) ctx.advance(10);
  assert.equal(g.phase, 'go');
}

test('five taps: the score is the average reaction time', () => {
  const ctx = fakeCtx();
  const g = new ReactionRush(ctx, () => 0.5);
  g.start();
  const times = [200, 250, 300, 220, 280];
  for (const ms of times) {
    untilGo(ctx, g);
    ctx.advance(ms);
    g.onInput(0, { type: 'tap' });
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.deepEqual(v.times, times);
  assert.equal(v.score, 250);
  assert.equal(v.fastest, 200);
  assert.equal(ctx.pendingTimers(), 0);
});

test('a false start replays the round and costs a penalty', () => {
  const ctx = fakeCtx();
  const g = new ReactionRush(ctx, () => 0.5);
  g.start();
  ctx.advance(TIMING.readyMs + 100);
  assert.equal(g.phase, 'wait');
  g.onInput(0, { type: 'tap' });
  assert.equal(g.phase, 'early');
  assert.equal(g.hostView().round, 1);
  for (let r = 0; r < ROUNDS; r++) {
    untilGo(ctx, g);
    ctx.advance(300);
    g.onInput(0, { type: 'tap' });
  }
  assert.equal(g.hostView().score, 300 + PENALTY_MS);
});

test('no tap counts as the slowest time', () => {
  const ctx = fakeCtx();
  const g = new ReactionRush(ctx, () => 0.5);
  g.start();
  untilGo(ctx, g);
  ctx.advance(TIMING.slowMs);
  assert.deepEqual(g.times, [TIMING.slowMs]);
  assert.equal(g.phase, 'result');
  g.onInput(0, { type: 'tap' }); // between rounds: nothing
  assert.equal(g.falseStarts, 0);
});

test('one game in both lobbies: Reaction Duel and Reaction Rush, under one id', () => {
  assert.equal(getGame('reaction-duel').name, 'Reaction Duel');
  assert.equal(soloGameOf('reaction-duel').name, 'Reaction Rush');
  const ctx = Object.assign(fakeCtx(), { rng: () => 0.5 });
  const run = soloReaction.create(ctx);
  run.start();
  untilGo(ctx, run.game);
  run.game.onInput(1, { type: 'tap' }); // (nobody else's)
  assert.equal(run.playerView().times.length, 0);
  run.onInput({ type: 'tap' });
  assert.equal(run.playerView().times.length, 1);
  assert.ok(!listGames().some((g) => g.id === 'reaction-1p'), 'Reaction Rush 1P is gone');
});
