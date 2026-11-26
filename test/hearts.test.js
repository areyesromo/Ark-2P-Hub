import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hearts, TIMING, legalPlays, trickWinner, handPoints } from '../server/games/hearts.js';
import { heartsBot } from '../server/games/hearts-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Hearts(ctx, seeded(4));
  g.start();
  return { ctx, g };
}

test('the rules: follow suit, no trumps, no leading hearts till they break, points', () => {
  assert.deepEqual(legalPlays(['2H', '5C', 'KH'], null, false), ['5C']);
  assert.deepEqual(legalPlays(['2H', 'KH'], null, false), ['2H', 'KH'], 'only hearts: lead one');
  assert.deepEqual(legalPlays(['2H', '5C', 'KH'], '9H', false), ['2H', 'KH']);
  assert.equal(trickWinner('9C', 'AS'), 0, 'no trumps: off suit never takes it');
  assert.equal(trickWinner('9C', 'JC'), 1);
  assert.deepEqual(handPoints([['QS', '2H'], ['3H', '4H', '5H']]), [14, 3]);
});

test('drawing builds 13 each and the offer stays with whoever is drawing', () => {
  const { g } = setup();
  const drawer = g.turn;
  assert.ok(g.playerView(drawer).offer);
  assert.equal(g.playerView(1 - drawer).offer, null);
  assert.equal(g.hostView().offer, null);
  while (g.phase === 'draw') g.onInput(g.turn, { type: 'draw', keep: g.n % 2 === 0 });
  assert.deepEqual(g.hands.map((h) => h.length), [13, 13]);
  assert.equal(g.phase, 'play');
  assert.ok(!g.playerView(0).hand.some((c) => g.playerView(1).hand.includes(c)));
});

test('a hand played out: points go to whoever takes them; out of time plays the highest card', () => {
  const { ctx, g } = setup({ target: 30 });
  while (g.phase === 'draw') g.onInput(g.turn, { type: 'draw', keep: true });
  const s = g.turn;
  const lead = g.playerView(s).legal;
  g.onInput(s, { type: 'play', card: 'nope' });
  g.onInput(1 - s, { type: 'play', card: g.hands[1 - s][0] }); // not their turn
  assert.equal(g.trick.length, 0);
  ctx.advance(TIMING.turnMs);
  const played = g.trick[0].card;
  assert.ok(lead.includes(played));
  const rank = (c) => ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(c.slice(0, -1));
  assert.equal(rank(played), Math.max(...lead.map(rank)));
  for (let k = 0; k < 200 && g.phase !== 'handEnd' && g.phase !== 'over'; k++) {
    if (g.phase === 'trick') ctx.advance(TIMING.trickMs);
    else g.onInput(g.turn, { type: 'play', card: g.playerView(g.turn).legal[0] });
  }
  const total = g.taken.flat().reduce((t, c) => t + (c === 'QS' ? 13 : c.endsWith('H') ? 1 : 0), 0);
  assert.equal(g.scores[0] + g.scores[1], total);
});

test('the computer ducks and dumps the queen, and Easy beats a player who leaves it to the clock', () => {
  const v = (hand, trick, legal) => ({ phase: 'play', turn: 1, you: 1, hand, legal, trick, deal: 1, n: 30, playedCards: [], handCounts: [5, 5], broken: true, lastTrick: null });
  assert.equal(heartsBot(v(['3D', '9D', 'KD'], [{ by: 0, card: 'JD' }], ['3D', '9D', 'KD']), 'normal', seeded(1)).card, '9D');
  assert.equal(heartsBot(v(['QS', '4H', 'AC'], [{ by: 0, card: '5D' }], ['QS', '4H', 'AC']), 'normal', seeded(1)).card, 'QS');
  for (const seed of [1, 2, 3]) {
    const cpu = seed % 2;
    assert.equal(play('hearts', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
