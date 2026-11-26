import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoFish, TIMING, HAND } from '../server/games/go-fish.js';
import { goFishBot } from '../server/games/go-fish-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(seed = 3) {
  const ctx = fakeCtx();
  const g = new GoFish(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('the deal: seven each, secret; the rest in the pond', () => {
  const { g } = setup();
  assert.equal(g.hands[0].length + g.books[0].length * 4, HAND);
  assert.equal(g.pond.length, 52 - 2 * HAND);
  assert.equal(g.hostView().hand, null);
  assert.ok(!JSON.stringify(g.playerView(1)).includes(JSON.stringify(g.hands[0])));
});

test('asking: they hand over every one and you go again; go fish passes the turn unless you draw it', () => {
  const { g } = setup();
  g.turn = 0;
  g.hands = [['7S', '9D'], ['7H', '7C', 'KD']];
  g.pond = ['2C', '3C', '9H'];
  g.onInput(0, { type: 'ask', rank: 'K' });
  assert.deepEqual(g.hands[0], ['7S', '9D'], 'you can only ask for a rank you hold');
  g.onInput(0, { type: 'ask', rank: '7' });
  assert.equal(g.hands[0].filter((c) => c.startsWith('7')).length, 3);
  assert.equal(g.turn, 0, 'a hit: go again');
  g.onInput(0, { type: 'ask', rank: '9' }); // none: go fish, draws 9H: the card asked for
  assert.equal(g.log.at(-1).lucky, true);
  assert.equal(g.turn, 0);
  g.onInput(0, { type: 'ask', rank: '7' }); // none: go fish, draws 3C
  assert.equal(g.turn, 1);
});

test('four of a rank is a book; when all thirteen are down the most books wins', () => {
  const { g } = setup();
  g.turn = 0;
  g.hands = [['QS', 'QH', 'QD'], ['QC', '2D']];
  g.pond = ['5S'];
  g.books = [['A', '2', '3', '4', '5', '6'], ['7', '8', '9', '10', 'J', 'K']];
  g.onInput(0, { type: 'ask', rank: 'Q' });
  assert.ok(g.books[0].includes('Q'));
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
});

test('out of time: you fish without asking; the computer hits what it knows, and Easy beats a player who leaves it to the clock', () => {
  const { ctx, g } = setup();
  const s = g.turn;
  const before = g.hands[s].length + g.books[s].length * 4;
  ctx.advance(TIMING.turnMs);
  assert.equal(g.turn, 1 - s);
  assert.equal(g.log.at(-1).rank, null);
  assert.ok(g.hands[s].length + g.books[s].length * 4 >= before);
  const view = { phase: 'play', you: 1, turn: 1, n: 4, hand: ['7S', '9D', '9H'], handCounts: [5, 3], pond: 30, books: [[], []], log: [{ by: 0, rank: '7', got: 0, fished: true, n: 3 }] };
  assert.equal(goFishBot(view, 'normal', seeded(1)).rank, '7', 'they asked for sevens: they hold one');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('go-fish', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
