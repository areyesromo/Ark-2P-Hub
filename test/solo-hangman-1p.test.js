import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Hangman, MAX_WRONG, TIMING, POINTS, POOL } from '../server/solo/games/hangman-1p.js';

function game(seed = 3) {
  const ctx = fakeCtx();
  const g = new Hangman(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

const solve = (g) => [...new Set(g.word)].forEach((c) => g.onInput({ type: 'guess', letter: c }));
/** A letter that isn't in the word, for each go. */
const misses = (g) => [...'qzxjkvwyfbgmpd'].filter((c) => !g.word.includes(c));

test('the pool is whole, lower case words of four letters or more', () => {
  assert.ok(POOL.length > 500);
  assert.equal(new Set(POOL).size, POOL.length);
  assert.ok(POOL.every((w) => /^[a-z]{4,}$/.test(w)));
});

test('the word stays hidden: blanks and the letters found, never the word until it is over', () => {
  const { g } = game();
  let v = g.hostView();
  assert.equal(v.pattern, '_'.repeat(g.word.length));
  assert.equal(v.answer, null);
  assert.equal(JSON.stringify(v).includes(g.word), false);
  g.onInput({ type: 'guess', letter: g.word[0].toUpperCase() });
  v = g.hostView();
  assert.equal(v.pattern[0], g.word[0]);
  assert.equal(v.hits.includes(g.word[0]), true);
  assert.equal(JSON.stringify(g.playerView()).includes(g.word), false);
});

test('wrong letters count once each; a letter twice does nothing', () => {
  const { g } = game();
  const [m] = misses(g);
  g.onInput({ type: 'guess', letter: m });
  g.onInput({ type: 'guess', letter: m });
  assert.equal(g.wrong, 1);
  assert.equal(g.hostView().misses, m);
});

test('a word scores 100 plus 20 for each wrong guess spared; the next word follows', () => {
  const { ctx, g } = game();
  const first = g.word;
  g.onInput({ type: 'guess', letter: misses(g)[0] });
  solve(g);
  assert.equal(g.phase, 'between');
  assert.equal(g.score, POINTS.word + (MAX_WRONG - 1) * POINTS.spare);
  assert.equal(g.hostView().answer, first);
  assert.deepEqual([g.last.ok, g.last.word], [true, first]);
  ctx.advance(TIMING.nextMs);
  assert.equal(g.phase, 'play');
  assert.notEqual(g.word, first);
  assert.equal(g.hostView().wordNo, 2);
  solve(g);
  assert.equal(g.perfects, 1, 'the second word had no wrong guess');
});

test('the sixth wrong guess ends the run with the word shown; rematch starts again', () => {
  const { ctx, g } = game();
  solve(g);
  ctx.advance(TIMING.nextMs);
  const score = g.score;
  for (const c of misses(g).slice(0, MAX_WRONG)) g.onInput({ type: 'guess', letter: c });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, score);
  assert.equal(v.answer, g.word);
  assert.equal(g.last.ok, false);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'guess', letter: 'e' }); // over: ignored
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.score, 0);
});

test('no word comes up twice in a run; bad input is ignored', () => {
  const { ctx, g } = game();
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    assert.equal(seen.has(g.word), false);
    seen.add(g.word);
    solve(g);
    ctx.advance(TIMING.nextMs);
  }
  const before = g.guessed.size;
  for (const input of [{ type: 'guess', letter: 5 }, { type: 'guess', letter: 'ab' }, { type: 'guess', letter: '1' }, { type: 'guess' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.guessed.size, before);
});
