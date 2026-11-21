import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GinRummy, TIMING, best, layOff, deck } from '../server/games/gin-rummy.js';
import { ginRummyBot } from '../server/games/gin-rummy-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new GinRummy(ctx, seeded(4));
  game.start();
  return { ctx, game };
}

test('melds: sets and runs (ace low), the arrangement with the least deadwood', () => {
  const b = best(['7S', '7H', '7D', '8S', '9S', '10S', 'KC', 'AH', '2H', '3H']);
  assert.equal(b.points, 10, 'K left over');
  assert.deepEqual(b.deadwood, ['KC']);
  // 7S fits the set or the run: it goes where it leaves less.
  const c = best(['7S', '7H', '7D', '8S', '9S', 'QD', 'QC', '2C', '4H', '5D']);
  assert.equal(c.points, 45, 'the run 7 8 9 of spades (45 left) beats the set of 7s (48 left)');
  assert.equal(best(['QS', 'KS', 'AS']).points, 21, 'no going round the corner');
  assert.equal(deck().length, 52);
});

test('laying off: the other\'s spare cards go on the knocker\'s melds', () => {
  const r = layOff([['5H', '6H', '7H'], ['9C', '9D', '9S']], ['4H', '8H', '9H', 'KD']);
  assert.deepEqual(r.laid.sort(), ['4H', '8H', '9H'].sort());
  assert.deepEqual(r.left, ['KD']);
});

test('a turn: draw (from the deck or the pile), then throw one away; the other\'s hand stays secret', () => {
  const { game } = setup();
  const s = game.turn;
  assert.equal(game.playerView(s).cards.length, 10);
  assert.ok(!('cards' in game.hostView()));
  assert.ok(!JSON.stringify(game.playerView(1 - s)).includes(JSON.stringify(game.hands[s])));
  game.onInput(1 - s, { type: 'draw', from: 'stock' }); // not their turn
  game.onInput(s, { type: 'discard', card: game.hands[s][0] }); // must draw first
  assert.equal(game.hands[s].length, 10);
  const top = game.pile[game.pile.length - 1];
  game.onInput(s, { type: 'draw', from: 'pile' });
  assert.equal(game.hands[s].length, 11);
  game.onInput(s, { type: 'discard', card: top }); // not straight back
  game.onInput(s, { type: 'discard', card: 'ZZ' });
  assert.equal(game.phase, 'discard');
  const card = game.hands[s].find((c) => c !== top);
  game.onInput(s, { type: 'discard', card });
  assert.equal(game.pile[game.pile.length - 1], card);
  assert.equal(game.turn, 1 - s);
  assert.equal(game.phase, 'draw');
});

test('a knock: only with 10 or less; the other lays off; the difference scores', () => {
  const { game } = setup();
  const s = game.turn;
  const o = 1 - s;
  game.hands[s] = ['7S', '7H', '7D', '8C', '9C', '10C', 'AH', '2H', '3H', '4S'];
  game.hands[o] = ['JC', 'QC', 'KS', 'KH', '5D', '6D', '8D', '9D', '2S', '3S'];
  game.phase = 'draw';
  game.stock.push('KD');
  game.onInput(s, { type: 'draw', from: 'stock' });
  game.onInput(s, { type: 'knock', card: '7D' }); // would leave 7 + 4 = 11: no
  assert.equal(game.phase, 'discard');
  game.onInput(s, { type: 'knock', card: 'KD' });
  assert.equal(game.phase, 'show');
  const r = game.result;
  assert.equal(r.kind, 'knock');
  assert.equal(r.shown[s].points, 4);
  assert.deepEqual(r.shown[o].laid, ['JC', 'QC'], 'J then Q on the 8 9 10 of clubs');
  assert.equal(r.shown[o].points, 10 + 10 + 5 + 6 + 8 + 9 + 2 + 3);
  assert.equal(r.points, 53 - 4);
  assert.equal(game.scores[s], 49);
});

test('gin scores 25 more (no laying off); an undercut gives the other the difference and 25', () => {
  const { game } = setup();
  const s = game.turn;
  const o = 1 - s;
  game.hands[s] = ['7S', '7H', '7D', '8C', '9C', '10C', 'AH', '2H', '3H', 'KD'];
  game.hands[o] = ['JC', 'QS', 'KS', 'KH', '5D', '6D', '8D', '9D', '2S', '3S'];
  game.stock.push('4H');
  game.onInput(s, { type: 'draw', from: 'stock' });
  game.onInput(s, { type: 'knock', card: 'KD' });
  assert.equal(game.result.kind, 'gin');
  assert.deepEqual(game.result.shown[o].laid, []);
  assert.equal(game.result.points, game.result.shown[o].points + 25);

  const u = setup();
  const k = u.game.turn;
  u.game.phase = 'discard';
  u.game.hands[k] = ['7S', '7H', '7D', '8C', '9C', '10C', 'AH', '2H', '3H', '5S', 'QH'];
  u.game.hands[1 - k] = ['2D', '3D', '4D', '9S', '9H', '9D', 'KC', 'KD', 'KS', 'AS'];
  u.game.onInput(k, { type: 'knock', card: 'QH' }); // 5 left
  assert.equal(u.game.result.kind, 'undercut', 'they have just an ace left');
  assert.equal(u.game.result.winner, 1 - k);
  assert.equal(u.game.result.points, 5 - 1 + 25);
});

test('two cards left in the deck: a drawn hand; first to the target wins; out of time throws the card back', () => {
  const { ctx, game } = setup({ target: 50 });
  const s = game.turn;
  game.stock = game.stock.slice(0, 3);
  game.onInput(s, { type: 'draw', from: 'stock' });
  game.onInput(s, { type: 'discard', card: game.hands[s][0] });
  assert.equal(game.phase, 'show');
  assert.equal(game.result.draw, true);
  assert.deepEqual(game.scores, [0, 0]);
  game.onInput(0, { type: 'next' });
  game.onInput(1, { type: 'next' });
  assert.equal(game.phase, 'draw');
  assert.equal(game.turn, 1 - s, 'the deal swaps, so the other goes first');
  const t = game.turn;
  const before = game.hands[t].slice();
  ctx.advance(TIMING.turnMs);
  assert.deepEqual(game.hands[t].sort(), before.sort(), 'took one and threw it back');
  assert.equal(game.turn, 1 - t);
  game.scores = [45, 10];
  game.endHand({ winner: 0, points: 10, kind: 'knock' });
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
});

test('the computer: draws, throws and knocks legally', () => {
  const { game } = setup();
  const s = game.turn;
  for (const level of ['easy', 'normal', 'hard']) {
    const m = ginRummyBot(game.playerView(s), level, Math.random, 0, {});
    assert.equal(m.type, 'draw', level);
  }
  game.onInput(s, { type: 'draw', from: 'stock' });
  for (const level of ['easy', 'normal', 'hard']) {
    const m = ginRummyBot(game.playerView(s), level, Math.random, 0, {});
    assert.ok(game.hands[s].includes(m.card), level);
    assert.ok(m.type === 'discard' || m.type === 'knock');
  }
  assert.equal(ginRummyBot(game.playerView(1 - s), 'hard', Math.random, 0, {}), null);
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let hard = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const flip = seed % 2;
    const { view } = play('gin-rummy', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed, settings: { target: 50 } });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 5, 'Hard won ' + hard + ' of 8');
  for (let seed = 1; seed <= 6; seed++) {
    const cpu = seed % 2;
    const { view } = play('gin-rummy', cpu ? [null, 'easy'] : ['easy', null], { seed, settings: { target: 50 } });
    assert.equal(view.winner, cpu, 'seed ' + seed);
  }
});
