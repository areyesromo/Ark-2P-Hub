import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { KenKen, SIZES, cageFits, countSolutions } from '../server/solo/games/kenken.js';

function game(size = 4, seed = 2) {
  const ctx = fakeCtx('Ana', { size });
  const g = new KenKen(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('cage rules: sums, products, differences and divisions either way round', () => {
  assert.ok(cageFits({ op: '+', target: 7, cells: [0, 1] }, [3, 4], true));
  assert.ok(cageFits({ op: '+', target: 7, cells: [0, 1, 2] }, [3], false));
  assert.equal(cageFits({ op: '+', target: 7, cells: [0, 1, 2] }, [3, 4], false), false, 'no room left for a third');
  assert.ok(cageFits({ op: '×', target: 12, cells: [0, 1] }, [3], false));
  assert.equal(cageFits({ op: '×', target: 12, cells: [0, 1] }, [5], false), false);
  assert.ok(cageFits({ op: '−', target: 2, cells: [0, 1] }, [1, 3], true));
  assert.ok(cageFits({ op: '÷', target: 2, cells: [0, 1] }, [2, 4], true));
  assert.equal(cageFits({ op: '÷', target: 2, cells: [0, 1] }, [3, 4], true), false);
});

test('every puzzle has one answer, its own solution, and every square is in one cage', () => {
  for (const n of SIZES) {
    for (const seed of [1, 2, 3]) {
      const { g } = game(n, seed);
      assert.equal(countSolutions(n, g.cageList), 1, `${n} ${seed}`);
      const cells = g.cageList.flatMap((c) => c.cells).sort((a, b) => a - b);
      assert.deepEqual(cells, [...Array(n * n).keys()]);
      for (const c of g.cageList) assert.ok(cageFits(c, c.cells.map((i) => g.solution[i]), true));
    }
  }
});

test('the answer stays hidden; clashes show; the right grid finishes it with the time', () => {
  const { ctx, g } = game();
  assert.equal(JSON.stringify(g.hostView()).includes('solution'), false);
  g.onInput({ type: 'set', cell: 0, value: 1 });
  g.onInput({ type: 'set', cell: 1, value: 1 });
  assert.deepEqual(g.hostView().clashes, [0, 1]);
  ctx.advance(90000);
  g.solution.forEach((v, i) => g.onInput({ type: 'set', cell: i, value: v }));
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 90000);
  assert.equal(v.variant, '4 × 4');
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
});

test('0 clears a square; bad input is ignored', () => {
  const { g } = game();
  g.onInput({ type: 'set', cell: 3, value: 2 });
  g.onInput({ type: 'set', cell: 3, value: 0 });
  assert.equal(g.grid[3], 0);
  for (const input of [{ type: 'set', cell: 3, value: 5 }, { type: 'set', cell: 16, value: 1 }, { type: 'set', cell: '3', value: 1 }, { type: 'select', cell: -1 }, { type: 'zap', cell: 0 }]) g.onInput(input);
  assert.equal(g.grid.filter(Boolean).length, 0);
  assert.equal(new KenKen(fakeCtx('Ana', { size: 9 })).n, 4);
});
