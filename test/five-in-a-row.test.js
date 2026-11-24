import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FiveInARow, SIZE, TIMING, lineAt, capturesAt, nearCells } from '../server/games/five-in-a-row.js';
import { fiveInARowBot } from '../server/games/five-in-a-row-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

const at = (x, y) => y * SIZE + x;

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new FiveInARow(ctx, () => 0);
  game.start();
  return { ctx, game };
}

test('five in a line wins, any direction; four does not', () => {
  const b = new Array(SIZE * SIZE).fill(0);
  for (let i = 0; i < 4; i++) b[at(3 + i, 3 + i)] = 1;
  assert.equal(lineAt(b, at(3, 3)), null);
  b[at(7, 7)] = 1;
  assert.equal(lineAt(b, at(5, 5)).length, 5);
  const c = new Array(SIZE * SIZE).fill(0);
  for (let i = 0; i < 6; i++) c[at(i, 10)] = 2;
  assert.equal(lineAt(c, at(0, 10)).length, 6, 'six counts too');
  assert.deepEqual(nearCells(new Array(SIZE * SIZE).fill(0)), [112], 'an empty board: the middle');
});

test('turns, bad input, and the stone placed', () => {
  const { game } = setup();
  game.onInput(1, { type: 'place', cell: 0 }); // not their turn
  for (const cell of [-1, 225, 1.5, '3']) game.onInput(0, { type: 'place', cell });
  assert.equal(game.moves, 0);
  game.onInput(0, { type: 'place', cell: 112 });
  game.onInput(1, { type: 'place', cell: 112 }); // taken
  assert.equal(game.turn, 1);
  assert.equal(game.board[112], 1);
});

test('a line of five ends the game; who starts swaps; first to the games needed', () => {
  const { ctx, game } = setup({ wins: 2 });
  for (let i = 0; i < 4; i++) {
    game.onInput(0, { type: 'place', cell: at(2 + i, 2) });
    game.onInput(1, { type: 'place', cell: at(2 + i, 9) });
  }
  game.onInput(0, { type: 'place', cell: at(6, 2) });
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 0, how: 'five' });
  assert.equal(game.line.length, 5);
  ctx.advance(TIMING.gameEndMs);
  assert.equal(game.turn, 1, 'the other starts');
  game.scores = [1, 1];
  for (let i = 0; i < 4; i++) {
    game.onInput(1, { type: 'place', cell: at(2, 2 + i) });
    game.onInput(0, { type: 'place', cell: at(9, 2 + i) });
  }
  game.onInput(1, { type: 'place', cell: at(2, 6) });
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test('captures (an option): a stone either side of two of theirs takes them; five pairs wins', () => {
  const b = new Array(SIZE * SIZE).fill(0);
  b[at(0, 0)] = 1; b[at(1, 0)] = 2; b[at(2, 0)] = 2;
  assert.deepEqual(capturesAt(b, at(3, 0), 1).sort((x, y) => x - y), [at(1, 0), at(2, 0)]);
  const { game } = setup({ captures: 1 });
  game.board[at(0, 0)] = 1; game.board[at(1, 0)] = 2; game.board[at(2, 0)] = 2;
  game.taken = [4, 0];
  game.onInput(0, { type: 'place', cell: at(3, 0) });
  assert.equal(game.board[at(1, 0)], 0);
  assert.deepEqual(game.result, { winner: 0, how: 'captures' });
  const off = setup();
  off.game.board[at(0, 0)] = 1; off.game.board[at(1, 0)] = 2; off.game.board[at(2, 0)] = 2;
  off.game.onInput(0, { type: 'place', cell: at(3, 0) });
  assert.equal(off.game.board[at(1, 0)], 2, 'off: nothing taken');
});

test('the clock places a stone next to one already down; no timer waits', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'place', cell: 112 });
  ctx.advance(TIMING.turnMs);
  assert.equal(game.moves, 2);
  const placed = game.lastMove.cell;
  assert.ok(Math.abs((placed % SIZE) - 7) <= 1 && Math.abs(Math.floor(placed / SIZE) - 7) <= 1);
  const off = setup({ timer: 'off' });
  off.ctx.advance(TIMING.turnMs * 3);
  assert.equal(off.game.moves, 0);
});

test('the computer: wins when it can and stops your five', () => {
  const b = new Array(SIZE * SIZE).fill(0);
  for (let i = 0; i < 4; i++) b[at(3 + i, 5)] = 2; // its four: (2..7, 5) open
  for (let i = 0; i < 4; i++) b[at(3 + i, 9)] = 1; // yours too
  for (const level of ['easy', 'normal', 'hard']) {
    const m = fiveInARowBot({ phase: 'play', turn: 1, you: 1, board: b, round: 1 }, level, Math.random);
    assert.ok([at(2, 5), at(7, 5)].includes(m.cell), level + ' wins');
  }
  const d = new Array(SIZE * SIZE).fill(0);
  for (let i = 0; i < 4; i++) d[at(3 + i, 9)] = 1;
  d[at(2, 9)] = 2;
  d[at(8, 8)] = 2;
  for (const level of ['easy', 'normal', 'hard']) {
    const m = fiveInARowBot({ phase: 'play', turn: 1, you: 1, board: d, round: 1 }, level, Math.random);
    assert.equal(m.cell, at(7, 9), level + ' blocks');
  }
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let hard = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const flip = seed % 2;
    const { view } = play('five-in-a-row', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 6, 'Hard won ' + hard + ' of 8');
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('five-in-a-row', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
