// Five Letters in the 1 player mode (it was 1P's Word Guess): one board, typed a letter at a time,
// a daily word or practice (server/games/five-letters.js, soloFiveLetters).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { FiveLetters, soloFiveLetters, marks, dailyWord, dayOf, POOL, MAX_GUESSES } from '../server/games/five-letters.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

const solo = (settings, rng) => {
  const ctx = fakeCtx('Ana', settings);
  const g = new FiveLetters(ctx, rng, { solo: true });
  g.start();
  return { ctx, g };
};
const type = (g, word) => {
  for (const letter of word) g.onInput(0, { type: 'letter', letter });
  g.onInput(0, { type: 'enter' });
};

test('the daily word changes each day but not within one, and comes from the answers', () => {
  assert.equal(dailyWord('2026-10-22'), dailyWord('2026-10-22'));
  const week = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(dailyWord);
  assert.equal(new Set(week).size, week.length);
  assert.ok(week.every((w) => POOL.includes(w)));
});

test('a found word scores the guesses it took; the word stays hidden until the end; the TV sees the typing', () => {
  const { g } = solo({ mode: 'practice' }, seeded(2));
  assert.equal(g.hostView().answer, null);
  for (const letter of 'cra') g.onInput(0, { type: 'letter', letter });
  assert.equal(g.hostView().entry, 'cra', 'what you type shows on the TV');
  for (let i = 0; i < 3; i++) g.onInput(0, { type: 'back' });
  type(g, g.answer === 'crane' ? 'slate' : 'crane');
  assert.equal(g.hostView().board.length, 1);
  assert.equal(g.hostView().board[0].marks, marks(g.hostView().board[0].word, g.answer));
  // The phone can send a whole word too.
  g.onInput(0, { type: 'guess', word: g.answer.toUpperCase() });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.solved, true);
  assert.equal(v.score, 2);
  assert.equal(v.variant, 'Practice');
  assert.equal(v.answer, g.answer);
});

test('short and made-up words are turned away without using a guess; bad input is ignored', () => {
  const { g } = solo({ mode: 'practice' }, seeded(2));
  type(g, 'cra');
  assert.equal(g.hostView().message.text, 'Not enough letters');
  for (let i = 0; i < 3; i++) g.onInput(0, { type: 'back' });
  type(g, 'qzxvw');
  assert.equal(g.hostView().message.text, 'Not a word we know');
  assert.equal(g.hostView().board.length, 0);
  for (const bad of [{ type: 'letter', letter: 'A' }, { type: 'letter', letter: 'ab' }, { type: 'letter', letter: 1 }, { type: 'guess', word: 7 }, { type: 'guess', word: 'toolong' }]) g.onInput(0, bad);
  assert.equal(g.entry, 'qzxvw');
  g.onInput(1, { type: 'letter', letter: 'a' }); // (nobody else's input counts)
  assert.equal(g.entry, 'qzxvw');
});

test('six misses end it without a score, and show the word', () => {
  const { g } = solo({ mode: 'practice' }, seeded(2));
  for (const w of POOL.filter((x) => x !== g.answer).slice(0, MAX_GUESSES)) type(g, w);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, null);
  assert.equal(v.answer, g.answer);
});

test('the daily word is played once a day: a second go shows the first and does not count', () => {
  const ctx = fakeCtx('Ana', { mode: 'daily' });
  ctx.advance(Date.parse('2026-10-22T09:00:00Z'));
  const g = new FiveLetters(ctx, Math.random, { solo: true });
  g.start();
  assert.equal(g.answer, dailyWord(dayOf(ctx.now())));
  type(g, g.answer);
  assert.equal(g.hostView().score, 1);
  assert.equal(g.hostView().variant, 'Daily');
  g.onInput(0, { type: 'rematch' });
  const again = g.hostView();
  assert.equal(again.phase, 'over');
  assert.equal(again.already, true);
  assert.equal(again.score, null);
  assert.equal(again.board.length, 1);
  ctx.advance(86400000); // the next day: a new word
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.hostView().phase, 'play');
});

test('practice words do not repeat, and there is no clock', () => {
  const ctx = fakeCtx('Ana', { mode: 'practice' });
  const g = new FiveLetters(ctx, seeded(5), { solo: true });
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    g.start();
    assert.ok(!seen.has(g.answer));
    seen.add(g.answer);
  }
  assert.equal(ctx.pendingTimers(), 0);
});

test('one game in both lobbies: Five Letters 1v1 and on your own, under one id', () => {
  assert.equal(getGame('five-letters').solo, undefined);
  assert.equal(soloGameOf('five-letters').solo, true);
  const run = soloFiveLetters.create(Object.assign(fakeCtx('Ana', { mode: 'practice' }), { rng: seeded(3) }));
  run.start();
  run.onInput({ type: 'letter', letter: 'a' });
  assert.equal(run.playerView().entry, 'a');
  assert.deepEqual(listGames().filter((g) => g.id === 'five-letters').map((g) => [g.name, g.solo, g.category]), [['Five Letters', false, 'competitive'], ['Five Letters', true, 'brain']]);
  assert.ok(!listGames().some((g) => g.id === 'word-guess-1p'), 'Word Guess 1P is gone');
});
