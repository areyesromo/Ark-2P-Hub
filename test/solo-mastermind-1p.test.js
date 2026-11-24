import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Mastermind, LEVELS, MAX_GUESSES, rate } from '../server/solo/games/mastermind-1p.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

function game(level = 'easy', seed = 3) {
  const ctx = fakeCtx('Ana', { level });
  const g = new Mastermind(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('rating a guess: places, colours, and colours that repeat', () => {
  assert.deepEqual(rate([0, 1, 2, 3], [0, 1, 2, 3]), { exact: 4, colour: 0 });
  assert.deepEqual(rate([0, 1, 2, 3], [3, 2, 1, 0]), { exact: 0, colour: 4 });
  assert.deepEqual(rate([0, 0, 1, 1], [1, 1, 0, 0]), { exact: 0, colour: 4 }, 'AABB against BBAA');
  assert.deepEqual(rate([0, 0, 1, 1], [0, 1, 1, 0]), { exact: 2, colour: 2 }, 'AABB against ABBA');
  assert.deepEqual(rate([0, 0, 0, 1], [0, 1, 1, 1]), { exact: 2, colour: 0 }, 'a colour only counts as often as the code has it');
  assert.deepEqual(rate([0, 1, 2, 3], [4, 4, 4, 4]), { exact: 0, colour: 0 });
  assert.deepEqual(rate([1, 1, 2, 3], [1, 2, 2, 2]), { exact: 2, colour: 0 }, 'one 2 is exact, the other two have no partner');
});

test('the code stays hidden until the run is over; each level has its own size', () => {
  for (const [level, { pegs, colours }] of Object.entries(LEVELS)) {
    const { g } = game(level);
    assert.equal(g.code.length, pegs);
    assert.ok(g.code.every((c) => c >= 0 && c < colours));
    for (const v of [g.hostView(), g.playerView()]) {
      assert.equal(v.code, null);
      assert.equal(v.pegs, pegs);
    }
  }
});

test('cracking it scores the guesses it took, and shows the code', () => {
  const { g } = game('easy');
  const wrong = g.code.map((c) => (c + 1) % 6);
  g.onInput({ type: 'guess', pegs: wrong });
  g.onInput({ type: 'guess', pegs: g.code });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, true);
  assert.equal(v.score, 2);
  assert.deepEqual(v.code, g.code);
  assert.equal(v.variant, 'Easy');
  g.onInput({ type: 'guess', pegs: wrong }); // over: ignored
  assert.equal(g.guesses.length, 2);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.guesses, []);
});

test('ten wrong guesses lose, and a lost run doesn\'t count', () => {
  const { g } = game('hard');
  const wrong = g.code.map((c) => (c + 1) % 8);
  for (let i = 0; i < MAX_GUESSES; i++) g.onInput({ type: 'guess', pegs: wrong });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, false);
  assert.equal(v.score, null);
  assert.deepEqual(v.code, g.code);
});

test('bad guesses are ignored, and the level is checked', () => {
  const { g } = game();
  for (const pegs of [[0, 1, 2], [0, 1, 2, 3, 4], [0, 1, 2, 6], [0, 1, 2, -1], [0, 1, 2, 1.5], ['0', 1, 2, 3], 'abcd', null]) g.onInput({ type: 'guess', pegs });
  g.onInput({ type: 'zap' });
  assert.equal(g.guesses.length, 0);
  assert.equal(new Mastermind(fakeCtx('Ana', { level: 'toString' })).level, 'easy');
  assert.ok(getGame('mastermind-1p'));
});
