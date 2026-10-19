import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiarsDice, isRaise, countFace, TIMING } from '../server/games/liars-dice.js';
import { DiceParty, BOXES, totals } from '../server/games/dice-party.js';
import { listGames } from '../server/games/index.js';
import { fakeCtx } from './helpers.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("both dice games sit in the lobby's Dice & Board group", () => {
  const board = listGames().filter((g) => g.category === 'board').map((g) => g.id);
  for (const id of ['dice-party', 'liars-dice']) assert.ok(board.includes(id), id);
});

// ---- Liar's Dice ----

test("Liar's Dice: bids must go up; wild ones count for every face (and can't be bid)", () => {
  assert.equal(isRaise(null, { qty: 2, face: 3 }, 10, true), true);
  assert.equal(isRaise({ qty: 2, face: 3 }, { qty: 2, face: 3 }, 10, true), false, 'same bid');
  assert.equal(isRaise({ qty: 2, face: 3 }, { qty: 2, face: 4 }, 10, true), true, 'same number, higher face');
  assert.equal(isRaise({ qty: 2, face: 6 }, { qty: 3, face: 2 }, 10, true), true, 'more dice, any face');
  assert.equal(isRaise({ qty: 2, face: 3 }, { qty: 1, face: 6 }, 10, true), false, 'fewer dice');
  assert.equal(isRaise(null, { qty: 11, face: 3 }, 10, true), false, 'more dice than there are');
  assert.equal(isRaise(null, { qty: 2, face: 1 }, 10, true), false, 'no bidding on wild ones');
  assert.equal(isRaise(null, { qty: 2, face: 1 }, 10, false), true);
  assert.equal(countFace([[1, 3, 3], [3, 1, 5]], 3, true), 5);
  assert.equal(countFace([[1, 3, 3], [3, 1, 5]], 3, false), 3);
});

test("Liar's Dice: dice stay secret until a challenge; the wrong side loses a die; out of dice loses the game", () => {
  const ctx = fakeCtx();
  const g = new LiarsDice(ctx, seeded(4));
  g.start();
  const first = g.turn;
  assert.equal(g.playerView(first).mine.length, 5);
  assert.equal(g.playerView(1 - first).mine.length, 5);
  assert.equal(g.hostView().hands, null, 'the TV only sees the cups');
  assert.equal(g.playerView(first).hands, null, "no peeking at the other player's dice");
  g.onInput(1 - first, { type: 'bid', qty: 1, face: 2 }); // not your turn
  assert.equal(g.bid, null);
  g.onInput(first, { type: 'liar' }); // nothing to call yet
  assert.equal(g.phase, 'bidding');
  // Bid exactly what's there: calling liar on it loses the caller a die.
  const face = 4;
  const actual = countFace(g.hands, face, true);
  g.onInput(first, { type: 'bid', qty: Math.max(1, actual), face });
  g.onInput(1 - first, { type: 'liar' });
  assert.equal(g.phase, 'reveal');
  assert.equal(g.result.loser, actual >= 1 ? 1 - first : first);
  assert.deepEqual(g.hostView().hands, g.result.hands, 'cups lift');
  const loser = g.result.loser;
  ctx.advance(TIMING.revealMs + 1);
  assert.equal(g.phase, 'bidding');
  assert.equal(g.counts[loser], 4);
  assert.equal(g.turn, loser, 'the loser opens the next round');
  // Keep losing the same way until someone is out.
  while (g.phase !== 'over') {
    const t = g.turn;
    g.onInput(t, { type: 'bid', qty: g.total, face: 6 }); // almost surely too many
    g.onInput(1 - t, { type: 'liar' });
    if (g.phase === 'reveal') ctx.advance(TIMING.revealMs + 1);
  }
  assert.ok(g.winner === 0 || g.winner === 1);
  assert.equal(g.counts[1 - g.winner], 0);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(0, { type: 'rematch' });
  assert.deepEqual(g.counts, [5, 5]);
});

test("Liar's Dice: settings for dice and wild ones", () => {
  const ctx = fakeCtx();
  ctx.settings = { dice: 3, wild: 0 };
  const g = new LiarsDice(ctx, seeded(1));
  g.start();
  assert.deepEqual(g.counts, [3, 3]);
  assert.equal(g.wild, false);
});

// ---- Dice Party ----

test('Dice Party: the scoring boxes', () => {
  const s = (id, d) => BOXES.find((b) => b.id === id).score(d);
  assert.equal(s('threes', [3, 3, 1, 3, 6]), 9);
  assert.equal(s('three', [3, 3, 1, 3, 6]), 16);
  assert.equal(s('four', [3, 3, 1, 3, 6]), 0);
  assert.equal(s('house', [2, 2, 5, 5, 5]), 25);
  assert.equal(s('house', [5, 5, 5, 5, 5]), 0);
  assert.equal(s('small', [1, 3, 2, 4, 6]), 30);
  assert.equal(s('small', [1, 3, 2, 5, 6]), 0);
  assert.equal(s('large', [2, 3, 4, 5, 6]), 40);
  assert.equal(s('yahtzee', [4, 4, 4, 4, 4]), 50);
  assert.equal(s('chance', [1, 2, 3, 4, 6]), 16);
  const card = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18, chance: 20 };
  assert.deepEqual(totals(card), { upper: 63, bonus: 35, lower: 20, total: 118 });
});

test('Dice Party: roll up to three times holding dice, score each box once, turns alternate, highest total wins', () => {
  const ctx = fakeCtx();
  ctx.settings = { rounds: 13 };
  const g = new DiceParty(ctx, seeded(5));
  g.start();
  const first = g.turn;
  g.onInput(first, { type: 'score', box: 'chance' }); // must roll first
  assert.equal(g.cards[first].chance, undefined);
  g.onInput(1 - first, { type: 'roll' }); // not your turn
  assert.equal(g.rollsLeft, 3);
  g.onInput(first, { type: 'roll' });
  const kept = g.dice[0];
  g.onInput(first, { type: 'hold', die: 0 });
  g.onInput(first, { type: 'roll' });
  g.onInput(first, { type: 'roll' });
  g.onInput(first, { type: 'roll' }); // only three
  assert.equal(g.rollsLeft, 0);
  assert.equal(g.dice[0], kept, 'held die stays');
  const expect = g.dice.reduce((a, b) => a + b, 0);
  assert.equal(g.view().options.chance, expect);
  g.onInput(first, { type: 'score', box: 'chance' });
  assert.equal(g.cards[first].chance, expect);
  assert.equal(g.turn, 1 - first);
  // Play the rest: each turn roll once and take the first open box.
  while (g.phase !== 'over') {
    const t = g.turn;
    g.onInput(t, { type: 'roll' });
    const open = BOXES.find((b) => g.cards[t][b.id] === undefined);
    g.onInput(t, { type: 'score', box: open.id });
  }
  assert.ok(g.cards.every((c) => Object.keys(c).length === 13));
  const [a, b] = g.cards.map((c) => totals(c).total);
  assert.equal(g.winner, a === b ? null : a > b ? 0 : 1);
  assert.deepEqual(g.hostView().scores, [a, b]);
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.turn, 1 - first, 'the other player starts the rematch');
});

test('Dice Party: a quick game is 6 turns each', () => {
  const ctx = fakeCtx();
  ctx.settings = { rounds: 6 };
  const g = new DiceParty(ctx, seeded(2));
  g.start();
  for (let k = 0; k < 12; k++) {
    g.onInput(g.turn, { type: 'roll' });
    g.onInput(g.turn, { type: 'score', box: BOXES[Math.floor(k / 2)].id });
  }
  assert.equal(g.phase, 'over');
});
