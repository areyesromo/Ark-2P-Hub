// Anagram Rush, the 1 player mode of Anagram Duel (it was 1P's Anagram Rush): word after word for
// 60 seconds on the duel's letters (server/games/anagram-duel.js, soloAnagram).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { AnagramDuel, soloAnagram, RUSH } from '../server/games/anagram-duel.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

function game(seed = 3) {
  const ctx = fakeCtx('Ana');
  const g = new AnagramDuel(ctx, seeded(seed), { solo: true });
  g.start();
  ctx.advance(RUSH.readyMs);
  return { ctx, g };
}
const say = (g, input) => g.onInput(0, input);

test('the letters are the word mixed up, and the word itself never shows', () => {
  const { g } = game();
  const v = g.hostView();
  assert.equal(v.solo, true);
  assert.equal(v.phase, 'play');
  assert.deepEqual([...v.letters].sort(), [...g.word].sort());
  assert.notEqual(v.letters.join(''), g.word);
  assert.equal(JSON.stringify(v).includes('"' + g.word + '"'), false);
});

test('the word counts, and so does any other real word with the same letters', () => {
  const { g } = game();
  g.word = 'least';
  g.letters = [...'tsael'];
  say(g, { type: 'guess', word: 'STEAL' }); // another word, in capitals
  assert.equal(g.right, 1);
  assert.equal(g.last.ok, true);
  assert.equal(g.last.answer, 'least');
  g.word = 'least';
  g.letters = [...'tsael'];
  say(g, { type: 'guess', word: 'tasel' }); // the letters, but not a word
  assert.equal(g.right, 1);
  assert.equal(g.wrong, 1);
  say(g, { type: 'guess', word: 'leas' }); // not all the letters
  assert.equal(g.wrong, 2);
  assert.equal(g.hostView().score, 1);
});

test('a skip costs time and shows the word; time up ends it with the words made', () => {
  const { ctx, g } = game();
  const w = g.word;
  say(g, { type: 'skip' });
  assert.equal(g.last.answer, w);
  assert.equal(g.last.skipped, true);
  ctx.advance(RUSH.seconds * 1000 - RUSH.skipMs - 1);
  assert.equal(g.phase, 'play');
  ctx.advance(1);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 0);
  assert.equal(ctx.pendingTimers(), 0);
  say(g, { type: 'rematch' });
  assert.equal(g.phase, 'ready');
});

test('no word comes up twice in a run; bad input and the other seat are ignored', () => {
  const { g } = game();
  const seen = new Set([g.word]);
  for (let i = 0; i < 15; i++) {
    say(g, { type: 'skip' });
    if (g.phase !== 'play') break;
    assert.equal(seen.has(g.word), false);
    seen.add(g.word);
  }
  const w = g.word;
  for (const input of [{ type: 'guess', word: 5 }, { type: 'guess', word: 'ab cd' }, { type: 'guess', word: 'x'.repeat(30) }, { type: 'zap' }]) say(g, input);
  g.onInput(1, { type: 'skip' });
  assert.equal(g.word, w);
  assert.equal(g.wrong, 0);
});

test('one game in both lobbies: Anagram Duel and Anagram Rush, under one id', () => {
  assert.equal(getGame('anagram-duel').name, 'Anagram Duel');
  assert.equal(soloGameOf('anagram-duel').name, 'Anagram Rush');
  const ctx = Object.assign(fakeCtx(), { rng: seeded(1) });
  const run = soloAnagram.create(ctx);
  run.start();
  ctx.advance(RUSH.readyMs);
  run.onInput({ type: 'skip' });
  assert.equal(run.playerView().skips, 1);
  assert.ok(!listGames().some((g) => g.id === 'anagram-1p'), 'Anagram Rush 1P is gone');
});
