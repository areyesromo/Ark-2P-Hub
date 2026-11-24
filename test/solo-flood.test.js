import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Flood, SIZES, SPARE, COLOURS, region, flood, plan } from '../server/solo/games/flood.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

function game(size = 'medium', seed = 3) {
  const ctx = fakeCtx('Ana', { size });
  const g = new Flood(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('your area is the top-left cell and its colour next to it, and a move floods it', () => {
  const n = 3;
  const board = [0, 0, 1, 2, 0, 1, 2, 2, 1];
  assert.deepEqual([...region(board, n)].sort(), [0, 1, 4]);
  const after = flood(board, n, 2);
  assert.deepEqual(after, [2, 2, 1, 2, 2, 1, 2, 2, 1]);
  assert.deepEqual([...region(after, n)].sort((a, b) => a - b), [0, 1, 3, 4, 6, 7]);
});

test('every board can be done within its limit by playing the plan, on every size', () => {
  for (const size of Object.keys(SIZES)) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { g } = game(size, seed);
      assert.equal(g.limit, g.par + SPARE);
      for (const colour of plan(g.board, g.n)) g.onInput({ type: 'pick', colour });
      const v = g.hostView();
      assert.equal(v.phase, 'over', `${size} ${seed}`);
      assert.equal(v.won, true);
      assert.equal(v.score, g.par);
      assert.ok(g.board.every((c) => c === g.board[0]));
    }
  }
});

test('the limit is sensible: about what the classic game gives', () => {
  const { g } = game('medium', 7);
  assert.ok(g.limit >= 18 && g.limit <= 35, `limit ${g.limit}`);
});

test('picking the colour you already are is not a move; running out loses and doesn\'t count', () => {
  const { g } = game('small');
  g.onInput({ type: 'pick', colour: g.board[0] });
  assert.equal(g.moves, 0);
  // Flip between two colours that are never the whole board until the moves run out.
  g.board = g.board.map((_, i) => (i % 2 ? 4 : 5));
  g.board[0] = 5;
  for (let i = 0; i < g.limit; i++) g.onInput({ type: 'pick', colour: g.board[0] === 0 ? 1 : 0 });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, false);
  assert.equal(v.score, null);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.moves, 0);
});

test('bad input is ignored, and the size is checked', () => {
  const { g } = game();
  for (const input of [{ type: 'pick', colour: COLOURS }, { type: 'pick', colour: -1 }, { type: 'pick', colour: '2' }, { type: 'pick', colour: 1.5 }, { type: 'pick' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.moves, 0);
  assert.equal(new Flood(fakeCtx('Ana', { size: 'toString' })).size, 'medium');
  assert.ok(getGame('flood'));
});
