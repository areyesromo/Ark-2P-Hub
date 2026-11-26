import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Slither, parseLevel, parOf, LINE, CROSS, EMPTY, HINT_PENALTY } from '../server/solo/games/slither.js';
import { LEVELS } from '../server/solo/games/slither-levels.js';
import { geometry, logicSolve, makeBoard, oneLoop, blob } from '../server/solo/games/slither-gen.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

function game(board = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { board });
  const g = new Slither(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('the lines: a 2 × 1 board has 7, and each square has four', () => {
  const geo = geometry(2, 1);
  assert.equal(geo.edges, 2 * 2 + 3);
  assert.deepEqual(geo.cellEdges[0], [0, 2, 4, 5]);
  assert.equal(geo.dotEdges.length, 6);
  // One square's outline is a loop; two separate bits of line aren't.
  const s = new Array(7).fill(0);
  [0, 2, 4, 5].forEach((e) => (s[e] = 1));
  assert.ok(oneLoop(geo, s));
  s[1] = 1;
  assert.ok(!oneLoop(geo, s));
});

test('a blob has no holes; every level and random board solves by reasoning alone', () => {
  const inside = blob(8, 8, seeded(2));
  assert.ok(inside.some(Boolean));
  LEVELS.forEach((rows, i) => {
    const b = parseLevel(rows);
    assert.ok(logicSolve(geometry(b.w, b.h), b.clues).solved, `level ${i + 1}`);
  });
  for (const n of [5, 7, 10]) {
    const b = makeBoard(n, n, seeded(n * 3));
    const geo = geometry(n, n);
    const r = logicSolve(geo, b.clues);
    assert.ok(r.solved);
    assert.deepEqual(r.lines, b.answer);
  }
});

test('tapping a line: line, ✕, clear; drawing the loop wins on the time', () => {
  const { ctx, g } = game(2);
  g.onInput({ type: 'tap', edge: 0 });
  assert.equal(g.marks[0], LINE);
  g.onInput({ type: 'tap', edge: 0 });
  assert.equal(g.marks[0], CROSS);
  g.onInput({ type: 'tap', edge: 0 });
  assert.equal(g.marks[0], EMPTY);
  g.onInput({ type: 'tap', edge: 0 });
  g.onInput({ type: 'tap', edge: 0, back: true });
  assert.equal(g.marks[0], EMPTY);
  for (const bad of [{ type: 'tap', edge: -1 }, { type: 'mark', edge: 0, mark: 7 }, { type: 'nope' }]) g.onInput(bad);
  const answer = logicSolve(g.geo, g.clues).lines;
  ctx.advance(52000);
  answer.forEach((on, e) => on && g.onInput({ type: 'mark', edge: e, mark: LINE }));
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 52000);
  assert.equal(v.par, parOf(5, 5));
  assert.equal(ctx.pendingTimers(), 0);
});

test('clashes, undo, clear and hints (a wrong line first; 30 s each)', () => {
  const { g } = game(8);
  const answer = logicSolve(g.geo, g.clues).lines;
  const wrong = answer.findIndex((on) => !on);
  g.onInput({ type: 'mark', edge: wrong, mark: LINE });
  g.onInput({ type: 'hint' });
  assert.equal(g.marks[wrong], EMPTY);
  g.onInput({ type: 'undo' });
  assert.equal(g.marks[wrong], LINE);
  g.onInput({ type: 'clear' });
  assert.ok(g.marks.every((m) => m === EMPTY));
  // A dot with three lines is a clash.
  const d = g.geo.dotEdges.findIndex((es) => es.length === 4);
  g.geo.dotEdges[d].slice(0, 3).forEach((e) => g.onInput({ type: 'mark', edge: e, mark: LINE }));
  assert.ok(g.clashes().dots.includes(d));
  g.onInput({ type: 'clear' });
  for (let k = 0; k < 300 && g.phase === 'play'; k++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
});

test('pause hides the board; random boards; levels open in turn', () => {
  const { ctx, g } = game('random10', 4);
  assert.equal(g.hostView().variant, 'Random 10 × 10');
  ctx.advance(2000);
  g.onInput({ type: 'pause' });
  assert.ok(g.hostView().clues.every((k) => k < 0));
  ctx.advance(8000);
  g.onInput({ type: 'pause' });
  assert.equal(g.hostView().elapsed, 2000);
  const def = SOLO_GAMES.find((x) => x.id === 'slither');
  const c = fakeCtx('Ana');
  c.best = () => null;
  assert.match(lockedFor(c, def.spec).board[2], /Solve level 1/);
  assert.equal(lockedFor(c, def.spec).board.random5, undefined);
});
