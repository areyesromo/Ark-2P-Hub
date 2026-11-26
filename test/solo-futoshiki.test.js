import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Futoshiki, makePuzzle, countAnswers, latin, HINT_PENALTY } from '../server/solo/games/futoshiki.js';

function game(size = 5, seed = 3) {
  const ctx = fakeCtx('Ana', { size });
  const g = new Futoshiki(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('a Latin square has every number once per row and column', () => {
  const n = 6;
  const g = latin(n, seeded(4));
  for (let r = 0; r < n; r++) assert.equal(new Set(g.slice(r * n, r * n + n)).size, n);
  for (let c = 0; c < n; c++) assert.equal(new Set([...Array(n).keys()].map((r) => g[r * n + c])).size, n);
});

test('every puzzle has exactly one answer, and its signs and givens fit it', () => {
  for (const n of [4, 5, 6, 7]) {
    const p = makePuzzle(n, seeded(n * 11));
    assert.equal(countAnswers(n, p.givens, p.signs), 1, `${n}`);
    p.signs.forEach(([a, b]) => assert.ok(p.answer[a] < p.answer[b]));
    p.givens.forEach((v, i) => v && assert.equal(v, p.answer[i]));
    const out = [];
    countAnswers(n, p.givens, p.signs, 1, out);
    assert.deepEqual(out, p.answer);
  }
});

test('numbers, pencil marks (rubbed out along the row and column), clashes and signs', () => {
  const { g } = game(5);
  const n = 5;
  const open = g.givens.map((v, i) => i).filter((i) => !g.givens[i]);
  const [a, b] = open.filter((i) => Math.floor(i / n) === Math.floor(open[0] / n)).slice(0, 2);
  g.onInput({ type: 'note', cell: b, value: 3 });
  assert.equal(g.notes[b], 1 << 3);
  g.onInput({ type: 'set', cell: a, value: 3 });
  assert.equal(g.notes[b], 0, 'a 3 in the row rubs out the 3');
  g.onInput({ type: 'set', cell: b, value: 3 });
  assert.ok(g.clashes().includes(a) && g.clashes().includes(b));
  const given = g.givens.findIndex(Boolean);
  if (given >= 0) {
    g.onInput({ type: 'set', cell: given, value: 1 });
    assert.equal(g.grid[given], g.givens[given], 'givens stay');
  }
  g.onInput({ type: 'undo' });
  assert.equal(g.grid[b], 0);
  g.onInput({ type: 'clear' });
  assert.deepEqual(g.grid, g.givens);
  for (const bad of [{ type: 'set', cell: 0, value: 9 }, { type: 'set', cell: 99, value: 1 }, { type: 'note', cell: a, value: 0 }, { type: 'nope' }]) g.onInput(bad);
  assert.deepEqual(g.grid, g.givens);
});

test('filling in the answer wins on the time; the answer is never in a view', () => {
  const { ctx, g } = game(4);
  ctx.advance(80000);
  g.answer.forEach((v, i) => !g.givens[i] && g.onInput({ type: 'set', cell: i, value: v }));
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 80000);
  assert.equal(v.answer, undefined);
  assert.equal(v.variant, '4 × 4');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
});

test('hints put a wrong number right first, then fill squares in; 30 s each; pause hides the grid', () => {
  const { ctx, g } = game(6);
  const i = g.givens.findIndex((v) => !v);
  g.onInput({ type: 'set', cell: i, value: (g.answer[i] % 6) + 1 });
  g.onInput({ type: 'hint' });
  assert.equal(g.grid[i], g.answer[i]);
  for (let k = 0; k < 40 && g.phase === 'play'; k++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
  const p = game(7);
  p.ctx.advance(1000);
  p.g.onInput({ type: 'pause' });
  assert.ok(p.g.hostView().grid.every((v) => v === 0) && p.g.hostView().signs.length === 0);
  p.ctx.advance(5000);
  p.g.onInput({ type: 'pause' });
  assert.equal(p.g.hostView().elapsed, 1000);
  void ctx;
});
