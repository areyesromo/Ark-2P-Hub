import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Gems, SIZE, MOVES, POINTS } from '../server/solo/games/gems.js';

function game(seed = 4) {
  const ctx = fakeCtx();
  const g = new Gems(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** A board with no lines: colours repeat in a pattern that never lines up three. */
function quiet() {
  const b = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) b.push(((x % 2) + 2 * (y % 2) + 2 * Math.floor(x / 2) + Math.floor(y / 2)) % 4);
  return b;
}

test('a fresh board has no lines and at least one move', () => {
  for (let s = 1; s < 10; s++) {
    const { g } = game(s);
    assert.equal(g.lines(g.board).length, 0);
    assert.equal(g.hasMove(g.board), true);
  }
});

test('a swap that makes no line is turned back; far swaps are ignored', () => {
  const { g } = game();
  const b = g.board.slice();
  let pair = null;
  for (let i = 0; i < SIZE * SIZE - 1 && !pair; i++) {
    const t = b.slice();
    [t[i], t[i + 1]] = [t[i + 1], t[i]];
    if ((i + 1) % SIZE && !g.lines(t).length) pair = [i, i + 1];
  }
  g.onInput({ type: 'swap', a: pair[0], b: pair[1] });
  assert.deepEqual(g.board, b);
  assert.equal(g.nope, 1);
  assert.equal(g.movesLeft, MOVES);
  g.onInput({ type: 'swap', a: 0, b: 2 });
  g.onInput({ type: 'swap', a: -1, b: 0 });
  assert.equal(g.movesLeft, MOVES);
});

test('a line clears, scores, falls and refills; chains score more', () => {
  const { g } = game();
  g.board = quiet();
  // Row 0: two 5s, then a 5 one row down at column 2: swapping it up makes a line of three.
  g.board[0] = 5;
  g.board[1] = 5;
  g.board[SIZE + 2] = 5;
  g.onInput({ type: 'swap', a: 2, b: SIZE + 2 });
  assert.equal(g.movesLeft, MOVES - 1);
  assert.ok(g.score >= 3 * POINTS.gem);
  assert.equal(g.last.steps[0].cleared.length >= 3, true);
  assert.ok(g.board.every((c) => c !== null && c >= 0));
  assert.ok(g.bestChain >= 1);
});

test('30 swaps and it\'s over', () => {
  const { g } = game();
  g.movesLeft = 1;
  for (let i = 0; i < SIZE * SIZE && g.phase === 'play'; i++) {
    for (const j of [i + 1, i + SIZE]) {
      if (g.phase !== 'play' || j >= SIZE * SIZE || !g.adjacent(i, j)) continue;
      g.onInput({ type: 'swap', a: i, b: j });
    }
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.score);
  g.onInput({ type: 'rematch' });
  assert.equal(g.movesLeft, MOVES);
});
