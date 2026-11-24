import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { WordGuess, mark, dailyWord, dictionary, dayOf, TRIES } from '../server/solo/games/word-guess-1p.js';
import { ANSWERS } from '../server/solo/games/word-guess-words.js';

const type = (g, word) => {
  for (const letter of word) g.onInput({ type: 'letter', letter });
  g.onInput({ type: 'enter' });
};

test('marks greens first, and repeated letters only as often as the word has them', () => {
  assert.equal(mark('crane', 'crane'), 'ggggg');
  assert.equal(mark('eerie', 'there'), 'y.y.g'); // there has one e left over after the green one
  assert.equal(mark('speed', 'abide'), '..y.y');
  assert.equal(mark('llama', 'hello'), 'yy...');
});

test('every answer is a real word, and the daily word changes each day but not within one', () => {
  const dict = dictionary();
  assert.ok(ANSWERS.every((w) => dict.has(w)));
  assert.equal(dailyWord('2026-10-22'), dailyWord('2026-10-22'));
  const week = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(dailyWord);
  assert.equal(new Set(week).size, week.length);
});

test('a found word scores the guesses it took; the answer stays hidden until the end', () => {
  const ctx = fakeCtx('Ana', { mode: 'practice' });
  const g = new WordGuess(ctx, seeded(2));
  g.start();
  assert.equal(g.hostView().answer, null);
  const guess = g.answer === 'crane' ? 'slate' : 'crane';
  type(g, guess);
  assert.equal(g.hostView().guesses.length, 1);
  type(g, g.answer);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.solved, true);
  assert.equal(v.score, 2);
  assert.equal(v.variant, 'Practice');
});

test('short and made-up words are turned away without using a guess', () => {
  const ctx = fakeCtx('Ana', { mode: 'practice' });
  const g = new WordGuess(ctx, seeded(2));
  g.start();
  type(g, 'cra');
  assert.equal(g.hostView().message.text, 'Not enough letters');
  for (let i = 0; i < 3; i++) g.onInput({ type: 'back' });
  type(g, 'qzxvw');
  assert.equal(g.hostView().message.text, 'Not in the word list');
  assert.equal(g.guesses.length, 0);
  for (const bad of [{ type: 'letter', letter: 'A' }, { type: 'letter', letter: 'ab' }, { type: 'letter', letter: 1 }]) g.onInput(bad);
  assert.equal(g.entry, 'qzxvw');
});

test('six misses end it without a score, and show the word', () => {
  const ctx = fakeCtx('Ana', { mode: 'practice' });
  const g = new WordGuess(ctx, seeded(2));
  g.start();
  const wrong = ANSWERS.filter((w) => w !== g.answer).slice(0, TRIES);
  for (const w of wrong) type(g, w);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, null);
  assert.equal(v.answer, g.answer);
});

test('the daily word is played once a day: a second go shows the first and does not count', () => {
  const ctx = fakeCtx('Ana', { mode: 'daily' });
  ctx.advance(Date.parse('2026-10-22T09:00:00Z'));
  const g = new WordGuess(ctx);
  g.start();
  assert.equal(g.answer, dailyWord(dayOf(ctx.now())));
  type(g, g.answer);
  assert.equal(g.hostView().score, 1);
  g.onInput({ type: 'rematch' });
  const again = g.hostView();
  assert.equal(again.phase, 'over');
  assert.equal(again.already, true);
  assert.equal(again.score, null);
  assert.equal(again.guesses.length, 1);
  // The next day there's a new word.
  ctx.advance(86400000);
  g.onInput({ type: 'rematch' });
  assert.equal(g.hostView().phase, 'play');
});

test('practice words do not repeat', () => {
  const ctx = fakeCtx('Ana', { mode: 'practice' });
  const g = new WordGuess(ctx, seeded(5));
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    g.start();
    assert.ok(!seen.has(g.answer));
    seen.add(g.answer);
  }
});
