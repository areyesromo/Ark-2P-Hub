import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { WordSearch, SIZES } from '../server/solo/games/wordsearch-1p.js';
import { WORDS } from '../server/solo/games/word-search-words.js';

function game(size = 'small', seed = 4) {
  const ctx = fakeCtx('Ana', { size });
  const g = new WordSearch(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('every word fits the smallest grid; each grid hides the right number, readable where they say', () => {
  assert.ok(WORDS.every((w) => /^[a-z]{3,8}$/.test(w)));
  for (const size of Object.keys(SIZES)) {
    for (const seed of [1, 2, 3]) {
      const { g } = game(size, seed);
      assert.equal(g.placed.length, SIZES[size].words);
      assert.equal(g.grid.length, SIZES[size].n ** 2);
      for (const p of g.placed) assert.equal(g.read(p.a, p.b), p.word, `${size} ${p.word}`);
    }
  }
});

test('only lines across, down and diagonal read', () => {
  const { g } = game('large');
  assert.equal(g.read(0, 0), null);
  assert.equal(g.read(0, 13).length, 2); // one down and right on a 12-wide grid: a diagonal
  assert.equal(g.read(0, 14), null, 'not a straight line');
  assert.equal(g.read(0, 11).length, 12);
});

test('where the words are stays hidden until they are found', () => {
  const { g } = game();
  const v = g.hostView();
  assert.deepEqual(v.found, []);
  assert.equal(JSON.stringify(v).includes('"a":' + g.placed[0].a + ',"b"'), false);
  assert.equal(v.words.length, 6);
});

test('marking a word (either way round) finds it; finding them all ends it with the time', () => {
  const { ctx, g } = game();
  ctx.advance(45000);
  const [first, ...rest] = g.placed;
  g.onInput({ type: 'mark', a: first.b, b: first.a }); // from the last letter to the first
  assert.equal(g.hostView().words.find((w) => w.word === first.word).found, true);
  g.onInput({ type: 'mark', a: first.a, b: first.b }); // again: nothing new
  assert.equal(g.found.length, 1);
  assert.equal(g.nope, 1);
  for (const p of rest) g.onInput({ type: 'mark', a: p.a, b: p.b });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 45000);
  assert.equal(v.variant, '8 × 8');
  assert.equal(ctx.pendingTimers(), 0);
});

test('a line that is not a hidden word shakes; bad input is ignored', () => {
  const { g } = game();
  g.onInput({ type: 'mark', a: 0, b: 1 });
  assert.equal(g.nope, 1);
  for (const input of [{ type: 'mark', a: 0, b: 64 }, { type: 'mark', a: -1, b: 2 }, { type: 'mark', a: '0', b: 1 }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.nope, 1);
  assert.equal(new WordSearch(fakeCtx('Ana', { size: 'toString' })).size, 'small');
});
