import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RockPaperScissors, judge, REVEAL_MS, WIN_SCORE } from '../server/games/rock-paper-scissors.js';
import { fakeCtx } from './helpers.js';

function setup() {
  const ctx = fakeCtx();
  const game = new RockPaperScissors(ctx);
  game.start();
  return { ctx, game };
}

test('judge', () => {
  assert.equal(judge('rock', 'scissors'), 0);
  assert.equal(judge('scissors', 'paper'), 0);
  assert.equal(judge('paper', 'rock'), 0);
  assert.equal(judge('rock', 'paper'), 1);
  assert.equal(judge('rock', 'rock'), null);
});

test('picks stay secret until both players lock in', () => {
  const { game } = setup();
  game.onInput(0, { type: 'pick', choice: 'rock' });
  assert.equal(game.phase, 'choose');
  assert.deepEqual(game.hostView().picks, [null, null]);
  assert.deepEqual(game.hostView().locked, [true, false]);
  assert.equal(game.playerView(1).opponentPick, null);
  assert.equal(game.playerView(1).opponentLocked, true);
  assert.equal(game.playerView(0).yourPick, 'rock');
});

test('reveal scores the round, then starts the next one', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'pick', choice: 'rock' });
  game.onInput(1, { type: 'pick', choice: 'scissors' });
  assert.equal(game.phase, 'reveal');
  assert.deepEqual(game.hostView().picks, ['rock', 'scissors']);
  assert.deepEqual(game.scores, [1, 0]);
  ctx.advance(REVEAL_MS);
  assert.equal(game.phase, 'choose');
  assert.equal(game.round, 2);
});

test('draws score nothing', () => {
  const { game } = setup();
  game.onInput(0, { type: 'pick', choice: 'paper' });
  game.onInput(1, { type: 'pick', choice: 'paper' });
  assert.equal(game.roundWinner, null);
  assert.deepEqual(game.scores, [0, 0]);
});

test('invalid or repeated picks are ignored', () => {
  const { game } = setup();
  game.onInput(0, { type: 'pick', choice: 'lizard' });
  assert.equal(game.picks[0], null);
  game.onInput(0, { type: 'pick', choice: 'rock' });
  game.onInput(0, { type: 'pick', choice: 'paper' });
  assert.equal(game.picks[0], 'rock');
});

test('first to WIN_SCORE wins the match', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) {
    game.onInput(0, { type: 'pick', choice: 'rock' });
    game.onInput(1, { type: 'pick', choice: 'paper' });
    ctx.advance(REVEAL_MS);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'choose');
  assert.deepEqual(game.scores, [0, 0]);
});
