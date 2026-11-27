import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Go, TIMING, KOMI } from '../server/games/go.js';
import { neighboursOf, play, areaScore, removeDead, isEye } from '../server/games/go-engine.js';
import { goBot } from '../server/games/go-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play as playGame } from './helpers-bots.js';

const N = 9;
const nb = neighboursOf(N);
const at = (x, y) => y * N + x;

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Go(ctx, seeded(3));
  g.start();
  return { ctx, g };
}

test('captures, no suicide, and ko', () => {
  const b = new Int8Array(81);
  const out = { ko: -1 };
  // White at (1, 1) surrounded on three sides by black; black's fourth stone takes it.
  b[at(1, 1)] = 2;
  for (const c of [at(0, 1), at(2, 1), at(1, 0)]) b[c] = 1;
  assert.equal(play(b, nb, at(1, 2), 1, -1, out), 1);
  assert.equal(b[at(1, 1)], 0);
  // Playing back into (1, 1) as white is suicide.
  assert.equal(play(b, nb, at(1, 1), 2, -1, out), -1);
  // A ko: black takes one stone, and white may not take straight back.
  const k = new Int8Array(81);
  for (const [x, y, c] of [[1, 0, 1], [0, 1, 1], [1, 2, 1], [2, 0, 2], [3, 1, 2], [2, 2, 2], [2, 1, 1]]) k[at(x, y)] = c;
  assert.equal(play(k, nb, at(1, 1), 2, -1, out), 1, 'white takes the black stone at (2, 1)');
  assert.equal(out.ko, at(2, 1));
  assert.equal(play(k, nb, at(2, 1), 1, out.ko, out), -1, 'black may not take back at once');
});

test('eyes, and the count: stones plus the empty points only you surround', () => {
  const b = new Int8Array(81);
  for (let y = 0; y < N; y++) b[at(4, y)] = 1; // a black wall down the middle…
  for (let y = 0; y < N; y++) b[at(5, y)] = 2; // …and white's beside it
  const [black, white] = areaScore(b, N, nb);
  assert.equal(black, 45);
  assert.equal(white, 36);
  assert.equal(isEye(b, N, nb, at(0, 0), 1), false, 'a wide-open area isn\'t an eye');
  const e = new Int8Array(81);
  for (const c of [at(1, 0), at(0, 1), at(1, 1)]) e[c] = 1;
  assert.equal(isEye(e, N, nb, at(0, 0), 1), true);
});

test('dead stones come off before the count', () => {
  // As a game ends: black's side filled in but for its eyes, white's the same, and one white stone
  // left inside black's side with a single liberty.
  const b = new Array(81).fill(0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) b[at(x, y)] = x <= 4 ? 1 : 2;
  for (const [x, y] of [[2, 3], [0, 7], [7, 2], [6, 6], [8, 8]]) b[at(x, y)] = 0; // eyes
  b[at(1, 1)] = 2;
  b[at(1, 0)] = 0; // its one liberty
  const { board, dead } = removeDead(b, N, 1, seeded(5));
  assert.deepEqual(dead, [at(1, 1)]);
  assert.equal(board[at(1, 1)], 0);
});

test('a game: checked moves, out of time passes, two passes count, resigning ends it', () => {
  const { ctx, g } = setup({ wins: 2 });
  assert.equal(g.turn, g.black);
  const b = g.black;
  g.onInput(1 - b, { type: 'place', cell: 0 }); // not their turn
  g.onInput(b, { type: 'place', cell: 81 });
  g.onInput(b, { type: 'place', cell: 40 });
  g.onInput(1 - b, { type: 'place', cell: 40 }); // taken
  assert.equal(g.turn, 1 - b);
  ctx.advance(TIMING.turnMs);
  assert.equal(g.passes, 1);
  g.onInput(b, { type: 'pass' });
  assert.equal(g.phase, 'roundEnd');
  // One black stone on an empty board owns it all: 81 to 6.5.
  assert.equal(g.result.winner, b);
  assert.deepEqual(g.result.points[b], 81);
  assert.equal(g.result.points[1 - b], KOMI);
  ctx.advance(TIMING.gameEndMs);
  g.onInput(1 - b, { type: 'resign' });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, b, 'the first game, and the second by resignation');
});

test('the computer takes a stone in atari, and Easy beats a player who leaves it to the clock', () => {
  const board = new Array(81).fill(0);
  board[at(4, 4)] = 2;
  for (const c of [at(3, 4), at(5, 4), at(4, 3)]) board[c] = 1;
  const v = { phase: 'play', turn: 0, you: 0, black: 0, size: N, board, komi: KOMI, ko: -1, moves: 4, round: 1, lastMove: { by: 1, cell: 70, n: 4 } };
  assert.equal(goBot(v, 'hard', seeded(2)).cell, at(4, 5));
  for (const seed of [1, 2]) {
    const cpu = seed % 2;
    assert.equal(playGame('go', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
