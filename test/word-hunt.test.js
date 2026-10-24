import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { WordHunt, SIZES, TIMING, line } from '../server/games/word-hunt.js';
import { WORDS } from '../server/games/word-hunt-words.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function game(settings = {}, seed = 4) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new WordHunt(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.countdownMs);
  return { ctx, g };
}

const read = (g, p) => line(SIZES[g.size].n, p.a, p.b).map((i) => g.grid[i]).join('');

test('every grid hides an odd number of words, readable where they are', () => {
  assert.ok(WORDS.every((w) => /^[a-z]{3,8}$/.test(w)));
  for (const size of Object.keys(SIZES)) {
    assert.equal(SIZES[size].words % 2, 1);
    for (const seed of [1, 2, 3]) {
      const { g } = game({ size }, seed);
      assert.equal(g.placed.length, SIZES[size].words);
      for (const p of g.placed) assert.equal(read(g, p), p.word, `${size} ${p.word}`);
    }
  }
});

test('the grid is hidden in the countdown; where the words are stays hidden until found', () => {
  const ctx = fakeCtx();
  const g = new WordHunt(ctx, seeded(1));
  g.start();
  assert.equal(g.hostView().grid, null);
  ctx.advance(TIMING.countdownMs);
  const v = g.playerView(0);
  assert.equal(v.grid.length, 100);
  assert.deepEqual(v.found, []);
  assert.equal(JSON.stringify(v).includes('"a":' + g.placed[0].a + ',"b":' + g.placed[0].b), false);
});

test('a word goes to whoever marks it first, either way round; the other can\'t take it', () => {
  const { g } = game();
  const [p] = g.placed;
  g.onInput(1, { type: 'mark', a: p.b, b: p.a });
  g.onInput(0, { type: 'mark', a: p.a, b: p.b });
  const v = g.hostView();
  assert.deepEqual(v.counts, [0, 1]);
  assert.equal(v.words.find((w) => w.word === p.word).by, 1);
  assert.deepEqual(v.nope, [1, 0]);
});

test('more than half the words takes the grid; first to the wins takes the match', () => {
  const { ctx, g } = game({ wins: 2, size: 'small' });
  for (let grid = 0; grid < 2; grid++) {
    for (const p of g.placed.slice(0, 3)) g.onInput(0, { type: 'mark', a: p.a, b: p.b });
    assert.equal(g.phase, 'play');
    g.onInput(1, { type: 'mark', a: g.placed[3].a, b: g.placed[3].b });
    g.onInput(0, { type: 'mark', a: g.placed[4].a, b: g.placed[4].b }); // 4 of 7
    if (grid === 0) {
      assert.equal(g.phase, 'result');
      assert.equal(g.hostView().result.winner, 0);
      assert.equal(g.hostView().result.missed.length, 2);
      ctx.advance(TIMING.resultMs + TIMING.countdownMs);
    }
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.winner, 0);
  assert.deepEqual(v.totalWords, [8, 2]);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(1, { type: 'rematch' });
  assert.equal(g.phase, 'countdown');
});

test('time up: more words takes the grid, level is nobody\'s', () => {
  const { ctx, g } = game();
  g.onInput(0, { type: 'mark', a: g.placed[0].a, b: g.placed[0].b });
  g.onInput(1, { type: 'mark', a: g.placed[1].a, b: g.placed[1].b });
  ctx.advance(TIMING.gridMs);
  assert.equal(g.phase, 'result');
  assert.equal(g.hostView().result.winner, null);
  assert.deepEqual(g.scores, [0, 0]);
});

test('only straight lines on the grid count; bad input is ignored', () => {
  const { g } = game();
  assert.equal(line(10, 0, 0), null);
  assert.equal(line(10, 0, 12), null);
  assert.deepEqual(line(10, 0, 22), [0, 11, 22]);
  for (const [slot, input] of [[0, { type: 'mark', a: 0, b: 12 }], [0, { type: 'mark', a: 0, b: 100 }], [0, { type: 'mark', a: '0', b: 1 }], [2, { type: 'mark', a: 0, b: 1 }], [0, { type: 'zap' }]]) g.onInput(slot, input);
  assert.deepEqual(g.hostView().nope, [0, 0]);
  assert.equal(new WordHunt(fakeCtx(), Math.random).size, 'medium');
});
