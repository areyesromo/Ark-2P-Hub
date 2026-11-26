import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Hashi, parseLevel, parOf, solveOf, HINT_PENALTY } from '../server/solo/games/hashi.js';
import { LEVELS } from '../server/solo/games/hashi-levels.js';
import { pairsOf, solveBridges, makeFair } from '../server/solo/games/hashi-gen.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

function game(board = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { board });
  const g = new Hashi(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('pairs: each island\'s nearest neighbour across and down; crossings found', () => {
  // 3 × 3: islands at the corners and the middle of the top and the left.
  const islands = [0, 2, 6, 8];
  const pairs = pairsOf(3, 3, islands);
  assert.equal(pairs.length, 4);
  const plus = pairsOf(3, 3, [1, 3, 5, 7]);
  assert.equal(plus.length, 2, 'across 3-5 and down 1-7');
  assert.deepEqual(plus[0].crosses, [1]);
});

test('every level has one answer, by reasoning alone; the boards grow', () => {
  let last = 0;
  LEVELS.forEach((rows, i) => {
    const b = parseLevel(rows);
    const pairs = pairsOf(b.w, b.h, b.islands);
    const stats = { guesses: 0 };
    assert.equal(solveBridges(b.islands, b.numbers, pairs, 2, stats).length, 1, `level ${i + 1}`);
    assert.equal(stats.guesses, 0, `level ${i + 1} needs no guess`);
    assert.ok(b.islands.length >= last);
    last = b.islands.length;
  });
  assert.ok(last >= 30);
});

test('random boards are fair too', () => {
  for (const [n, c] of [[7, 9], [10, 19], [13, 31]]) {
    const b = makeFair(n, n, c, seeded(n));
    const stats = { guesses: 0 };
    assert.equal(solveBridges(b.islands, b.numbers, pairsOf(n, n, b.islands), 2, stats).length, 1);
    assert.equal(stats.guesses, 0);
  }
});

test('bridges cycle none, one, two; never across another; the answer wins on the time', () => {
  const { ctx, g } = game(3);
  const answer = solveOf(g.islands, g.numbers, g.pairs);
  const p = g.pairs[0];
  g.onInput({ type: 'bridge', a: p.a, b: p.b });
  g.onInput({ type: 'bridge', a: p.b, b: p.a });
  assert.equal(g.bridges[0], 2);
  g.onInput({ type: 'bridge', a: p.a, b: p.b });
  assert.equal(g.bridges[0], 0);
  const crossing = g.pairs.findIndex((x) => x.crosses.length);
  if (crossing >= 0) {
    const other = g.pairs[g.pairs[crossing].crosses[0]];
    g.onInput({ type: 'bridge', a: g.pairs[crossing].a, b: g.pairs[crossing].b });
    g.onInput({ type: 'bridge', a: other.a, b: other.b });
    assert.equal(g.bridges[g.pairs[crossing].crosses[0]], 0, 'a crossing bridge is refused');
    g.onInput({ type: 'clear' });
  }
  for (const bad of [{ type: 'bridge', a: 0, b: 0 }, { type: 'bridge', a: 'x' }, { type: 'nope' }]) g.onInput(bad);
  assert.ok(g.bridges.every((v) => v === 0));
  ctx.advance(65000);
  answer.forEach((v, i) => { for (let k = 0; k < v; k++) g.onInput({ type: 'bridge', a: g.pairs[i].a, b: g.pairs[i].b }); });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 65000);
  assert.equal(v.par, parOf(g.islands.length));
  assert.equal(ctx.pendingTimers(), 0);
});

test('hints, undo and pause; levels open in turn', () => {
  const { ctx, g } = game('random10', 5);
  g.onInput({ type: 'hint' });
  assert.ok(g.bridges[g.hint] > 0);
  g.onInput({ type: 'undo' });
  for (let k = 0; k < 200 && g.phase === 'play'; k++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
  const p = game(1);
  p.ctx.advance(3000);
  p.g.onInput({ type: 'pause' });
  assert.deepEqual(p.g.hostView().islands, []);
  p.ctx.advance(9000);
  p.g.onInput({ type: 'pause' });
  assert.equal(p.g.hostView().elapsed, 3000);
  const def = SOLO_GAMES.find((x) => x.id === 'hashi');
  const c = fakeCtx('Ana');
  c.best = () => null;
  assert.match(lockedFor(c, def.spec).board[2], /Solve level 1/);
  assert.equal(lockedFor(c, def.spec).board.random7, undefined);
  void ctx;
});
