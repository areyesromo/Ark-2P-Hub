import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Zip, parseLevel, parOf, HINT_PENALTY } from '../server/solo/games/zip.js';
import { LEVELS } from '../server/solo/games/zip-levels.js';
import { makeBoard, findAnswers, randomPath, keepsOrder, stepsFrom, wallKey } from '../server/solo/games/zip-gen.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

function game(board = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { board });
  const g = new Zip(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}
const answerOf = (g) => findAnswers(g.n, g.numberAt, g.wallSet, 1)[0];

test('a random path covers every square once, a step at a time', () => {
  for (const n of [5, 7]) {
    const p = randomPath(n, seeded(n));
    assert.equal(new Set(p).size, n * n);
    p.forEach((c, i) => i && assert.ok(stepsFrom(n, p[i - 1], null).includes(c)));
  }
});

test('every level has exactly one answer, numbered from 1, and the sizes climb', () => {
  let last = 0;
  LEVELS.forEach((level, i) => {
    const { n, numbers, walls } = parseLevel(level);
    assert.ok(n >= last && n >= 5 && n <= 8, `level ${i + 1} size`);
    last = n;
    const ws = new Set(walls.map(([a, b]) => wallKey(a, b)));
    walls.forEach(([a, b]) => assert.ok(stepsFrom(n, a, null).includes(b), `level ${i + 1} wall between neighbours`));
    assert.equal(findAnswers(n, new Map(numbers), ws, 2).length, 1, `level ${i + 1} has one answer`);
  });
  assert.ok(LEVELS.slice(-4).every((l) => l.n === 8 && l.walls));
});

test('random boards have one answer, and it meets the numbers in order', () => {
  for (const n of [6, 7]) {
    const b = makeBoard(n, seeded(n * 3), { walls: 3 });
    const nums = new Map(b.numbers);
    const ws = new Set(b.walls.map(([a, c]) => wallKey(a, c)));
    assert.equal(findAnswers(n, nums, ws, 2).length, 1);
    assert.ok(keepsOrder(b.answer, nums));
    assert.equal(b.answer[0], b.numbers[0][0]);
    assert.equal(b.answer.at(-1), b.numbers.at(-1)[0]);
  }
});

test('the path: one step at a time, numbers in order, never through a wall; back over it takes it back', () => {
  const { g } = game(5);
  const start = g.path[0];
  assert.equal(g.numberAt.get(start), 1);
  const far = (start + 2 * g.n) % (g.n * g.n);
  g.onInput({ type: 'to', cell: far });
  assert.equal(g.path.length, 1, 'not next to it');
  const answer = answerOf(g);
  for (const c of answer.slice(1, 6)) g.onInput({ type: 'to', cell: c });
  assert.deepEqual(g.path, answer.slice(0, 6));
  g.onInput({ type: 'to', cell: answer[2] });
  assert.deepEqual(g.path, answer.slice(0, 3), 'dragged back');
  g.onInput({ type: 'back' });
  assert.equal(g.path.length, 2);
  g.onInput({ type: 'clear' });
  assert.equal(g.path.length, 1);
  // A number out of order is refused.
  const three = g.numbers[2] && g.numbers[2][0];
  const nextTo = (c) => stepsFrom(g.n, start, g.wallSet).includes(c);
  if (three !== undefined && nextTo(three)) {
    g.onInput({ type: 'to', cell: three });
    assert.equal(g.path.length, 1);
  }
  for (const bad of [{ type: 'to', cell: -1 }, { type: 'to', cell: 'x' }, { type: 'nope' }]) g.onInput(bad);
  assert.equal(g.path.length, 1);
  // Walls.
  const { g: w } = game(30);
  const [a, b] = w.walls[0];
  assert.ok(!stepsFrom(w.n, a, w.wallSet).includes(b));
});

test('covering every square ends it and scores the time; the end number goes no further', () => {
  const { ctx, g } = game(2);
  const answer = answerOf(g);
  ctx.advance(33000);
  for (const c of answer.slice(1)) g.onInput({ type: 'to', cell: c });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 33000);
  assert.equal(v.par, parOf(5));
  assert.equal(v.answer, undefined);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.path.length, 1);
});

test('a hint takes the path back to where it went wrong and adds the right next square; 30 s each', () => {
  const { g } = game(12);
  const answer = answerOf(g);
  for (const c of answer.slice(1, 4)) g.onInput({ type: 'to', cell: c });
  // Wander off the answer if there's a way.
  const off = stepsFrom(g.n, answer[3], g.wallSet).find((c) => c !== answer[4] && !g.path.includes(c) && !g.numberAt.has(c));
  if (off !== undefined) g.onInput({ type: 'to', cell: off });
  g.onInput({ type: 'hint' });
  assert.deepEqual(g.path, answer.slice(0, 5));
  for (let i = 0; i < 100 && g.phase === 'play'; i++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
});

test('pause hides the board and stops the clock; random boards; levels open in turn', () => {
  const { ctx, g } = game('random7', 4);
  assert.equal(g.n, 7);
  ctx.advance(4000);
  g.onInput({ type: 'pause' });
  assert.deepEqual(g.hostView().numbers, []);
  ctx.advance(30000);
  g.onInput({ type: 'pause' });
  assert.equal(g.hostView().elapsed, 4000);
  const def = SOLO_GAMES.find((x) => x.id === 'zip');
  const c = fakeCtx('Ana');
  c.best = () => null;
  assert.match(lockedFor(c, def.spec).board[2], /Solve level 1/);
  assert.equal(lockedFor(c, def.spec).board.random6, undefined);
});
