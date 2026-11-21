import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Blackjack, TIMING, START_CHIPS, total, isBlackjack, shoe } from '../server/games/blackjack.js';
import { blackjackBot, book } from '../server/games/blackjack-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

/** A game whose shoe starts with `top` (the rest of two decks after it, in order). */
function setup(top = [], settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Blackjack(ctx, () => 0.5);
  game.shuffled = () => {
    const rest = shoe();
    for (const c of top) rest.splice(rest.indexOf(c), 1);
    return top.concat(rest);
  };
  game.start();
  return { ctx, game };
}

/** Cards laid out as the deal reads them: both players' two, the dealer's two, its draws, then the players' draws. */
function lay({ you, dealer, dealerDraws = [], draws = [] }) {
  const pad = ['2S', '2H', '2D', '2C', '3S', '3H', '3D', '3C', '4S', '4H', '4D', '4C'].filter((c) => !dealerDraws.includes(c));
  return [...you, ...dealer, ...dealerDraws, ...pad.slice(0, 12 - dealerDraws.length), ...draws];
}

const bet = (game, a = 100, b = 100) => { game.onInput(0, { type: 'bet', amount: a }); game.onInput(1, { type: 'bet', amount: b }); };

test('totals: aces are 1 or 11, pictures 10; a blackjack is 21 in two cards', () => {
  assert.deepEqual(total(['AS', 'KH']), { total: 21, soft: true });
  assert.deepEqual(total(['AS', 'AH', '9D']), { total: 21, soft: true });
  assert.deepEqual(total(['AS', '9H', '5D']), { total: 15, soft: false });
  assert.deepEqual(total(['QS', 'JH', '2D']), { total: 22, soft: false });
  assert.ok(isBlackjack(['AS', 'QD']));
  assert.ok(!isBlackjack(['7S', '7D', '7C']));
  assert.equal(shoe().length, 104);
});

test('bets: a chip you can afford, once; the hand deals when both have bet', () => {
  const { game } = setup();
  assert.equal(game.phase, 'bet');
  for (const amount of [0, 10, 30, 2000, '50', null]) game.onInput(0, { type: 'bet', amount });
  assert.equal(game.bets[0], null);
  game.onInput(0, { type: 'bet', amount: 100 });
  game.onInput(0, { type: 'bet', amount: 200 }); // (already in)
  assert.equal(game.bets[0], 100);
  // The other player sees only that you're in, not how much.
  assert.equal(game.playerView(1).bets[0], true);
  assert.equal(game.playerView(0).bets[0], 100);
  game.onInput(1, { type: 'bet', amount: 50 });
  assert.equal(game.phase, 'deal');
});

test('you both get the same cards, and the other\'s extra cards stay face down while you play', () => {
  const { ctx, game } = setup(lay({ you: ['9S', '5H'], dealer: ['6D', 'KC'], draws: ['7C', '2D'] }));
  bet(game);
  ctx.advance(TIMING.dealMs);
  assert.equal(game.phase, 'play');
  game.onInput(0, { type: 'hit' });
  assert.deepEqual(game.seats[0].hands[0].cards, ['9S', '5H', '7C']);
  const theirs = game.playerView(1).seats[0].hands[0];
  assert.deepEqual(theirs.cards, ['9S', '5H', null], 'face down to the other player');
  assert.equal(theirs.total, null);
  assert.deepEqual(game.hostView().seats[0].hands[0].cards, ['9S', '5H', null], 'and on the TV');
  assert.deepEqual(game.hostView().dealer.cards, ['6D', null], 'the hole card is hidden');
  game.onInput(1, { type: 'hit' });
  assert.deepEqual(game.seats[1].hands[0].cards, ['9S', '5H', '7C'], 'the same card');
});

test('the dealer draws to 17 and the hand pays: a win 1 to 1, a bust loses, chips move', () => {
  const { ctx, game } = setup(lay({ you: ['10S', '6H'], dealer: ['6D', 'KC'], dealerDraws: ['9D'], draws: ['QC'] }));
  bet(game, 100, 200);
  ctx.advance(TIMING.dealMs);
  game.onInput(0, { type: 'stand' });
  game.onInput(1, { type: 'hit' }); // 26: bust
  assert.equal(game.phase, 'reveal');
  assert.deepEqual(game.hostView().seats[1].hands[0].cards, ['10S', '6H', 'QC'], 'both hands show');
  ctx.advance(TIMING.revealMs + TIMING.dealerStepMs * 3);
  assert.equal(game.phase, 'settle');
  assert.deepEqual(game.dealer.cards, ['6D', 'KC', '9D'], '16 draws: 25, bust');
  assert.deepEqual(game.results.map((r) => r[0].outcome), ['win', 'bust']);
  assert.deepEqual(game.chips, [START_CHIPS + 100, START_CHIPS - 200]);
  ctx.advance(TIMING.settleMs);
  assert.equal(game.phase, 'bet');
  assert.equal(game.handNo, 2);
});

test('blackjack pays 3 to 2; a double takes one card for twice the bet', () => {
  const { ctx, game } = setup(lay({ you: ['AS', 'KH'], dealer: ['9D', '8C'] }));
  bet(game, 100, 100);
  ctx.advance(TIMING.dealMs);
  assert.equal(game.phase, 'reveal', 'two blackjacks: nothing to play');
  ctx.advance(TIMING.revealMs + TIMING.dealerStepMs * 2);
  assert.deepEqual(game.chips, [START_CHIPS + 150, START_CHIPS + 150]);

  const d = setup(lay({ you: ['6S', '5H'], dealer: ['9D', '8C'], draws: ['KD'] }));
  bet(d.game, 100, 100);
  d.ctx.advance(TIMING.dealMs);
  assert.deepEqual(d.game.playerView(0).can, { hit: true, stand: true, double: true, split: false });
  d.game.onInput(0, { type: 'double' });
  assert.deepEqual(d.game.seats[0].hands[0].cards, ['6S', '5H', 'KD']);
  assert.equal(d.game.seats[0].hands[0].bet, 200);
  assert.equal(d.game.playerView(1).seats[0].hands[0].bet, 100, 'the double is hidden till the reveal');
  d.game.onInput(1, { type: 'stand' });
  d.ctx.advance(TIMING.revealMs + TIMING.dealerStepMs * 2);
  assert.deepEqual(d.game.chips, [START_CHIPS + 200, START_CHIPS - 100]);
});

test('a split plays two hands, one after the other', () => {
  const { ctx, game } = setup(lay({ you: ['8S', '8H'], dealer: ['6D', 'KC'], dealerDraws: ['QD'], draws: ['3C', '10D', '9H'] }));
  bet(game, 100, 100);
  ctx.advance(TIMING.dealMs);
  assert.equal(game.playerView(0).can.split, true);
  game.onInput(0, { type: 'split' });
  assert.deepEqual(game.seats[0].hands.map((h) => h.cards), [['8S', '3C'], ['8H', '10D']]);
  game.onInput(0, { type: 'split' }); // (once only)
  assert.equal(game.seats[0].hands.length, 2);
  game.onInput(0, { type: 'hit' }); // 8 3 9 = 20
  assert.equal(game.seats[0].at, 0);
  game.onInput(0, { type: 'stand' });
  assert.equal(game.seats[0].at, 1);
  game.onInput(0, { type: 'stand' }); // 18
  game.onInput(1, { type: 'stand' }); // 16
  ctx.advance(TIMING.revealMs + TIMING.dealerStepMs * 3);
  assert.deepEqual(game.results[0].map((r) => r.outcome), ['win', 'win'], 'dealer busts with 26');
  assert.deepEqual(game.chips, [START_CHIPS + 200, START_CHIPS + 100]);
});

test('out of time: you bet what you bet last, then stand; with no timer it waits', () => {
  const { ctx, game } = setup(lay({ you: ['10S', '7H'], dealer: ['10D', '8C'] }));
  game.onInput(0, { type: 'bet', amount: 200 });
  ctx.advance(TIMING.betMs);
  assert.deepEqual(game.bets, [200, 50]);
  ctx.advance(TIMING.dealMs + TIMING.turnMs);
  assert.ok(['reveal', 'dealer'].includes(game.phase));
  const off = setup([], { timer: 'off' });
  off.ctx.advance(TIMING.betMs * 4);
  assert.equal(off.game.phase, 'bet');
});

test('the match: most chips after the last hand wins; out of chips ends it', () => {
  const { ctx, game } = setup([], { hands: 5 });
  assert.equal(game.handsInMatch, 5);
  game.chips = [1200, 900];
  game.handNo = 5;
  game.newHand();
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  game.onInput(1, { type: 'rematch' });
  assert.deepEqual(game.chips, [START_CHIPS, START_CHIPS]);
  game.chips = [10, 900];
  ctx.advance(1);
  game.newHand();
  assert.equal(game.winner, 1);
});

test('the computer: plays the book (Normal, Hard) and bets what it can', () => {
  assert.equal(book(['10S', '6H'], 10, true, false), 'hit');
  assert.equal(book(['10S', '6H'], 6, true, false), 'stand');
  assert.equal(book(['6S', '5H'], 10, true, false), 'double');
  assert.equal(book(['AS', '7H'], 9, true, false), 'hit');
  assert.equal(book(['8S', '8H'], 10, true, true), 'split');
  assert.equal(book(['10S', 'KH'], 6, true, true), 'stand', 'never splits tens');
  assert.equal(book(['9S', '9H'], 7, true, true), 'stand');
  const view = { phase: 'bet', you: 1, bets: [null, null], chips: [1000, 30], betChoices: [25, 50, 100, 200, 500], hand: 1, hands: 8 };
  for (const level of ['easy', 'normal', 'hard']) assert.equal(blackjackBot(view, level).amount, 25, level);
  const easy = blackjackBot({ phase: 'play', you: 0, seats: [{ at: 0, hands: [{ cards: ['10S', '4H'] }] }], dealer: { cards: ['10D', null] }, can: { double: true, split: false } }, 'easy');
  assert.equal(easy.type, 'hit');
});

// Blackjack keeps some luck even with the same cards (a hit that busts where a stand would have
// won), so these count losses, not wins: a draw is the same choices on the same cards.
test('the computer: Hard loses to Easy less than it beats it, and Easy all but never loses to a player who leaves it to the clock', () => {
  const tally = (levels, me) => {
    const out = { won: 0, lost: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const flip = seed % 2;
      const { view } = play('blackjack', flip ? levels.slice().reverse() : levels, { seed });
      assert.equal(view.phase, 'over');
      const mine = flip ? 1 - me : me;
      if (view.winner === mine) out.won++;
      else if (view.winner !== null) out.lost++;
    }
    return out;
  };
  const hard = tally(['hard', 'easy'], 0);
  assert.ok(hard.won > hard.lost, 'Hard against Easy ' + JSON.stringify(hard));
  const easy = tally(['easy', null], 0);
  assert.ok(easy.lost * 10 <= easy.won, 'Easy against nobody ' + JSON.stringify(easy));
});
