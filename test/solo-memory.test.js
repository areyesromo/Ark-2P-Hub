// Memory Pairs, the 1 player mode of Memory Match (it was 1P's Memory Pairs): server/games/memory-match.js, soloMemory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { MemoryMatch, soloMemory, PEEK_MS, SIZES } from '../server/games/memory-match.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

function game(size = 'small', seed = 5) {
  const ctx = fakeCtx('Ana', { size });
  const g = new MemoryMatch(ctx, seeded(seed), { solo: true });
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
  g.onInput(0, { type: 'flip', cell: 0 });
  const v = g.playerView();
  assert.equal(v.cards[0], g.cards[0]);
  assert.equal(v.cards.filter(Boolean).length, 1);
});

test('a pair stays up; two different cards turn back after a moment', () => {
  const { ctx, g } = game();
  g.onInput(0, { type: 'flip', cell: 0 });
  g.onInput(0, { type: 'flip', cell: pairOf(g, 0) });
  assert.ok(g.matched[0]);
  assert.equal(g.tries, 1);
  const a = g.matched.findIndex((m) => !m);
  const b = otherThan(g, a);
  g.onInput(0, { type: 'flip', cell: a });
  g.onInput(0, { type: 'flip', cell: b });
  assert.deepEqual(g.up, [a, b]);
  assert.equal(g.lastMiss, 2);
  ctx.advance(PEEK_MS);
  assert.deepEqual(g.up, []);
  assert.deepEqual(g.hostView().cards.filter(Boolean).length, 2, 'only the pair shows');
});

test('a third card turns the two different ones back at once', () => {
  const { g } = game();
  const b = otherThan(g, 0);
  g.onInput(0, { type: 'flip', cell: 0 });
  g.onInput(0, { type: 'flip', cell: b });
  const c = g.cards.findIndex((_, j) => j !== 0 && j !== b);
  g.onInput(0, { type: 'flip', cell: c });
  assert.deepEqual(g.up, [c]);
});

test('finding every pair ends it; the score is the tries; the clock starts with the first card', () => {
  const { ctx, g } = game();
  ctx.advance(5000);
  // One miss first.
  g.onInput(0, { type: 'flip', cell: 0 });
  g.onInput(0, { type: 'flip', cell: otherThan(g, 0) });
  ctx.advance(PEEK_MS);
  for (let i = 0; i < g.cards.length; i++) {
    if (g.matched[i]) continue;
    g.onInput(0, { type: 'flip', cell: i });
    g.onInput(0, { type: 'flip', cell: pairOf(g, i) });
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
  for (const input of [{ type: 'flip', cell: 16 }, { type: 'flip', cell: -1 }, { type: 'flip', cell: '0' }, { type: 'flip' }, { type: 'zap' }]) g.onInput(0, input);
  assert.deepEqual(g.up, []);
  g.onInput(0, { type: 'flip', cell: 3 });
  g.onInput(0, { type: 'flip', cell: 3 }); // the same card twice
  assert.deepEqual(g.up, [3]);
  assert.equal(new MemoryMatch(fakeCtx('Ana', { size: 'toString' }), Math.random, { solo: true }).size, 'small');
});

test('one game in both lobbies: Memory Match and Memory Pairs, under one id; the looks pick its themes', () => {
  assert.equal(getGame('memory-match').name, 'Memory Match');
  assert.equal(soloGameOf('memory-match').name, 'Memory Pairs');
  const run = soloMemory.create(Object.assign(fakeCtx('Ana', { size: 'small', look: 'food' }), { rng: seeded(2) }));
  run.start();
  assert.equal(run.game.look, 'food');
  assert.ok(run.game.cards.every((c) => ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍉', '🍋', '🥕', '🌽', '🍕', '🍔', '🌭', '🍟', '🍩', '🍪', '🧁', '🍦', '🥨', '🧀', '🥐', '🍣', '🌮'].includes(c)));
  run.onInput({ type: 'flip', cell: 0 });
  assert.equal(run.playerView().up.length, 1);
  run.game.onInput(1, { type: 'flip', cell: 1 }); // (nobody else's)
  assert.equal(run.playerView().up.length, 1);
  assert.ok(!listGames().some((g) => g.id === 'memory-1p'), 'Memory Pairs 1P is gone');
});

test('the 1 player Memory Pairs is in the lobby itself, not in the 2 player lobby\'s Cards folder', () => {
  const [duo, solo] = listGames().filter((g) => g.id === 'memory-match').sort((a, b) => a.solo - b.solo);
  assert.equal(duo.folder, 'cards');
  assert.equal(solo.folder, null);
});
