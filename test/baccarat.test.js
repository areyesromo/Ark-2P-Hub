import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Baccarat, TIMING, MIN_BET, totalOf, bankerDraws, dealCoup, payout } from '../server/games/baccarat.js';
import { baccaratBot } from '../server/games/baccarat-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Baccarat(ctx, seeded(2));
  g.start();
  return { ctx, g };
}

test('counting, the third-card rules, and pay-outs', () => {
  assert.equal(totalOf(['7H', '8C']), 5);
  assert.equal(totalOf(['KH', 'AC']), 1);
  assert.equal(bankerDraws(5, null), true);
  assert.equal(bankerDraws(6, null), false);
  assert.equal(bankerDraws(3, 8), false);
  assert.equal(bankerDraws(6, 7), true);
  assert.equal(bankerDraws(4, 1), false);
  // A natural: nobody draws. Cards come from the end of the list.
  const deal = (cards) => { const c = cards.slice(); return dealCoup(() => c.shift()); };
  assert.deepEqual(deal(['9H', 'KC', '2D', '3S']).player.length, 2);
  // Player 2 + 3 = 5 draws a 7 (12: 2); Banker 4 + 2 = 6 draws on a 7.
  const d = deal(['2H', '3C', '4D', '2S', '7H', '5C']);
  assert.deepEqual([d.player.length, d.banker.length], [3, 3]);
  assert.deepEqual(d.totals, { player: 2, banker: 1 });
  assert.equal(d.winner, 'player');
  assert.equal(payout({ side: 'banker', amount: 100 }, 'banker'), 95);
  assert.equal(payout({ side: 'player', amount: 100 }, 'tie'), 0);
  assert.equal(payout({ side: 'tie', amount: 50 }, 'tie'), 400);
  assert.equal(payout({ side: 'tie', amount: 50 }, 'banker'), -50);
});

test('secret bets, checked input, and out of time sits out for the least bet', () => {
  const { ctx, g } = setup();
  for (const bad of [{ type: 'bet', side: 'house', amount: 100 }, { type: 'bet', side: 'banker', amount: 10 }, { type: 'bet', side: 'banker', amount: 110 }, { type: 'bet', side: 'banker', amount: 2000 }]) g.onInput(0, bad);
  assert.equal(g.bets[0], null);
  g.onInput(0, { type: 'bet', side: 'player', amount: 200 });
  assert.equal(g.playerView(1).bets[0], null);
  assert.equal(g.hostView().bets[0], null);
  assert.deepEqual(g.playerView(0).bets[0], { side: 'player', amount: 200 });
  ctx.advance(TIMING.betMs);
  assert.equal(g.phase, 'deal');
  assert.equal(g.result.change[1], -MIN_BET);
  assert.equal(g.chips[0], 1000 + payout({ side: 'player', amount: 200 }, g.coup.winner));
});

test('the match runs its coups, and the computer plays the match', () => {
  const { ctx, g } = setup({ coups: 6 });
  for (let k = 0; k < 6; k++) {
    g.onInput(0, { type: 'bet', side: 'banker', amount: 25 });
    g.onInput(1, { type: 'bet', side: 'player', amount: 25 });
    ctx.advance(TIMING.dealMs);
  }
  assert.equal(g.phase, 'over');
  // Hard, ahead, shadows what they usually bet; behind, it bets the other way.
  const history = [1, 2, 3].map(() => ({ winner: 'banker', bets: [{ side: 'player', amount: 100 }, { side: 'banker', amount: 50 }] }));
  const v = (chips) => ({ phase: 'bet', you: 1, locked: [false, false], maxBets: [500, 500], coup: 5, coups: 10, chips, history });
  assert.equal(baccaratBot(v([900, 1100]), 'hard', seeded(1)).side, 'player');
  assert.equal(baccaratBot(v([1100, 900]), 'hard', seeded(1)).side, 'banker');
  // (Luck plays its part: Easy beats a player who leaves it to the clock about four times in five.)
  for (const seed of [1, 2, 5, 6]) {
    const cpu = seed % 2;
    assert.equal(play('baccarat', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
