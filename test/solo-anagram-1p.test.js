import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Anagram, SECONDS, SKIP_MS, TIMING } from '../server/solo/games/anagram-1p.js';

function game(seed = 3) {
  const ctx = fakeCtx('Ana');
  const g = new Anagram(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.readyMs);
  return { ctx, g };
}

test('the letters are the word mixed up, and the word itself never shows', () => {
  const { g } = game();
  const v = g.hostView();
  assert.equal(v.phase, 'play');
  assert.deepEqual([...v.letters].sort(), [...g.word].sort());
  assert.notEqual(v.letters.join(''), g.word);
  assert.equal(JSON.stringify(v).includes('"' + g.word + '"'), false);
});

test('the word counts, and so does any other real word with the same letters', () => {
  const { g } = game();
  g.word = 'least';
  g.letters = [...'tsael'];
  g.onInput({ type: 'guess', word: 'STEAL' }); // another word, in capitals
  assert.equal(g.right, 1);
  assert.equal(g.last.ok, true);
  assert.equal(g.last.answer, 'least');
  g.word = 'least';
  g.letters = [...'tsael'];
  g.onInput({ type: 'guess', word: 'tasel' }); // the letters, but not a word
  assert.equal(g.right, 1);
  assert.equal(g.wrong, 1);
  g.onInput({ type: 'guess', word: 'leas' }); // not all the letters
  assert.equal(g.wrong, 2);
});

test('a skip costs time and shows the word; time up ends it with the words made', () => {
  const { ctx, g } = game();
  const w = g.word;
  g.onInput({ type: 'skip' });
  assert.equal(g.last.answer, w);
  assert.equal(g.last.skipped, true);
  ctx.advance(SECONDS * 1000 - SKIP_MS - 1);
  assert.equal(g.phase, 'play');
  ctx.advance(1);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 0);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'ready');
});

test('no word comes up twice in a run', () => {
  const { g } = game();
  const seen = new Set([g.word]);
  for (let i = 0; i < 40; i++) {
    g.onInput({ type: 'skip' });
    if (g.phase !== 'play') break;
    assert.equal(seen.has(g.word), false);
    seen.add(g.word);
  }
});

test('bad input is ignored', () => {
  const { g } = game();
  const w = g.word;
  for (const input of [{ type: 'guess', word: 5 }, { type: 'guess', word: 'ab cd' }, { type: 'guess', word: 'x'.repeat(30) }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.word, w);
  assert.equal(g.wrong, 0);
});
