import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Holdem, START_CHIPS, BLINDS, TIMING } from '../server/games/holdem.js';
import { evaluate, equity, deck } from '../server/games/holdem-hands.js';
import { fakeCtx } from './helpers.js';
import { seeded } from './helpers-bots.js';

function setup(settings = {}, seed = 4) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Holdem(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.dealMs);
  return { ctx, g };
}
const act = (g, action, to) => g.onInput(g.turn, { type: 'act', action, to });
const total = (g) => g.stacks[0] + g.stacks[1] + g.pot;

test('hands rank the poker way: categories, kickers, the low straight, splits', () => {
  const s = (c) => evaluate(c).score;
  assert.equal(evaluate(['AS', 'KS', 'QS', 'JS', '10S', '2D', '3C']).name, 'Royal flush');
  assert.ok(s(['2H', '5H', '9H', 'JH', 'KH', '3C', '4D']) > s(['5S', '6D', '7C', '8H', '9S', '2D', '3C']), 'flush beats straight');
  assert.ok(s(['KS', 'KD', 'KC', '2H', '2S', '9D', '4C']) > s(['AS', 'AD', 'AC', 'QH', '9S', '2D', '4C']), 'a full house beats three aces');
  assert.ok(s(['AS', '2D', '3C', '4H', '5S', '9D', 'KC']) < s(['2S', '3D', '4C', '5H', '6S', '9D', 'KC']), 'A-2-3-4-5 is the lowest straight');
  assert.ok(s(['AS', 'AD', 'KC', '7H', '5S', '3D', '2C']) > s(['AH', 'AC', 'QC', '7H', '5S', '3D', '2C']), 'the kicker decides');
  assert.equal(s(['AS', 'KD', '2C', '7H', '9S', 'JD', '4C']), s(['AH', 'KC', '2D', '7S', '9H', 'JC', '4D']));
  assert.equal(deck().length, 52);
  assert.ok(equity(['AS', 'AD'], [], 400, seeded(1)) > 0.75);
});

test('the blinds: the button posts the small one and speaks first before the flop', () => {
  const { g } = setup();
  assert.equal(g.button, 0);
  assert.deepEqual(g.bets, [10, 20]);
  assert.equal(g.turn, 0);
  assert.equal(g.phase, 'play');
  assert.equal(total(g), 2 * START_CHIPS);
});

test('your two cards are only on your phone; the board turns over three, one, one', () => {
  const { g } = setup();
  const p0 = g.playerView(0);
  assert.ok(p0.cards[0] && p0.cards[1] === null);
  assert.deepEqual(g.hostView().cards, [null, null]);
  assert.ok(!JSON.stringify(g.playerView(1)).includes(g.hole[0][0] + '"'), 'not in the other phone');
  act(g, 'call');
  act(g, 'check');
  assert.equal(g.phase, 'street');
});

test('a whole hand: bets, raises (min, and up to what the other has), calls and a showdown', () => {
  const { ctx, g } = setup();
  act(g, 'call'); // the small blind makes it 20
  assert.equal(g.turn, 1, 'the big blind has the option');
  act(g, 'raise', 30);
  assert.deepEqual(g.bets, [20, 20], 'too small a raise is refused');
  act(g, 'raise', 60);
  assert.deepEqual(g.bets, [20, 60]);
  act(g, 'raise', 99999);
  assert.deepEqual(g.bets, [20, 60], 'no more than you have');
  act(g, 'call');
  ctx.advance(TIMING.streetMs);
  assert.equal(g.hostView().board.length, 3);
  assert.equal(g.turn, 1, 'after the flop the big blind speaks first');
  for (let street = 0; street < 3; street++) {
    act(g, 'check');
    act(g, 'check');
    if (g.phase === 'street') ctx.advance(TIMING.streetMs);
  }
  assert.equal(g.phase, 'showdown');
  assert.ok(g.hostView().cards.every(Boolean), 'both hands show at a showdown');
  assert.equal(total(g), 2 * START_CHIPS);
  ctx.advance(TIMING.showMs);
  assert.equal(g.handNo, 2);
  assert.equal(g.button, 1);
});

test('a fold gives the pot away and keeps the cards secret; all in runs the board out', () => {
  const { ctx, g } = setup();
  act(g, 'fold');
  assert.equal(g.phase, 'handEnd');
  assert.deepEqual(g.stacks, [START_CHIPS - 10, START_CHIPS + 10]);
  assert.deepEqual(g.hostView().cards, [null, null]);
  ctx.advance(TIMING.foldMs + TIMING.dealMs);
  // (the button now is seat 1: it shoves everything the other can match)
  const opts = g.options(g.turn);
  act(g, 'raise', opts.maxTo);
  act(g, 'call');
  for (let k = 0; k < 4 && g.phase === 'street'; k++) ctx.advance(TIMING.streetMs);
  assert.equal(g.phase, 'showdown');
  assert.equal(g.hostView().board.length, 5);
  assert.equal(total(g), 2 * START_CHIPS);
});

test('out of time: a check when it\'s free, else a fold; the blinds go up; the match ends with every chip', () => {
  const { ctx, g } = setup({ blinds: 3 });
  ctx.advance(TIMING.turnMs);
  assert.equal(g.phase, 'handEnd', 'the small blind timed out facing the big blind: a fold');
  for (let k = 0; k < 3; k++) { ctx.advance(TIMING.foldMs + TIMING.dealMs); if (g.phase === 'play') act(g, 'fold'); }
  assert.deepEqual(g.blinds, BLINDS[1]);
  // Play it out: everyone shoves until someone has it all.
  for (let k = 0; k < 400 && g.phase !== 'over'; k++) {
    if (g.phase === 'play') {
      const o = g.options(g.turn);
      if (o.maxTo !== null) act(g, 'raise', o.maxTo);
      else act(g, o.check ? 'check' : 'call');
    } else ctx.advance(TIMING.showMs);
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.stacks[g.winner], 2 * START_CHIPS);
  for (const bad of [{ type: 'act', action: 'raise', to: 'x' }, { type: 'act', action: 'dance' }]) g.onInput(0, bad);
});

import { holdemBot } from '../server/games/holdem-bot.js';
import { play } from './helpers-bots.js';

test('the computer: only acts on its turn, checks or bets its aces, folds rubbish to a big bet', () => {
  const base = { phase: 'play', you: 1, turn: 1, hand: 1, n: 0, street: 'preflop', button: 1, board: [], bets: [20, 10], pot: 30, cards: [null, ['AS', 'AD']], options: { check: false, call: 10, minTo: 40, maxTo: 1000 } };
  assert.equal(holdemBot({ ...base, turn: 0 }, 'hard'), null);
  assert.equal(holdemBot(base, 'hard', seeded(1)).action, 'raise');
  const junk = { ...base, street: 'river', board: ['KH', 'QC', '9D', '4S', '3C'], cards: [null, ['7S', '2D']], bets: [400, 0], pot: 440, options: { check: false, call: 400, minTo: 800, maxTo: 1000 } };
  assert.equal(holdemBot(junk, 'normal', seeded(2)).action, 'fold');
});

test('the computer: Easy beats a player who leaves it to the clock, and Normal beats Easy more often than not', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    const { view } = play('holdem', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 });
    assert.equal(view.winner, cpu);
  }
  let normal = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const flip = seed % 2;
    const { view } = play('holdem', flip ? ['easy', 'normal'] : ['normal', 'easy'], { seed, limitMs: 6 * 3600 * 1000 });
    if (view.winner === (flip ? 1 : 0)) normal++;
  }
  assert.ok(normal >= 5, 'Normal won ' + normal + ' of 8');
});
