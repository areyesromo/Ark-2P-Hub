import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Morris, NEIGHBOURS, MILLS, TIMING, inMill, takeable, actions } from '../server/games/morris.js';
import { morrisBot } from '../server/games/morris-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Morris(ctx, () => 0);
  game.start();
  return { ctx, game };
}

test('the board: 24 points, 16 mills; corners have two neighbours, side middles three or four', () => {
  assert.equal(MILLS.length, 16);
  assert.deepEqual(NEIGHBOURS[0].sort((a, b) => a - b), [1, 7]);
  assert.deepEqual(NEIGHBOURS[1].sort((a, b) => a - b), [0, 2, 9]);
  assert.deepEqual(NEIGHBOURS[9].sort((a, b) => a - b), [1, 8, 10, 17]);
  for (let p = 0; p < 24; p++) for (const q of NEIGHBOURS[p]) assert.ok(NEIGHBOURS[q].includes(p), p + '-' + q);
});

test('placing: a mill takes one of theirs (not one in a mill while others are free)', () => {
  const { game } = setup();
  game.onInput(1, { type: 'place', at: 0 }); // not their turn
  for (const at of [-1, 24, 1.5]) game.onInput(0, { type: 'place', at });
  assert.equal(game.inHand[0], 9);
  // 0 makes 0 1 2; 1 makes 8 9 and 20.
  for (const [a, b] of [[0, 8], [1, 9]]) { game.onInput(0, { type: 'place', at: a }); game.onInput(1, { type: 'place', at: b }); }
  game.onInput(0, { type: 'place', at: 2 });
  assert.equal(game.step, 'take');
  assert.deepEqual(game.mill, [0, 1, 2]);
  game.onInput(0, { type: 'take', at: 0 }); // its own
  game.onInput(0, { type: 'take', at: 8 });
  assert.equal(game.board[8], 0);
  assert.equal(game.turn, 1);
  const b = new Array(24).fill(0);
  [8, 9, 10, 20].forEach((p) => (b[p] = 2));
  assert.deepEqual(takeable(b, 2), [20], 'the one not in a mill');
  assert.ok(inMill(b, 9));
});

test('moving along a line; flying with three; fewer than three loses', () => {
  const { game } = setup();
  game.inHand = [0, 0];
  game.board = new Array(24).fill(0);
  [0, 3, 5, 10].forEach((p) => (game.board[p] = 1));
  [16, 18, 20].forEach((p) => (game.board[p] = 2));
  game.turn = 0;
  game.startTurn();
  assert.ok(actions(game.board, game.inHand, 0).every((a) => NEIGHBOURS[a.from].includes(a.to)), 'four: only along lines');
  assert.ok(actions(game.board, game.inHand, 1).some((a) => a.to === 4), 'three: flies anywhere');
  game.onInput(0, { type: 'move', from: 0, to: 4 }); // not a line
  game.onInput(0, { type: 'move', from: 5, to: 4 });
  assert.equal(game.board[4], 1);
  // Player 2 flies into a mill (16 17 18) and takes one; player 1 is then down to three.
  game.onInput(1, { type: 'move', from: 20, to: 17 });
  assert.equal(game.step, 'take');
  game.onInput(1, { type: 'take', at: 10 });
  assert.equal(game.count(0), 3);
  game.board = new Array(24).fill(0);
  [0, 1].forEach((p) => (game.board[p] = 1));
  [16, 17, 18].forEach((p) => (game.board[p] = 2));
  game.turn = 0;
  game.startTurn();
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.result, { winner: 1, how: 'pieces' });
});

test('no move at all loses; the clock plays for you; no timer waits', () => {
  const { game } = setup();
  game.inHand = [0, 0];
  game.board = new Array(24).fill(0);
  [0, 2, 6, 4].forEach((p) => (game.board[p] = 1));
  [1, 3, 5, 7, 8, 9].forEach((p) => (game.board[p] = 2));
  game.turn = 0;
  game.startTurn();
  assert.deepEqual(game.result, { winner: 1, how: 'blocked' });
  const t = setup();
  t.ctx.advance(TIMING.turnMs);
  assert.equal(t.game.inHand[0], 8);
  const off = setup({ timer: 'off' });
  off.ctx.advance(TIMING.turnMs * 3);
  assert.equal(off.game.inHand[0], 9);
});

test('the computer: makes a mill when it can and takes a piece', () => {
  const { game } = setup();
  game.board[0] = 1;
  game.board[1] = 1;
  game.board[8] = 2;
  game.board[9] = 2;
  game.inHand = [7, 7];
  const memory = {};
  const m = morrisBot(game.playerView(0), 'normal', Math.random, 0, memory);
  assert.deepEqual([m.type, m.at], ['place', 2]);
  game.onInput(0, { type: m.type, at: m.at });
  const t = morrisBot(game.playerView(0), 'normal', Math.random, 0, memory);
  assert.equal(t.type, 'take');
  assert.ok([8, 9].includes(t.at));
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  for (let seed = 1; seed <= 4; seed++) {
    const flip = seed % 2;
    const { view } = play('morris', flip ? ['easy', 'normal'] : ['normal', 'easy'], { seed });
    assert.equal(view.winner, flip ? 1 : 0, 'Normal beats Easy, seed ' + seed);
  }
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('morris', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
