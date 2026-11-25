// Word Search, the 1 player mode of Word Hunt (it was 1P's Word Search): server/games/word-hunt.js, soloWordSearch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { WordHunt, soloWordSearch, SIZES, line } from '../server/games/word-hunt.js';
import { WORDS } from '../server/games/word-hunt-words.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

function game(size = 'small', seed = 4) {
  const ctx = fakeCtx('Ana', { size });
  const g = new WordHunt(ctx, seeded(seed), { solo: true });
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
      for (const p of g.placed) assert.equal(line(SIZES[size].n, p.a, p.b).map((i) => g.grid[i]).join(''), p.word, `${size} ${p.word}`);
    }
  }
});

test('only lines across, down and diagonal read', () => {
  const { g } = game('large');
  assert.equal(line(12, 0, 0), null);
  assert.equal(line(12, 0, 13).length, 2); // one down and right on a 12-wide grid: a diagonal
  assert.equal(line(12, 0, 14), null, 'not a straight line');
  assert.equal(line(12, 0, 11).length, 12);
  assert.ok(g.grid.length === 144);
});

test('where the words are stays hidden until they are found', () => {
  const { g } = game();
  const v = g.hostView();
  assert.deepEqual(v.found, []);
  assert.equal(JSON.stringify(v).includes('"a":' + g.placed[0].a + ',"b"'), false);
  assert.equal(v.words.length, SIZES.small.words);
});

test('marking a word (either way round) finds it; finding them all ends it with the time', () => {
  const { ctx, g } = game();
  ctx.advance(45000);
  const [first, ...rest] = g.placed;
  g.onInput(0, { type: 'mark', a: first.b, b: first.a }); // from the last letter to the first
  assert.equal(g.hostView().words.find((w) => w.word === first.word).found, true);
  g.onInput(0, { type: 'mark', a: first.a, b: first.b }); // again: nothing new
  assert.equal(g.found.length, 1);
  assert.equal(g.hostView().nope, 1);
  for (const p of rest) g.onInput(0, { type: 'mark', a: p.a, b: p.b });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 45000);
  assert.equal(v.variant, '8 × 8');
  assert.equal(ctx.pendingTimers(), 0);
});

test('a line that is not a hidden word shakes; bad input is ignored', () => {
  const { g } = game();
  g.onInput(0, { type: 'mark', a: 0, b: 1 });
  assert.equal(g.hostView().nope, 1);
  for (const input of [{ type: 'mark', a: 0, b: 64 }, { type: 'mark', a: -1, b: 2 }, { type: 'mark', a: '0', b: 1 }, { type: 'zap' }]) g.onInput(0, input);
  assert.equal(g.hostView().nope, 1);
  assert.equal(new WordHunt(fakeCtx('Ana', { size: 'toString' }), Math.random, { solo: true }).size, 'small');
});

test('one game in both lobbies: Word Hunt and Word Search, under one id; nobody else\'s marks count', () => {
  assert.equal(getGame('word-hunt').name, 'Word Hunt');
  assert.equal(soloGameOf('word-hunt').name, 'Word Search');
  const run = soloWordSearch.create(Object.assign(fakeCtx('Ana', { size: 'small' }), { rng: seeded(2) }));
  run.start();
  const p = run.game.placed[0];
  run.game.onInput(1, { type: 'mark', a: p.a, b: p.b });
  assert.equal(run.playerView().found.length, 0);
  run.onInput({ type: 'mark', a: p.a, b: p.b });
  assert.equal(run.playerView().found.length, 1);
  assert.ok(!listGames().some((g) => g.id === 'wordsearch-1p'), 'Word Search 1P is gone');
});
