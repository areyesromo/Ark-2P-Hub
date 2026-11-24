import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { DogPark, parseLevel, clashes, parOf, EMPTY, BALL, DOG, HINT_PENALTY, EXPERT_FROM } from '../server/solo/games/dogpark.js';
import { LEVELS } from '../server/solo/games/dogpark-levels.js';
import { makeBoard, countAnswers, answerOf } from '../server/solo/games/dogpark-gen.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id);
import { lockedFor } from '../server/solo/games/options.js';

function game(park = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { park });
  const g = new DogPark(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}
const solve = (g) => answerOf(g.n, g.regions);

test('every level has exactly one answer, the sizes climb, and Expert is 12 × 12 and up', () => {
  let last = 0;
  LEVELS.forEach((rows, i) => {
    const { n, regions } = parseLevel(rows);
    assert.ok(rows.every((r) => r.length === n), `level ${i + 1} is square`);
    // n areas, each in one piece of the park.
    assert.deepEqual([...new Set(regions.filter((a) => a >= 0))].sort((a, b) => a - b), [...Array(n).keys()], `level ${i + 1} areas`);
    assert.equal(countAnswers(n, regions, 2), 1, `level ${i + 1} has one answer`);
    assert.ok(n >= last, `level ${i + 1} isn't smaller than the one before`);
    last = n;
    if (i + 1 >= EXPERT_FROM) assert.ok(n >= 12, `level ${i + 1} is Expert`);
  });
  assert.equal(parseLevel(LEVELS[0]).n, 5);
  assert.ok(LEVELS.some((rows) => rows.join('').includes('#')), 'some levels have trees');
  assert.ok(LEVELS.some((rows) => rows.join('').includes('~')), 'some levels have water');
});

test('random parks have exactly one answer too, and it keeps every rule', () => {
  for (const n of [7, 9, 11]) {
    for (const seed of [1, 2, 3]) {
      const { regions, answer } = makeBoard(n, seeded(seed * 7 + n), { trees: n >= 9 ? 3 : 0 });
      assert.equal(countAnswers(n, regions, 2), 1, `${n} ${seed}`);
      const marks = regions.map((_, i) => (answer.includes(i) ? DOG : EMPTY));
      assert.deepEqual(clashes(n, regions, marks), []);
      assert.ok(answer.every((c) => regions[c] >= 0), 'no dog on a tree');
    }
  }
});

test('clashes: same row, same column, same area, and touching corners', () => {
  const n = 4;
  const regions = [0, 0, 1, 1, 2, 2, 1, 1, 2, 3, 3, 3, 2, 3, 3, 3];
  const marks = (cells) => regions.map((_, i) => (cells.includes(i) ? DOG : EMPTY));
  assert.deepEqual(clashes(n, regions, marks([0, 3])), [0, 3], 'same row');
  assert.deepEqual(clashes(n, regions, marks([1, 13])), [1, 13], 'same column');
  assert.deepEqual(clashes(n, regions, marks([2, 7])), [2, 7], 'same area (and touching)');
  assert.deepEqual(clashes(n, regions, marks([1, 6])), [1, 6], 'corner to corner');
  assert.deepEqual(clashes(n, regions, marks([1, 7])), [], 'two apart is fine');
});

test('the answer is never in a view; placing it wins and scores the time', () => {
  const { ctx, g } = game(4);
  const answer = solve(g);
  for (const v of [g.hostView(), g.playerView()]) {
    assert.equal(v.answer, undefined);
    assert.ok(v.marks.every((m) => m === EMPTY));
    assert.equal(v.variant, 'Level 4');
    assert.equal(v.par, parOf(v.n));
  }
  ctx.advance(42000);
  for (const c of answer.slice(1)) g.onInput({ type: 'mark', cell: c, mark: DOG });
  assert.equal(g.phase, 'play');
  g.onInput({ type: 'tap', cell: answer[0] }); // empty → ball
  g.onInput({ type: 'tap', cell: answer[0] }); // ball → dog
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, true);
  assert.equal(v.score, 42000);
  assert.equal(ctx.pendingTimers(), 0, 'the clock stops');
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.ok(g.marks.every((m) => m === EMPTY));
});

test('a hint fixes a wrong dog first, then a ball on a dog\'s square, then places a dog; each costs 30 s', () => {
  const { g } = game(8);
  const answer = new Set(solve(g));
  const wrong = g.regions.findIndex((a, i) => a >= 0 && !answer.has(i));
  const right = [...answer][0];
  g.onInput({ type: 'mark', cell: wrong, mark: DOG });
  g.onInput({ type: 'mark', cell: right, mark: BALL });
  g.onInput({ type: 'hint' });
  assert.equal(g.marks[wrong], BALL);
  assert.equal(g.hint, wrong);
  g.onInput({ type: 'hint' });
  assert.equal(g.marks[right], DOG);
  g.onInput({ type: 'hint' });
  assert.equal(g.marks.filter((m) => m === DOG).length, 2);
  assert.equal(g.hostView().hints, 3);
  assert.equal(g.hostView().elapsed, 3 * HINT_PENALTY);
  // Hints alone finish it.
  for (let i = 0; i < 20 && g.phase === 'play'; i++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
});

test('fill puts a ball on every square the dogs rule out, and one undo takes it back', () => {
  const { g } = game(3);
  const n = g.n;
  const dog = solve(g)[0];
  g.onInput({ type: 'mark', cell: dog, mark: DOG });
  g.onInput({ type: 'fill' });
  g.marks.forEach((m, i) => {
    if (i === dog) return;
    const dx = Math.abs((i % n) - (dog % n));
    const dy = Math.abs(Math.floor(i / n) - Math.floor(dog / n));
    const out = dx === 0 || dy === 0 || g.regions[i] === g.regions[dog] || (dx <= 1 && dy <= 1);
    assert.equal(m, out ? BALL : EMPTY, `square ${i}`);
  });
  g.onInput({ type: 'undo' });
  assert.equal(g.marks.filter((m) => m === BALL).length, 0);
  assert.equal(g.marks[dog], DOG);
  const steps = g.history.length;
  g.onInput({ type: 'fill' });
  g.onInput({ type: 'fill' }); // nothing new to fill: no extra undo step
  assert.equal(g.history.length, steps + 1);
});

test('undo, clear, and pause (which hides the park and stops the clock)', () => {
  const { ctx, g } = game(2);
  const cell = g.regions.findIndex((a) => a >= 0);
  g.onInput({ type: 'tap', cell });
  g.onInput({ type: 'tap', cell });
  assert.equal(g.marks[cell], DOG);
  g.onInput({ type: 'undo' });
  assert.equal(g.marks[cell], BALL);
  g.onInput({ type: 'clear' });
  assert.equal(g.marks[cell], EMPTY);
  g.onInput({ type: 'undo' });
  assert.equal(g.marks[cell], BALL, 'clearing can be undone');
  ctx.advance(5000);
  g.onInput({ type: 'pause' });
  const v = g.hostView();
  assert.equal(v.phase, 'paused');
  assert.ok(v.marks.every((m) => m === EMPTY) && v.regions.every((a) => a <= 0), 'nothing to study while paused');
  ctx.advance(60000);
  g.onInput({ type: 'tap', cell }); // ignored while paused
  g.onInput({ type: 'pause' });
  assert.equal(g.hostView().elapsed, 5000);
  assert.equal(g.marks[cell], BALL);
});

test('bad input is ignored: trees, water, off the park, wrong types', () => {
  const tree = LEVELS.findIndex((rows) => rows.join('').includes('#'));
  const { g } = game(tree + 1);
  const t = g.regions.indexOf(-1);
  const size = g.n * g.n;
  for (const input of [{ type: 'tap', cell: t }, { type: 'tap', cell: size }, { type: 'tap', cell: -1 }, { type: 'tap', cell: '3' }, { type: 'tap', cell: 1.5 }, { type: 'mark', cell: 0, mark: 3 }, { type: 'mark', cell: 0, mark: '2' }, { type: 'tap' }, { type: 'zap', cell: 0 }]) g.onInput(input);
  assert.ok(g.marks.every((m) => m === EMPTY));
  assert.equal(g.history.length, 0);
  assert.equal(new DogPark(fakeCtx('Ana', { park: 'toString' })).park, 1);
  assert.equal(new DogPark(fakeCtx('Ana', { park: 99 })).park, 1);
});

test('a random park is made fresh each time, and its size is the variant', () => {
  const { g } = game('random9', 5);
  assert.equal(g.n, 9);
  assert.equal(g.hostView().variant, 'Random 9 × 9');
  assert.equal(g.hostView().par, null);
  const first = g.regions.join();
  g.onInput({ type: 'pause' });
  g.phase = 'over';
  g.onInput({ type: 'rematch' });
  assert.notEqual(g.regions.join(), first);
});

test('levels open in turn; the random parks are open from the start', () => {
  const def = getGame('dogpark');
  const ctx = fakeCtx();
  ctx.achievements = () => ({});
  ctx.best = () => null;
  const locked = lockedFor(ctx, def.spec).park;
  assert.equal(locked[1], undefined);
  assert.match(locked[2], /Solve level 1/);
  assert.equal(locked.random9, undefined);
  ctx.best = (variant) => (variant === 'Level 1' ? 50000 : null);
  const now = lockedFor(ctx, def.spec).park;
  assert.equal(now[2], undefined);
  assert.match(now[3], /Solve level 2/);
});
