import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mancala, sow, legalPits, STORE, TIMING } from '../server/games/mancala.js';
import { fakeCtx } from './helpers.js';

// pits[0..5]: P1's pits, pits[6]: P1's store, pits[7..12]: P2's pits, pits[13]: P2's store.
function setup(settings) {
  const ctx = fakeCtx();
  ctx.settings = settings || {};
  const game = new Mancala(ctx, () => 0);
  game.start();
  return { ctx, game, v: () => game.hostView() };
}
const sowIn = (game, slot, pit) => game.onInput(slot, { type: 'sow', pit });
const board = (p1, s1, p2, s2) => [...p1, s1, ...p2, s2];

test('the board: 6 pits of 4 each side (3 and 5 as settings), empty stores, P1 starts', () => {
  let { v } = setup();
  assert.deepEqual(v().pits, board([4, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0));
  assert.equal(v().turn, 0);
  assert.deepEqual(v().legal, [0, 1, 2, 3, 4, 5]);
  ({ v } = setup({ seeds: 3 }));
  assert.equal(v().pits[0], 3);
});

test('sowing goes counter-clockwise one stone a pit; ending in your store goes again', () => {
  const { game, v } = setup();
  sowIn(game, 0, 2); // 4 stones: pits 3, 4, 5 and the store
  assert.deepEqual(v().pits, board([4, 4, 0, 5, 5, 5], 1, [4, 4, 4, 4, 4, 4], 0));
  assert.equal(v().lastMove.again, true);
  assert.equal(v().turn, 0, 'last stone in the store: go again');
  sowIn(game, 0, 5); // 5 stones: store, then P2's pits 7..10
  assert.equal(v().turn, 1);
  assert.equal(v().pits[STORE[0]], 2);
});

test('the wrong player, an empty pit, a rival pit or junk is ignored', () => {
  const { game, v } = setup();
  sowIn(game, 1, 7);
  sowIn(game, 0, 9); // P2's pit
  sowIn(game, 0, 6); // the store
  sowIn(game, 0, 'x');
  game.onInput(0, null);
  assert.equal(v().lastMove, null);
  sowIn(game, 0, 2);
  sowIn(game, 0, 2); // now empty
  assert.equal(v().lastMove.n, 1);
});

test('sowing skips the rival store', () => {
  const pits = board([0, 0, 0, 0, 0, 10], 0, [0, 0, 0, 0, 0, 0], 0);
  // 10 stones: own store, 7..12, (skip 13), 0, 1, 2.
  const r = sow(pits, 0, 5);
  assert.equal(pits[STORE[1]], 0);
  assert.equal(r.last, 2);
  assert.deepEqual(pits.slice(7, 13), [1, 1, 1, 0, 1, 1], 'pit 10 was captured from pit 2');
  assert.equal(pits[STORE[0]], 1 + 2);
});

test('ending in an empty pit of yours captures it and the stones opposite', () => {
  const pits = board([1, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 5, 0], 0);
  // Pit 0 -> pit 1 (empty, yours); opposite of 1 is 11 (5 stones).
  const r = sow(pits, 0, 0);
  assert.deepEqual(r.captured, { pit: 1, from: 11, stones: 6 });
  assert.equal(pits[STORE[0]], 6);
  assert.equal(pits[1] + pits[11], 0);
  // No capture with nothing opposite.
  const quiet = board([1, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 0, 0], 0);
  assert.equal(sow(quiet, 0, 0).captured, null);
  assert.deepEqual(legalPits(quiet, 0), [1]);
});

test('an empty side ends the round: the rest go to their owner; fuller store wins', () => {
  const { ctx, game, v } = setup({ wins: 2 });
  game.pits = board([0, 0, 0, 0, 0, 1], 10, [3, 0, 0, 0, 0, 0], 20);
  sowIn(game, 0, 5); // last stone in the store, and P1's side is now empty
  assert.equal(v().phase, 'roundEnd');
  assert.deepEqual(v().result.stores, [11, 23]);
  assert.equal(v().result.winner, 1);
  assert.deepEqual(v().scores, [0, 1]);
  ctx.advance(TIMING.roundEndMs);
  assert.equal(v().phase, 'play');
  assert.equal(v().turn, 1, 'the starter swaps');
});

test('a tied store is a draw; reaching the target ends the match and rematch restarts', () => {
  const { game, v } = setup();
  game.pits = board([0, 0, 0, 0, 0, 1], 9, [0, 0, 0, 0, 0, 10], 0);
  sowIn(game, 0, 5);
  assert.equal(v().result.draw, true);
  const g2 = setup();
  g2.game.pits = board([0, 0, 0, 0, 0, 1], 20, [1, 0, 0, 0, 0, 0], 2);
  sowIn(g2.game, 0, 5);
  assert.equal(g2.v().phase, 'over');
  assert.equal(g2.v().winner, 0);
  g2.game.onInput(1, { type: 'rematch' });
  assert.equal(g2.v().phase, 'play');
  assert.deepEqual(g2.v().scores, [0, 0]);
});

test('the clock sows a pit for you when it runs out; a whole game always ends', () => {
  const { ctx, v } = setup({ wins: 3 });
  ctx.advance(TIMING.turnMs + 10);
  assert.equal(v().lastMove.slot, 0);
  for (let i = 0; i < 2000 && v().phase !== 'over'; i++) ctx.advance(TIMING.turnMs + 10);
  assert.equal(v().phase, 'over');
  const total = v().pits.reduce((a, b) => a + b, 0);
  assert.equal(total, 48, 'no stones lost');
});
