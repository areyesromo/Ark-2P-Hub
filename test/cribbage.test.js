import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cribbage, TIMING, scoreHand, pegPoints, valueOf } from '../server/games/cribbage.js';
import { fakeCtx } from './helpers.js';
import { seeded } from './helpers-bots.js';

function setup(settings = {}, seed = 3) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Cribbage(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('counting a hand: fifteens, pairs, runs, flushes and nobs (the famous 29)', () => {
  assert.equal(scoreHand(['5H', '5D', '5C', 'JS'], '5S').total, 29);
  assert.equal(scoreHand(['4H', '5D', '6C', '6S'], 'KD').total, 6 + 2 + 6, 'three 15s (4-5-6 twice, 5-K), a pair, a double run of three');
  assert.equal(scoreHand(['2H', '4H', '6H', '8H'], 'KD').total, 4, 'a flush of four (and no 15)');
  assert.equal(scoreHand(['2H', '4H', '6H', '8H'], 'KD', true).total, 0, 'the crib needs five for a flush');
  assert.equal(scoreHand(['AS', '2D', '3C', '4H'], '9S').total, 4 + 4, 'a run of four and two 15s (A-2-3-9, 2-4-9)');
  assert.equal(scoreHand(['JH', '2D', '7C', '9S'], '3H').total, 1 + 2, 'his nobs, and one 15 (J-2-3)');
  assert.equal(valueOf('KD'), 10);
});

test('pegging: 15 and 31, pairs, runs in any order', () => {
  assert.deepEqual(pegPoints(['7S', '8D']), { pts: 2, why: ['15'] });
  assert.equal(pegPoints(['9S', '9D']).pts, 2);
  assert.equal(pegPoints(['9S', '9D', '9C']).pts, 6);
  assert.equal(pegPoints(['4S', '6D', '5C']).pts, 3 + 2, 'a run of three in any order, and 15');
  assert.equal(pegPoints(['KS', 'QD', 'JC', 'AS']).pts, 2 + 0, '31');
  assert.equal(pegPoints(['3S', '4D', '3C']).pts, 0);
});

test('the deal: six each, secret; two each into the crib; the cut; the non-dealer leads', () => {
  const { ctx, g } = setup();
  assert.equal(g.dealer, 0);
  assert.equal(g.playerView(1).hand.length, 6);
  assert.equal(g.hostView().hand, null);
  assert.ok(!JSON.stringify(g.playerView(1)).includes(JSON.stringify(g.hands[0])));
  g.onInput(0, { type: 'discard', cards: [0, 0] });
  g.onInput(0, { type: 'discard', cards: [0, 9] });
  assert.equal(g.discarded[0], false);
  g.onInput(0, { type: 'discard', cards: [0, 1] });
  g.onInput(1, { type: 'discard', cards: [4, 5] });
  assert.equal(g.crib.length, 4);
  ctx.advance(TIMING.cutMs);
  assert.ok(g.starter);
  if (g.phase === 'play') assert.equal(g.turn, 1);
});

test('the play: never past 31; go; the last card pegs 1; then the show counts both hands and the crib', () => {
  const { ctx, g } = setup({ target: 121 });
  g.onInput(0, { type: 'discard', cards: [0, 1] });
  g.onInput(1, { type: 'discard', cards: [0, 1] });
  ctx.advance(TIMING.cutMs);
  if (g.phase !== 'play') return; // (his heels can't end it this early; just in case)
  // Fix the cards for a known play.
  g.hands = [['10S', 'JD', 'KC', '5H'], ['QS', '9D', '3C', 'AH']];
  g.kept = [g.hands[0].slice(), g.hands[1].slice()];
  g.turn = 1;
  const lay = (s, card) => g.onInput(s, { type: 'lay', card: g.hands[s].indexOf(card) });
  lay(1, 'QS'); // 10
  lay(0, '5H'); // 15: 2 to seat 0
  assert.equal(g.scores[0], 2);
  lay(1, '9D'); // 24
  lay(0, 'KC'); // 34? refused
  assert.equal(g.count, 24);
  // Seat 0 can't go (10, J, K all too big): seat 1 plays on.
  assert.equal(g.turn, 1);
  lay(1, '3C'); // 27
  lay(1, 'AH'); // 28, then nobody can: go, 1 to seat 1
  ctx.advance(TIMING.goMs);
  assert.equal(g.count, 0);
  assert.equal(g.turn, 0);
  lay(0, '10S');
  lay(0, 'JD');
  lay(0, 'KC'); // 30, the last card of all: 1
  ctx.advance(TIMING.goMs);
  for (let k = 0; k < 4; k++) ctx.advance(TIMING.showStepMs + TIMING.nextMs);
  assert.ok(g.dealNo >= 2 || g.phase === 'over');
});

test('out of time: the two lowest go in the crib (and that hand won\'t count), the highest card that fits is laid; a short game to 61; the first there wins at once', () => {
  const { ctx, g } = setup({ target: 61 });
  ctx.advance(TIMING.discardMs);
  assert.equal(g.crib.length, 4);
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 2000) ctx.advance(TIMING.turnMs);
  assert.equal(g.phase, 'over');
  assert.equal(g.scores[g.winner], 61);
});

import { cribbageBot } from '../server/games/cribbage-bot.js';
import { play } from './helpers-bots.js';

test('the computer: keeps a good hand, lays what pegs, and Easy beats a player who leaves it to the clock', () => {
  const view = { phase: 'discard', you: 1, dealer: 0, deal: 1, discarded: [false, false], hand: ['5S', '5H', 'JD', 'QC', '2S', '9D'] };
  const d = cribbageBot(view, 'normal', seeded(1));
  const kept = view.hand.filter((_, i) => !d.cards.includes(i));
  assert.ok(kept.includes('5S') && kept.includes('5H'), 'keeps the fives');
  const lay = cribbageBot({ phase: 'play', you: 1, turn: 1, deal: 1, count: 8, seq: [{ card: '8S', by: 0 }], hand: ['7D', 'KC'] }, 'hard', seeded(2));
  assert.equal(lay.card, 0, '8 + 7 is 15');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('cribbage', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
