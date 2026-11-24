import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Sudoku, makePuzzle, solve, PEERS, LEVELS } from '../server/solo/games/sudoku.js';

test('every puzzle has exactly one solution, a valid one, with the clues it promises', () => {
  for (const level of Object.keys(LEVELS)) {
    for (let seed = 1; seed <= 5; seed++) {
      const { puzzle, solution } = makePuzzle(level, seeded(seed));
      assert.equal(solve(puzzle, 2), 1);
      for (let i = 0; i < 81; i++) {
        assert.ok(solution[i] >= 1 && solution[i] <= 9);
        assert.ok(PEERS[i].every((j) => solution[j] !== solution[i]));
        if (puzzle[i]) assert.equal(puzzle[i], solution[i]);
      }
      assert.ok(puzzle.filter(Boolean).length <= LEVELS[level].clues + 2);
    }
  }
});

function game(level = 'easy') {
  const ctx = fakeCtx('Ana', { level });
  const g = new Sudoku(ctx, seeded(4));
  g.start();
  return { ctx, g };
}

test('picking a cell shows on every screen; given cells can be picked but not changed', () => {
  const { g } = game();
  const given = g.given.indexOf(true);
  g.onInput({ type: 'select', cell: given });
  assert.equal(g.hostView().selected, given);
  g.onInput({ type: 'select', cell: 99 });
  assert.equal(g.playerView().selected, given);
});

test('the solution never goes to the screens', () => {
  const { g } = game();
  const v = JSON.stringify(g.hostView());
  assert.ok(!v.includes('solution'));
  assert.equal(g.hostView().score, null);
});

test('given numbers are fixed; clashes are shown; notes toggle and get rubbed out', () => {
  const { g } = game();
  const given = g.given.indexOf(true);
  g.onInput({ type: 'set', cell: given, n: 0 });
  assert.notEqual(g.grid[given], 0);
  const empty = g.grid.indexOf(0);
  const peerGiven = PEERS[empty].find((j) => g.given[j]);
  g.onInput({ type: 'set', cell: empty, n: g.grid[peerGiven] });
  assert.ok(g.hostView().clashes.includes(empty));
  g.onInput({ type: 'set', cell: empty, n: 0 });
  assert.equal(g.hostView().clashes.length, 0);
  const other = PEERS[empty].find((j) => !g.grid[j]);
  g.onInput({ type: 'note', cell: other, n: 5 });
  assert.equal(g.notes[other], 1 << 5);
  g.onInput({ type: 'set', cell: empty, n: 5 });
  assert.equal(g.notes[other], 0, 'placing a 5 rubs out the 5s around it');
  for (const bad of [{ type: 'set', cell: 81, n: 1 }, { type: 'set', cell: empty, n: 10 }, { type: 'note', cell: empty, n: 0 }, { type: 'set', cell: '3', n: 1 }]) g.onInput(bad);
});

test('filling it in correctly finishes the run; the time is the score; pause stops the clock', () => {
  const { ctx, g } = game();
  ctx.advance(5000);
  g.onInput({ type: 'pause' });
  assert.ok(g.hostView().grid.every((n) => n === 0), 'hidden while paused');
  ctx.advance(60000);
  g.onInput({ type: 'pause' });
  ctx.advance(5000);
  for (let i = 0; i < 81; i++) if (!g.given[i]) g.onInput({ type: 'set', cell: i, n: g.solution[i] });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 10000);
  assert.equal(v.variant, 'Easy');
  assert.equal(ctx.pendingTimers(), 0);
});
