// Hangman in the 1 player mode (it was 1P's Hangman): a run of the hub's words on Hangman Duel's
// engine (server/games/hangman.js, soloHangman).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Hangman, soloHangman, LIVES, TIMING, POINTS, PICKS } from '../server/games/hangman.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

function game(seed = 3) {
  const ctx = fakeCtx();
  const g = new Hangman(ctx, seeded(seed), { solo: true });
  g.start();
  return { ctx, g };
}
const word = (g) => g.words[1];
const solve = (g) => [...new Set(word(g))].forEach((c) => g.onInput(0, { type: 'letter', letter: c }));
/** Letters that aren't in the word. */
const misses = (g) => [...'qzxjkvwyfbgmpdhu'].filter((c) => !word(g).includes(c));

test('the word stays hidden: blanks and the letters found, never the word until it is done', () => {
  const { g } = game();
  let v = g.hostView();
  assert.equal(v.solo, true);
  assert.deepEqual(v.mask, Array(word(g).length).fill(null));
  assert.equal(v.answer, null);
  assert.equal(JSON.stringify(v).includes(word(g)), false);
  g.onInput(0, { type: 'letter', letter: word(g)[0].toUpperCase() });
  v = g.hostView();
  assert.equal(v.mask[0], word(g)[0]);
  assert.equal(JSON.stringify(g.playerView(0)).includes(word(g)), false);
});

test('wrong letters count once each; a letter twice, or nonsense, does nothing', () => {
  const { g } = game();
  const [m] = misses(g);
  g.onInput(0, { type: 'letter', letter: m });
  g.onInput(0, { type: 'letter', letter: m });
  for (const bad of ['ab', 1, '', null]) g.onInput(0, { type: 'letter', letter: bad });
  g.onInput(1, { type: 'letter', letter: misses(g)[1] }); // (nobody else's)
  assert.equal(g.hostView().misses, 1);
  assert.deepEqual(g.hostView().tried, [m]);
});

test('a word scores 100 plus 20 for each wrong letter spared; the next word follows', () => {
  const { ctx, g } = game();
  const first = word(g);
  g.onInput(0, { type: 'letter', letter: misses(g)[0] });
  solve(g);
  assert.equal(g.phase, 'between');
  assert.equal(g.hostView().score, POINTS.word + (LIVES - 1) * POINTS.spare);
  assert.equal(g.hostView().answer, first);
  ctx.advance(TIMING.nextMs);
  assert.equal(g.phase, 'play');
  assert.notEqual(word(g), first);
  assert.equal(g.hostView().wordNo, 2);
  solve(g);
  assert.equal(g.hostView().perfects, 1, 'the second word had no wrong letter');
});

test('the seventh wrong letter ends the run with the word shown; play again starts afresh', () => {
  const { ctx, g } = game();
  solve(g);
  ctx.advance(TIMING.nextMs);
  const score = g.hostView().score;
  for (const c of misses(g).slice(0, LIVES)) g.onInput(0, { type: 'letter', letter: c });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, score);
  assert.equal(v.answer, word(g));
  assert.equal(v.last.ok, false);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.hostView().score, 0);
});

test('no word comes up twice in a run; the words are the duel\'s everyday ones', () => {
  const { ctx, g } = game(9);
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    assert.ok(PICKS.includes(word(g)));
    assert.ok(!seen.has(word(g)));
    seen.add(word(g));
    solve(g);
    ctx.advance(TIMING.nextMs);
  }
});

test('one game in both lobbies: Hangman Duel and Hangman, under one id', () => {
  assert.equal(getGame('hangman').name, 'Hangman Duel');
  assert.equal(soloGameOf('hangman').name, 'Hangman');
  const run = soloHangman.create(Object.assign(fakeCtx(), { rng: seeded(1) }));
  run.start();
  run.onInput({ type: 'letter', letter: 'e' });
  assert.deepEqual(run.playerView().tried, ['e']);
  assert.ok(!listGames().some((g) => g.id === 'hangman-1p'), 'Hangman 1P is gone');
});
