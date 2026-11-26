import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Speed, TIMING, fits } from '../server/games/speed.js';
import { speedBot } from '../server/games/speed-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}, seed = 2) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new Speed(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.startMs);
  return { ctx, g };
}

test('one up or one down, and the ace sits next to both the two and the king', () => {
  assert.ok(fits('5H', '4S') && fits('3D', '4S'));
  assert.ok(!fits('6H', '4S') && !fits('4H', '4S'));
  assert.ok(fits('AS', 'KD') && fits('KD', 'AS') && fits('2C', 'AH'));
});

test('the deal: 20 cards each, five spare each side, one up in each middle pile; hands are secret', () => {
  const { g } = setup();
  assert.deepEqual(g.view(null).left, [20, 20]);
  assert.deepEqual(g.view(null).spares, [5, 5]);
  assert.equal(g.hostView().hand, null);
  assert.equal(g.playerView(0).hand.length, 5);
  assert.ok(!JSON.stringify(g.playerView(1)).includes(JSON.stringify(g.hands[0])));
});

test('a card that fits goes on; one that doesn\'t is refused; the hand fills back up', () => {
  const { g } = setup();
  let found = null;
  g.hands[0].forEach((c, i) => [0, 1].forEach((p) => { if (!found && fits(c, g.top(p))) found = { i, p, c }; }));
  if (!found) { g.hands[0][0] = g.top(0) === '5S' ? '6S' : '5S'; g.piles[0].push('4H'); found = { i: 0, p: 0, c: g.hands[0][0] }; }
  const wrong = g.hands[0].findIndex((c) => !fits(c, g.top(0)));
  if (wrong >= 0) {
    g.onInput(0, { type: 'play', card: wrong, pile: 0 });
    assert.equal(g.view(null).left[0], 20);
  }
  g.onInput(0, { type: 'play', card: found.i, pile: found.p });
  assert.equal(g.top(found.p), found.c);
  assert.equal(g.hands[0].length, 5);
  assert.equal(g.view(null).left[0], 19);
  for (const bad of [{ type: 'play', card: 9, pile: 0 }, { type: 'play', card: 0, pile: 2 }, { type: 'play' }]) g.onInput(0, bad);
  assert.equal(g.view(null).left[0], 19);
});

test('stuck: the spare piles turn over (at once if nobody can go, after a while if nobody does)', () => {
  const { ctx, g } = setup();
  g.hands = [['5S', '5H', '5D', '5C', '9S'], ['9H', '9D', '9C', 'JS', 'JH']];
  g.piles = [['KS'], ['KH']];
  g.checkStuck();
  assert.equal(g.stuck, true);
  ctx.advance(TIMING.stuckMs);
  assert.equal(g.flips, 1);
  assert.deepEqual(g.view(null).spares, [4, 4]);
  // The spares running out: the middle piles go back under as new spares.
  g.spares = [[], []];
  g.piles = [['2S', '3S', 'KS'], ['2H', '3H', 'KH']];
  g.hands = [['5S', '5H', '5D', '5C', '9S'], ['9H', '9D', '9C', 'JS', 'JH']];
  g.checkStuck();
  ctx.advance(TIMING.stuckMs);
  assert.equal(g.piles[0].length + g.piles[1].length + g.spares[0].length + g.spares[1].length, 6);
  const idle = setup({}, 7);
  const before = idle.g.flips;
  idle.ctx.advance(TIMING.idleMs + TIMING.stuckMs);
  assert.ok(idle.g.flips > before, 'nobody played for a while: they turn over anyway');
});

test('first out of cards takes the round; first to two wins', () => {
  const { ctx, g } = setup();
  g.hands[1] = ['5S'];
  g.stocks[1] = [];
  g.piles[0] = ['4H'];
  g.onInput(1, { type: 'play', card: 0, pile: 0 });
  assert.equal(g.phase, 'roundEnd');
  assert.deepEqual(g.scores, [0, 1]);
  ctx.advance(TIMING.roundEndMs + TIMING.startMs);
  g.hands[1] = ['5S'];
  g.stocks[1] = [];
  g.piles[0] = ['6H'];
  g.onInput(1, { type: 'play', card: 0, pile: 0 });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 1);
});

test('the computer plays a card that fits, Easy beats a player who never moves, and Hard beats Normal', () => {
  const view = { phase: 'play', you: 1, round: 1, n: 3, tops: ['7S', 'QD'], hand: ['2C', '8H', 'KS', '4D', '9C'] };
  const m = speedBot(view, 'hard', seeded(1));
  assert.ok(fits(view.hand[m.card], view.tops[m.pile]));
  assert.equal(speedBot({ ...view, hand: ['2C', '4D'] }, 'easy'), null);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('speed', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
  let hard = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const flip = seed % 2;
    if (play('speed', flip ? ['normal', 'hard'] : ['hard', 'normal'], { seed }).view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 5);
});
