import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Spades, TIMING, legalPlays, trickWinner, handScore, MAX_HANDS } from '../server/games/spades.js';
import { spadesBot } from '../server/games/spades-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}, seed = 3) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Spades(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('tricks: follow suit; a spade takes anything else; spades can\'t be led till broken', () => {
  assert.equal(trickWinner('10H', 'QH'), 1);
  assert.equal(trickWinner('10H', '4H'), 0);
  assert.equal(trickWinner('AH', '2S'), 1, 'a trump');
  assert.equal(trickWinner('3S', 'AH'), 0, 'off suit loses');
  assert.deepEqual(legalPlays(['2H', '5S', 'KD'], 'QH', false), ['2H']);
  assert.deepEqual(legalPlays(['5S', 'KD'], 'QH', false), ['5S', 'KD'], 'none of the suit: anything');
  assert.deepEqual(legalPlays(['5S', 'KD'], null, false), ['KD'], 'no spade lead yet');
  assert.deepEqual(legalPlays(['5S', '9S'], null, false), ['5S', '9S'], '…unless that\'s all you have');
});

test('scoring: a bid made, over (bags), short, and nil', () => {
  assert.deepEqual(handScore(4, 4), { points: 40, bags: 0 });
  assert.deepEqual(handScore(4, 6), { points: 42, bags: 2 });
  assert.deepEqual(handScore(4, 3), { points: -40, bags: 0 });
  assert.deepEqual(handScore(0, 0), { points: 100, bags: 0 });
  assert.deepEqual(handScore(0, 1), { points: -100, bags: 1 });
});

test('the draw: keep the card shown or take the next; only the drawer sees it; 13 each', () => {
  const { g } = setup();
  const s = g.turn;
  const shown = g.offer;
  assert.equal(g.playerView(s).offer, shown);
  assert.equal(g.playerView(1 - s).offer, null);
  assert.equal(g.hostView().offer, null);
  g.onInput(s, { type: 'draw', keep: false });
  assert.ok(!g.hands[s].includes(shown), 'passed: the next card instead');
  for (let k = 0; k < 60 && g.phase === 'draw'; k++) g.onInput(g.turn, { type: 'draw', keep: true });
  assert.equal(g.phase, 'bid');
  assert.deepEqual(g.hands.map((h) => h.length), [13, 13]);
  assert.ok(!JSON.stringify(g.playerView(1)).includes(JSON.stringify(g.hands[0])));
});

test('a whole hand: bids, 13 tricks, the score; out of time plays the lowest card that may go', () => {
  const { ctx, g } = setup();
  for (let k = 0; k < 60 && g.phase === 'draw'; k++) g.onInput(g.turn, { type: 'draw', keep: true });
  g.onInput(g.turn, { type: 'bid', bid: 14 });
  assert.equal(g.bids.filter((b) => b !== null).length, 0, 'no bid over 13');
  g.onInput(g.turn, { type: 'bid', bid: 3 });
  g.onInput(g.turn, { type: 'bid', bid: 0 });
  assert.equal(g.phase, 'play');
  for (let k = 0; k < 60 && g.phase !== 'handEnd' && g.phase !== 'over'; k++) {
    if (g.phase === 'trick') ctx.advance(TIMING.trickMs);
    else ctx.advance(TIMING.turnMs);
  }
  assert.equal(g.tricks[0] + g.tricks[1], 13);
  assert.ok(g.result);
});

test('the computer keeps good cards, bids sensibly, and Easy beats a player who leaves it to the clock', () => {
  assert.equal(spadesBot({ phase: 'draw', you: 1, turn: 1, deal: 1, n: 0, hand: [], offer: 'AS' }, 'normal').keep, true);
  assert.equal(spadesBot({ phase: 'draw', you: 1, turn: 1, deal: 1, n: 0, hand: [], offer: '3H' }, 'normal').keep, false);
  const strong = ['AS', 'KS', 'QS', 'JS', '10S', 'AH', 'AD', 'AC', 'KH', '2D', '3D', '4C', '5C'];
  assert.ok(spadesBot({ phase: 'bid', you: 0, turn: 0, deal: 1, n: 0, hand: strong }, 'normal').bid >= 7);
  assert.equal(MAX_HANDS, 12);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('spades', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 10 * 3600 * 1000 }).view.winner, cpu);
  }
});
