import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedDog, TIMING, ANTE, payFor, spreadOf } from '../server/games/red-dog.js';
import { redDogBot } from '../server/games/red-dog-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

/** A game whose deck deals `cards` first (the pack is drawn from the end). */
function setup(cards, settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new RedDog(ctx, seeded(1));
  g.start();
  g.pack = g.pack.filter((c) => !cards.includes(c)).concat(cards.slice().reverse());
  g.handNo = 0;
  g.newHand();
  return { ctx, g };
}

test('spreads and what they pay', () => {
  assert.equal(spreadOf(['4H', '9C']), 4);
  assert.equal(spreadOf(['AH', '2C']), 11);
  assert.equal(spreadOf(['7H', '8C']), 0);
  assert.equal(spreadOf(['7H', '7C']), -1);
  assert.deepEqual([1, 2, 3, 4, 11].map(payFor), [5, 4, 2, 1, 1]);
});

test('secret raises; inside pays by the spread, outside loses the lot, out of time folds', () => {
  const { ctx, g } = setup(['3H', 'JC', '8D', '5S', '9H', 'KD']);
  assert.equal(g.phase, 'raise');
  g.onInput(0, { type: 'raise', raise: 2 });
  assert.equal(g.playerView(1).raises[0], null, 'their raise stays secret');
  assert.equal(g.hostView().raises[0], null);
  for (const bad of [{ type: 'raise', raise: 3 }, { type: 'raise', raise: -1 }, { type: 'raise', raise: '1' }]) g.onInput(1, bad);
  g.onInput(1, { type: 'raise', raise: 0 });
  // 8 is inside 3 … J (spread 7, evens): 150 in wins 150, 50 in wins 50.
  assert.deepEqual(g.result.change, [3 * ANTE, ANTE]);
  ctx.advance(TIMING.revealMs);
  // 5 … 9, then K: outside. Player 1 raises one, player 2 runs out of time.
  g.onInput(0, { type: 'raise', raise: 1 });
  ctx.advance(TIMING.raiseMs);
  assert.deepEqual(g.result.change, [-2 * ANTE, -ANTE]);
  assert.deepEqual(g.result.raises, [1, 'fold']);
});

test('a pair turns the third card at once; three of a kind pays 11 to 1', () => {
  const { g } = setup(['7H', '7C', '7D']);
  assert.equal(g.result.outcome, 'trips');
  assert.deepEqual(g.result.change, [11 * ANTE, 11 * ANTE]);
});

test('the computer raises on good odds, not bad, and Easy beats a player who leaves it to the clock', () => {
  const view = (posts, inside, packLeft) => ({ phase: 'raise', you: 1, raises: [null, null], hand: 3, hands: 12, chips: [1000, 1000], posts, spread: spreadOf(posts), inside, packLeft });
  assert.equal(redDogBot(view(['2H', 'AC'], 40, 46), 'normal', seeded(1)).raise, 2);
  assert.equal(redDogBot(view(['5H', '8C'], 8, 46), 'normal', seeded(1)).raise, 0);
  // Hard counts: spread 6 is a loser on a fresh deck, but not when the deck is rich inside.
  assert.equal(redDogBot(view(['3H', '10C'], 20, 30), 'hard', seeded(1)).raise, 2);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('red-dog', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
