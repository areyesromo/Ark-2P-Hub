import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hex, TIMING, chainFor, mirror } from '../server/games/hex.js';
import { hexBot } from '../server/games/hex-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Hex(ctx);
  g.start();
  return { ctx, g };
}

test('a chain edge to edge wins: player 1 top to bottom, player 2 left to right', () => {
  const n = 5;
  const b = new Array(n * n).fill(0);
  for (let y = 0; y < n; y++) b[y * n + 2] = 1; // straight down the middle column
  assert.equal(chainFor(b, n, 1).length, 5);
  assert.equal(chainFor(b, n, 2), null);
  // (x, y) touches (x + 1, y - 1) but not (x + 1, y + 1): one diagonal is a chain, the other isn't.
  const z = new Array(n * n).fill(0);
  for (let y = 0; y < n; y++) z[y * n + y] = 2;
  assert.equal(chainFor(z, n, 2), null);
  const a = new Array(n * n).fill(0);
  for (let y = 0; y < n; y++) a[y * n + (n - 1 - y)] = 2;
  assert.equal(chainFor(a, n, 2).length, 5);
});

test('placing, the swap rule, bad input, and a game won', () => {
  const { g } = setup({ size: 7, swap: 1 });
  assert.equal(g.turn, 0);
  g.onInput(1, { type: 'place', cell: 0 }); // not their turn
  g.onInput(0, { type: 'swap' }); // nothing to swap yet
  g.onInput(0, { type: 'place', cell: 7 * 1 + 4 }); // (4, 1)
  assert.equal(g.playerView(1).canSwap, true);
  g.onInput(1, { type: 'swap' });
  assert.equal(g.board[7 * 1 + 4], 0);
  assert.equal(g.board[mirror(7 + 4, 7)], 2, 'mirrored to (1, 4)');
  assert.equal(g.turn, 0);
  assert.equal(g.canSwap, false);
  for (const bad of [{ type: 'place', cell: -1 }, { type: 'place', cell: 49 }, { type: 'place', cell: 1.5 }, { type: 'place', cell: mirror(11, 7) }]) g.onInput(0, bad);
  assert.equal(g.turn, 0);
  // Player 1 runs down column 0 while player 2 dawdles along the bottom right.
  const theirs = [48, 47, 46, 45, 44, 41];
  for (let y = 0; y < 7; y++) {
    g.onInput(0, { type: 'place', cell: y * 7 });
    if (g.phase !== 'play') break;
    g.onInput(1, { type: 'place', cell: theirs[y] });
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  assert.equal(g.chain.length, 7);
});

test('out of time: a stone goes on a random empty hexagon', () => {
  const { ctx, g } = setup({ size: 7 });
  ctx.advance(TIMING.turnMs + 1000);
  assert.equal(g.board.filter(Boolean).length, 1);
  assert.equal(g.turn, 1);
});

test('the computer takes a winning hexagon, keeps its bridges, and Easy beats a player who leaves it to the clock', () => {
  const n = 7;
  const board = new Array(n * n).fill(0);
  for (let y = 0; y < n; y++) if (y !== 3) board[y * n + 3] = 1; // player 1's column, one gap
  for (let x = 0; x < n; x++) if (x !== 3) board[3 * n + x] = 2; // player 2's row, the same gap
  const v = { phase: 'play', turn: 0, you: 0, size: n, board, round: 1, lastMove: { cell: 0, by: 1, n: 12 }, canSwap: false };
  assert.equal(hexBot(v, 'hard', seeded(1)).cell, 3 * n + 3);
  // A bridge at (2, 2) and (3, 3) shares (3, 2) and (2, 3); they take one, we take the other.
  const b2 = new Array(n * n).fill(0);
  b2[2 * n + 2] = 1; b2[3 * n + 3] = 1; b2[2 * n + 3] = 2;
  const v2 = { phase: 'play', turn: 0, you: 0, size: n, board: b2, round: 1, lastMove: { cell: 2 * n + 3, by: 1, n: 3 }, canSwap: false };
  assert.equal(hexBot(v2, 'hard', seeded(2)).cell, 3 * n + 2);
  for (let seed = 1; seed <= 2; seed++) {
    const cpu = seed % 2;
    assert.equal(play('hex', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
