import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Tango, parseLevel, clashes, parOf, solveOf, EMPTY, SUN, MOON, HINT_PENALTY } from '../server/solo/games/tango.js';
import { LEVELS } from '../server/solo/games/tango-levels.js';
import { makeBoard, countAnswers, lineSolve, patterns } from '../server/solo/games/tango-gen.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

function game(board = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { board });
  const g = new Tango(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('legal lines: half suns, half moons, never three alike', () => {
  assert.equal(patterns(6).length, 14);
  for (const p of patterns(8)) {
    assert.equal(p.filter((v) => v === SUN).length, 4);
    assert.ok(!p.some((v, i) => i >= 2 && v === p[i - 1] && v === p[i - 2]));
  }
});

test('every level has one answer, solves by line logic, and the sizes climb 6, 8, 10', () => {
  LEVELS.forEach((level, i) => {
    const { n, givens, signs } = parseLevel(level);
    assert.equal(n, i < 10 ? 6 : i < 20 ? 8 : 10, `level ${i + 1} size`);
    assert.ok(level.rows.every((r) => r.length === n));
    assert.ok(lineSolve(n, givens, signs).solved, `level ${i + 1} solves without a guess`);
    assert.equal(countAnswers(n, givens, signs), 1, `level ${i + 1} has one answer`);
    assert.ok(signs.every(([a, b]) => b === a + 1 ? a % n < n - 1 : b === a + n), `level ${i + 1} signs are between neighbours`);
  });
});

test('random boards have one answer too, and the answer keeps every rule', () => {
  for (const n of [6, 8, 10]) {
    for (const seed of [1, 2]) {
      const b = makeBoard(n, seeded(seed * 5 + n), { signs: n });
      assert.equal(countAnswers(n, b.givens, b.signs), 1);
      assert.deepEqual(clashes(n, b.answer, b.signs), []);
      b.givens.forEach((v, i) => v && assert.equal(v, b.answer[i]));
    }
  }
});

test('clashes: three alike, too many in a line, a sign not kept', () => {
  const n = 6;
  const m = new Array(36).fill(EMPTY);
  m[0] = m[1] = m[2] = SUN;
  assert.deepEqual(clashes(n, m, []), [0, 1, 2]);
  const row = new Array(36).fill(EMPTY);
  [0, 1, 3, 4].forEach((c) => (row[c] = MOON));
  assert.deepEqual(clashes(n, row, []), [0, 1, 3, 4], 'four moons in a row of six');
  const s = new Array(36).fill(EMPTY);
  s[0] = SUN;
  s[1] = MOON;
  assert.deepEqual(clashes(n, s, [[0, 1, '=']]), [0, 1]);
  assert.deepEqual(clashes(n, s, [[0, 1, 'x']]), []);
});

test('givens stay put; the answer is never in a view; filling it in wins on the time', () => {
  const { ctx, g } = game(4);
  const answer = solveOf(g.n, g.givens, g.signs);
  const given = g.givens.findIndex(Boolean);
  g.onInput({ type: 'tap', cell: given });
  assert.equal(g.marks[given], g.givens[given]);
  for (const v of [g.hostView(), g.playerView()]) {
    assert.equal(v.answer, undefined);
    assert.equal(v.variant, 'Level 4');
    assert.equal(v.par, parOf(6));
  }
  ctx.advance(61000);
  const open = answer.map((_, i) => i).filter((i) => !g.givens[i]);
  for (const c of open.slice(1)) g.onInput({ type: 'mark', cell: c, mark: answer[c] });
  assert.equal(g.phase, 'play');
  const last = open[0];
  g.onInput({ type: 'tap', cell: last });
  if (answer[last] === MOON) g.onInput({ type: 'tap', cell: last });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 61000);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.deepEqual(g.marks, g.givens);
});

test('a hint fixes a wrong square first, else fills one in; each costs 30 s; undo and clear', () => {
  const { g } = game(12);
  const answer = solveOf(g.n, g.givens, g.signs);
  const wrong = answer.findIndex((v, i) => !g.givens[i]);
  g.onInput({ type: 'mark', cell: wrong, mark: 3 - answer[wrong] });
  g.onInput({ type: 'hint' });
  assert.equal(g.marks[wrong], answer[wrong]);
  assert.equal(g.hint, wrong);
  g.onInput({ type: 'undo' });
  assert.equal(g.marks[wrong], 3 - answer[wrong]);
  g.onInput({ type: 'clear' });
  assert.deepEqual(g.marks, g.givens);
  for (let i = 0; i < 100 && g.phase === 'play'; i++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
  for (const bad of [{ type: 'tap', cell: -1 }, { type: 'mark', cell: 0, mark: 7 }, { type: 'nope' }]) g.onInput(bad);
});

test('pause hides the board and stops the clock; random boards; bad settings fall back to level 1', () => {
  const { ctx, g } = game('random10', 9);
  assert.equal(g.n, 10);
  assert.equal(g.hostView().variant, 'Random 10 × 10');
  ctx.advance(5000);
  g.onInput({ type: 'pause' });
  assert.ok(g.hostView().marks.every((m) => m === EMPTY) && g.hostView().signs.length === 0);
  ctx.advance(60000);
  g.onInput({ type: 'pause' });
  assert.equal(g.hostView().elapsed, 5000);
  assert.equal(game('level 99').g.board, 1);
});

test('levels open one by one; the random boards are open from the start', () => {
  const def = SOLO_GAMES.find((x) => x.id === 'tango');
  const ctx = fakeCtx('Ana');
  ctx.best = () => null;
  const locked = lockedFor(ctx, def.spec).board;
  assert.equal(locked[1], undefined);
  assert.match(locked[2], /Solve level 1/);
  assert.equal(locked.random8, undefined);
  ctx.best = (variant) => (variant === 'Level 1' ? 50000 : null);
  assert.equal(lockedFor(ctx, def.spec).board[2], undefined);
});
