import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MineDuel, SIZE, MINES, NEED, MINE, TIMING, neighbours } from '../server/games/mine-duel.js';
import { mineDuelBot } from '../server/games/mine-duel-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

const at = (x, y) => y * SIZE + x;

/** A game with mines exactly at `mines`. */
function setup(mines, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new MineDuel(ctx, () => 0.3);
  game.start();
  if (mines) {
    game.mines = mines.slice().sort((a, b) => a - b);
    game.counts = new Array(SIZE * SIZE).fill(0);
    for (const m of game.mines) for (const n of neighbours(m)) game.counts[n]++;
  }
  return { ctx, game };
}

test('a fresh field: 25 mines, all covered, and the view gives none of them away', () => {
  const { game } = setup();
  assert.equal(game.mines.length, MINES);
  assert.equal(new Set(game.mines).size, MINES);
  const v = game.playerView(1);
  assert.ok(v.board.every((c) => c === null));
  assert.ok(!('mines' in v && Array.isArray(v.mines)), 'only the count');
  assert.equal(NEED, 13);
  assert.equal(neighbours(at(0, 0)).length, 3);
  assert.equal(neighbours(at(5, 5)).length, 8);
});

test('a mine is yours and you go again; a safe square shows its number and the turn passes', () => {
  const { game } = setup([at(0, 0), at(2, 0)]);
  game.onInput(1, { type: 'dig', cell: at(5, 5) }); // not their turn
  assert.equal(game.board[at(5, 5)], null);
  game.onInput(0, { type: 'dig', cell: at(0, 0) });
  assert.equal(game.board[at(0, 0)], MINE + 0);
  assert.deepEqual(game.found, [1, 0]);
  assert.equal(game.turn, 0, 'again');
  game.onInput(0, { type: 'dig', cell: at(1, 0) });
  assert.equal(game.board[at(1, 0)], 2);
  assert.equal(game.turn, 1);
  game.onInput(1, { type: 'dig', cell: at(1, 0) }); // already open
  for (const cell of [-1, 144, 1.5, '3', null]) game.onInput(1, { type: 'dig', cell });
  assert.equal(game.turn, 1);
});

test('an empty square opens its neighbours, on and on', () => {
  const { game } = setup([at(11, 11)]);
  game.onInput(0, { type: 'dig', cell: at(0, 0) });
  const open = game.board.filter((v) => v !== null).length;
  assert.equal(open, SIZE * SIZE - 1, 'everything but the mine');
  assert.equal(game.board[at(10, 10)], 1);
  assert.equal(game.lastMove.opened.length, open);
});

test('more than half the mines wins; unfound mines show at the end; first to the wins needed', () => {
  const mines = [];
  for (let i = 0; i < MINES; i++) mines.push(i); // the first rows
  const { ctx, game } = setup(mines, { wins: 2 });
  for (let i = 0; i < NEED - 1; i++) game.onInput(0, { type: 'dig', cell: i });
  assert.equal(game.phase, 'play');
  game.onInput(0, { type: 'dig', cell: NEED - 1 });
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 0, found: [NEED, 0] });
  assert.equal(game.hostView().board[NEED], MINE + 2, 'the rest are shown');
  ctx.advance(TIMING.roundEndMs);
  assert.equal(game.turn, 1, 'the other starts the next');
  game.mines = mines.slice();
  for (let i = 0; i < NEED; i++) game.onInput(1, { type: 'dig', cell: i });
  ctx.advance(TIMING.roundEndMs);
  game.mines = mines.slice();
  for (let i = 0; i < NEED; i++) game.onInput(0, { type: 'dig', cell: i });
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  game.onInput(1, { type: 'rematch' });
  assert.deepEqual(game.scores, [0, 0]);
});

test('the clock digs a random square for you; with no timer it waits', () => {
  const { ctx, game } = setup();
  ctx.advance(TIMING.turnMs);
  assert.equal(game.moveNo, 1);
  const off = setup(null, { timer: 'off' });
  off.ctx.advance(TIMING.turnMs * 4);
  assert.equal(off.game.moveNo, 0);
});

test('the computer digs up a mine it can be sure of', () => {
  // A 1 in the corner with one covered square beside it: that's the mine.
  const board = new Array(SIZE * SIZE).fill(0);
  board[at(0, 0)] = null;
  board[at(1, 0)] = 1;
  board[at(0, 1)] = 1;
  board[at(1, 1)] = 1;
  for (const level of ['normal', 'hard']) {
    const m = mineDuelBot({ phase: 'play', turn: 0, you: 0, board, mines: MINES, found: [0, 0] }, level, Math.random);
    assert.equal(m.cell, at(0, 0), level);
  }
  assert.equal(mineDuelBot({ phase: 'play', turn: 1, you: 0, board, mines: MINES, found: [0, 0] }, 'hard'), null);
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let hard = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const flip = seed % 2;
    const { view } = play('mine-duel', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 5, 'Hard won ' + hard + ' of 6');
  for (let seed = 1; seed <= 8; seed++) {
    const cpu = seed % 2;
    const { view } = play('mine-duel', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
