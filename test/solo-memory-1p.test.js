import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Memory, PEEK_MS, SIZES } from '../server/solo/games/memory-1p.js';

function game(size = 'small', seed = 5) {
  const ctx = fakeCtx('Ana', { size });
  const g = new Memory(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}
const pairOf = (g, i) => g.cards.findIndex((c, j) => j !== i && c === g.cards[i]);
const otherThan = (g, i) => g.cards.findIndex((c, j) => j !== i && c !== g.cards[i] && !g.matched[j]);

test('every card has exactly one partner; sizes and variants', () => {
  for (const size of Object.keys(SIZES)) {
    const { g } = game(size);
    const { w, h } = SIZES[size];
    assert.equal(g.cards.length, w * h);
    for (const c of g.cards) assert.equal(g.cards.filter((x) => x === c).length, 2);
    assert.equal(g.hostView().variant, `${w}×${h}`);
  }
});

test('face-down cards never show what they are', () => {
  const { g } = game();
  assert.ok(g.hostView().cards.every((c) => c === null));
  g.onInput({ type: 'flip', cell: 0 });
  const v = g.playerView();
  assert.equal(v.cards[0], g.cards[0]);
  assert.equal(v.cards.filter(Boolean).length, 1);
});

test('a pair stays up; two different cards turn back after a moment', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'flip', cell: 0 });
  g.onInput({ type: 'flip', cell: pairOf(g, 0) });
  assert.ok(g.matched[0]);
  assert.equal(g.tries, 1);
  const a = g.matched.findIndex((m) => !m);
  const b = otherThan(g, a);
  g.onInput({ type: 'flip', cell: a });
  g.onInput({ type: 'flip', cell: b });
  assert.deepEqual(g.up, [a, b]);
  assert.equal(g.lastMiss, 2);
  ctx.advance(PEEK_MS);
  assert.deepEqual(g.up, []);
  assert.deepEqual(g.hostView().cards.filter(Boolean).length, 2, 'only the pair shows');
});

test('a third card turns the two different ones back at once', () => {
  const { g } = game();
  const b = otherThan(g, 0);
  g.onInput({ type: 'flip', cell: 0 });
  g.onInput({ type: 'flip', cell: b });
  const c = g.cards.findIndex((_, j) => j !== 0 && j !== b);
  g.onInput({ type: 'flip', cell: c });
  assert.deepEqual(g.up, [c]);
});

test('finding every pair ends it; the score is the tries; the clock starts with the first card', () => {
  const { ctx, g } = game();
  ctx.advance(5000);
  // One miss first.
  g.onInput({ type: 'flip', cell: 0 });
  g.onInput({ type: 'flip', cell: otherThan(g, 0) });
  ctx.advance(PEEK_MS);
  for (let i = 0; i < g.cards.length; i++) {
    if (g.matched[i]) continue;
    g.onInput({ type: 'flip', cell: i });
    g.onInput({ type: 'flip', cell: pairOf(g, i) });
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 1 + g.cards.length / 2);
  assert.equal(v.elapsed, PEEK_MS);
  assert.equal(v.bestStreak, g.cards.length / 2);
  assert.equal(ctx.pendingTimers(), 0);
});

test('bad input is ignored', () => {
  const { g } = game();
  for (const input of [{ type: 'flip', cell: 16 }, { type: 'flip', cell: -1 }, { type: 'flip', cell: '0' }, { type: 'flip' }, { type: 'zap' }]) g.onInput(input);
  assert.deepEqual(g.up, []);
  g.onInput({ type: 'flip', cell: 3 });
  g.onInput({ type: 'flip', cell: 3 }); // the same card twice
  assert.deepEqual(g.up, [3]);
  assert.equal(new Memory(fakeCtx('Ana', { size: 'toString' })).size, 'small');
});
