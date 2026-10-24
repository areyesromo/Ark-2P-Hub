import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { AnagramDuel, TIMING } from '../server/games/anagram-duel.js';
import { isWord } from '../server/games/word-race.js';
import { ANSWERS } from '../server/games/anagram-words.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function game(wins = 3, seed = 5) {
  const ctx = fakeCtx();
  ctx.settings = { wins };
  const g = new AnagramDuel(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.countdownMs);
  return { ctx, g };
}

test('every word is a real five-letter word', () => {
  assert.ok(ANSWERS.length > 500);
  assert.ok(ANSWERS.every((w) => /^[a-z]{5}$/.test(w) && isWord(w)));
});

test('both players see the same mixed-up letters, never the word, until the round is won', () => {
  const { g } = game();
  const a = g.playerView(0);
  const b = g.playerView(1);
  assert.equal(a.phase, 'play');
  assert.deepEqual(a.letters, b.letters);
  assert.deepEqual([...a.letters].sort(), [...g.word].sort());
  assert.notEqual(a.letters.join(''), g.word);
  for (const v of [a, b, g.hostView()]) assert.equal(JSON.stringify(v).includes('"' + g.word + '"'), false);
});

test('the first real word with all the letters wins the round, even another word than the one dealt', () => {
  const { ctx, g } = game();
  g.word = 'least';
  g.letters = [...'tsael'];
  g.onInput(1, { type: 'guess', word: 'STEAL' });
  assert.deepEqual(g.scores, [0, 1]);
  assert.deepEqual(g.hostView().result, { winner: 1, word: 'steal', answer: 'least' });
  g.onInput(0, { type: 'guess', word: 'least' }); // too late
  assert.deepEqual(g.scores, [0, 1]);
  ctx.advance(TIMING.resultMs + TIMING.countdownMs);
  assert.equal(g.phase, 'play');
  assert.equal(g.round, 2);
});

test('a wrong word locks that player out for a moment, and only that player', () => {
  const { ctx, g } = game();
  g.word = 'least';
  g.letters = [...'tsael'];
  g.onInput(0, { type: 'guess', word: 'tasel' });
  assert.equal(g.playerView(0).feedback.word, 'tasel');
  assert.ok(g.playerView(0).lockedFor > 0);
  assert.equal(g.playerView(1).feedback, null);
  g.onInput(0, { type: 'guess', word: 'steal' }); // still locked
  assert.deepEqual(g.scores, [0, 0]);
  ctx.advance(TIMING.lockMs);
  g.onInput(0, { type: 'guess', word: 'steal' });
  assert.deepEqual(g.scores, [1, 0]);
});

test('nobody finding one voids the round and shows the word; first to the wins takes the match', () => {
  const { ctx, g } = game(2);
  const w = g.word;
  ctx.advance(TIMING.roundMs);
  assert.equal(g.phase, 'result');
  assert.deepEqual(g.hostView().result, { winner: null, word: null, answer: w });
  for (let i = 0; i < 2; i++) {
    ctx.advance(TIMING.resultMs + TIMING.countdownMs);
    g.onInput(0, { type: 'guess', word: g.word });
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().winner, 0);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(1, { type: 'rematch' });
  assert.equal(g.phase, 'countdown');
  assert.deepEqual(g.scores, [0, 0]);
});

test('no word comes up twice in a match; progress shows on the TV; bad input is ignored', () => {
  const { ctx, g } = game(50);
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    assert.equal(seen.has(g.word), false);
    seen.add(g.word);
    ctx.advance(TIMING.roundMs + TIMING.resultMs + TIMING.countdownMs);
  }
  g.onInput(1, { type: 'progress', n: 3 });
  assert.deepEqual(g.hostView().progress, [0, 3]);
  for (const [slot, input] of [[0, { type: 'progress', n: 9 }], [0, { type: 'progress', n: 1.5 }], [2, { type: 'guess', word: g.word }], [0, { type: 'guess', word: 5 }], [0, { type: 'guess', word: 'a b' }], [0, { type: 'zap' }]]) g.onInput(slot, input);
  assert.deepEqual(g.hostView().progress, [0, 3]);
  assert.deepEqual(g.scores, [0, 0]);
});
