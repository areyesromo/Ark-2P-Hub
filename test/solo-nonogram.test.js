import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Nonogram, runsOf, solveLine, lineSolvable, cluesOf, makePuzzle } from '../server/solo/games/nonogram.js';

function game(size = 5, seed = 3) {
  const ctx = fakeCtx('Ana', { size });
  const g = new Nonogram(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('runs of a line', () => {
  assert.deepEqual(runsOf([1, 1, 0, 1, 0, 0, 1, 1, 1].map(Boolean)), [2, 1, 3]);
  assert.deepEqual(runsOf([0, 0, 0].map(Boolean)), []);
});

test('the line solver finds what must be filled or empty', () => {
  // 4 in 5 cells: the middle three are certain.
  assert.deepEqual(solveLine([-1, -1, -1, -1, -1], [4]), [-1, 1, 1, 1, -1]);
  // 2 1 in 4 cells fits only one way.
  assert.deepEqual(solveLine([-1, -1, -1, -1], [2, 1]), [1, 1, 0, 1]);
  // An empty clue empties the line; a clue that can't fit is null.
  assert.deepEqual(solveLine([-1, -1, -1], []), [0, 0, 0]);
  assert.equal(solveLine([1, 1, 1], [1]), null);
  // Known cells narrow it down: a filled cell at the end anchors the run.
  assert.deepEqual(solveLine([-1, -1, -1, -1, 1], [2]), [0, 0, 0, 1, 1]);
});

test('a picture with two answers is not line solvable', () => {
  // A 2×2 checkerboard: rows [1],[1], columns [1],[1] fit two ways.
  const { rows, cols } = cluesOf(2, [true, false, false, true]);
  assert.equal(lineSolvable(2, rows, cols), false);
});

test('made puzzles are solvable and their clues match the picture', () => {
  for (const n of [5, 10, 15]) {
    const { picture, rows, cols } = makePuzzle(n, seeded(n));
    assert.equal(picture.length, n * n);
    assert.deepEqual(cluesOf(n, picture), { rows, cols });
    assert.ok(lineSolvable(n, rows, cols));
  }
});

test('the picture never goes out in a view, only the clues', () => {
  const { g } = game(10);
  const v = g.hostView();
  assert.equal(v.n, 10);
  assert.equal(v.rows.length, 10);
  assert.ok(v.cells.every((c) => c === 0));
  assert.equal(JSON.stringify(v).includes('picture'), false);
  assert.equal(v.variant, '10×10');
});

test('filling the picture solves it and scores the time; crosses do not matter', () => {
  const { ctx, g } = game(5);
  ctx.advance(12000);
  const cells = g.picture.map((on, i) => [on, i]);
  for (const [on, i] of cells) if (!on) g.onInput({ type: 'mark', cell: i, mark: 'cross' });
  for (const [, i] of cells.filter(([on]) => on).slice(0, -1)) g.onInput({ type: 'mark', cell: i, mark: 'fill' });
  assert.equal(g.phase, 'play');
  g.onInput({ type: 'mark', cell: cells.filter(([on]) => on).at(-1)[1], mark: 'fill' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, 12000);
  assert.equal(ctx.pendingTimers(), 0);
});

test('a line ticks off when its filled squares match the clue', () => {
  const { g } = game(5);
  const row = g.picture.slice(0, 5);
  row.forEach((on, c) => { if (on) g.onInput({ type: 'mark', cell: c, mark: 'fill' }); });
  assert.equal(g.hostView().rowsDone[0], true);
  g.onInput({ type: 'mark', cell: row.indexOf(true), mark: 'clear' });
  assert.equal(g.hostView().rowsDone[0], false);
});

test('pause hides the grid and stops the clock', () => {
  const { ctx, g } = game(5);
  g.onInput({ type: 'mark', cell: 0, mark: 'fill' });
  ctx.advance(1000);
  g.onInput({ type: 'pause' });
  assert.ok(g.hostView().cells.every((c) => c === 0));
  ctx.advance(60000);
  g.onInput({ type: 'pause' });
  assert.equal(g.hostView().elapsed, 1000);
  assert.equal(g.hostView().cells[0], 1);
});

test('bad input is ignored', () => {
  const { g } = game(5);
  for (const input of [{ type: 'mark', cell: 25, mark: 'fill' }, { type: 'mark', cell: 1.5, mark: 'fill' }, { type: 'mark', cell: 0, mark: 'toString' }, { type: 'mark', cell: 0 }, { type: 'select', cell: -1 }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.moves, 0);
  assert.ok(g.cells.every((c) => c === 0));
});

test('size comes from the setting, else 10', () => {
  assert.equal(game(15).g.n, 15);
  assert.equal(new Nonogram(fakeCtx('Ana', { size: 7 })).n, 10);
});
