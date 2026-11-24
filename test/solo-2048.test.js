import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Game2048, SIZE } from '../server/solo/games/2048.js';

/** A game with the board set from rows of numbers (0 = empty). rng 0.5: new tiles are 2s. */
function board(rows, rng = () => 0.5) {
  const ctx = fakeCtx();
  const g = new Game2048(ctx, rng);
  g.start();
  g.cells = rows.flat().map((v) => (v ? { id: g.nextId++, v } : null));
  return { ctx, g };
}
const values = (g) => Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => (g.at(x, y) ? g.at(x, y).v : 0)));

test('starts with two tiles', () => {
  const ctx = fakeCtx();
  const g = new Game2048(ctx);
  g.start();
  assert.equal(g.hostView().tiles.length, 2);
  assert.equal(g.phase, 'play');
});

test('merges each tile once, wall side first, and scores the merges', () => {
  const { g } = board([[2, 2, 2, 0], [4, 4, 4, 4], [2, 0, 0, 2], [0, 0, 0, 0]]);
  assert.equal(g.slide('left'), true);
  assert.deepEqual(values(g).slice(0, 3), [[4, 2, 0, 0], [8, 8, 0, 0], [4, 0, 0, 0]]);
  assert.equal(g.score, 4 + 8 + 8 + 4);
});

test('slides right and down too', () => {
  const { g } = board([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0]]);
  g.slide('right');
  assert.deepEqual(values(g)[0], [0, 0, 2, 4]);
  g.slide('down');
  assert.deepEqual(values(g)[2], [0, 0, 0, 4]);
  assert.deepEqual(values(g)[3], [0, 0, 2, 2]);
});

test('a move that changes nothing is ignored (no new tile)', () => {
  const { ctx, g } = board([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const before = ctx.updates;
  g.onInput({ type: 'move', dir: 'left' });
  assert.equal(g.moves, 0);
  assert.equal(ctx.updates, before);
  g.onInput({ type: 'move', dir: 'right' });
  assert.equal(g.moves, 1);
  assert.equal(g.hostView().tiles.length, 3);
});

test('the run is over when the last move leaves no move', () => {
  // Sliding left merges the two 8s; the new tile lands in the gap and nothing can move after that.
  const { g } = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 8, 8]]);
  g.onInput({ type: 'move', dir: 'left' });
  assert.deepEqual(values(g)[3], [4, 2, 16, 2]);
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, 16);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.score, 0);
});

test('give up ends a run that could go on', () => {
  const { g } = board([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(g.canMove(), true);
  g.onInput({ type: 'give-up' });
  assert.equal(g.phase, 'over');
});

test('bad input is ignored', () => {
  const { g } = board([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  for (const dir of ['nope', 'toString', undefined, 3]) g.onInput({ type: 'move', dir });
  assert.equal(g.moves, 0);
});
