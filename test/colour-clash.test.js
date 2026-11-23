import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ColourClash, deck, fits, faceOf, colourOf, points, TIMING } from '../server/games/colour-clash.js';
import { colourClashBot } from '../server/games/colour-clash-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

/** A hand dealt as given: the top card, each hand, and the deck to draw from (top last). */
function setup({ top = 'R5#1', hands = [['R7#1', 'B5#1', 'G2#1'], ['Y3#1', 'Y4#1', 'B9#1']], stock = ['G1#1', 'B1#1', 'Y1#1', 'R1#1', 'G9#1', 'B8#1'], turn = 0 } = {}, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new ColourClash(ctx, seeded(2));
  game.start();
  game.pile = [top];
  game.colour = colourOf(top);
  game.hands = hands.map((h) => h.slice());
  game.stock = stock.slice();
  game.turn = turn;
  game.phase = 'play';
  return { ctx, game };
}

test('the deck: 108 cards, each colour with one 0 and two of the rest; wilds 50, symbols 20', () => {
  const d = deck();
  assert.equal(d.length, 108);
  assert.equal(new Set(d).size, 108);
  assert.equal(d.filter((c) => c.startsWith('R')).length, 25);
  assert.equal(d.filter((c) => faceOf(c) === 'W4').length, 4);
  assert.deepEqual([points('R7#1'), points('GS#2'), points('W4#1')], [7, 20, 50]);
  assert.ok(fits('B5#1', 'R5#1', 'R'), 'same number');
  assert.ok(fits('R9#1', 'R5#1', 'R'), 'same colour');
  assert.ok(!fits('B9#1', 'R5#1', 'R'));
  assert.ok(fits('W#1', 'R5#1', 'R'), 'a wild goes on anything');
  assert.ok(fits('G2#1', 'W#1', 'G'), 'after a wild: its colour');
});

test('a turn: play a card that fits (secret hands), or draw one', () => {
  const { game } = setup();
  assert.deepEqual(game.playerView(0).playable.sort(), ['B5#1', 'R7#1']);
  assert.ok(!('cards' in game.hostView()));
  assert.ok(!JSON.stringify(game.playerView(1)).includes('R7#1'));
  game.onInput(1, { type: 'play', card: 'Y3#1' }); // not their turn
  game.onInput(0, { type: 'play', card: 'G2#1' }); // doesn't fit
  game.onInput(0, { type: 'play', card: 'nope' });
  assert.equal(game.turn, 0);
  game.onInput(0, { type: 'play', card: 'B5#1' });
  assert.equal(game.colour, 'B');
  assert.equal(game.turn, 1);
  game.onInput(1, { type: 'draw' }); // draws R1: it doesn't fit (blue 5 on top)... 
  assert.equal(game.hands[1].length, 4);
});

test('a drawn card that fits: play it or keep it', () => {
  const { game } = setup({ stock: ['R8#1'], hands: [['B1#1', 'G2#1'], ['Y3#1']] });
  game.onInput(0, { type: 'draw' });
  assert.equal(game.phase, 'drawn');
  assert.deepEqual(game.playerView(0).playable, ['R8#1']);
  game.onInput(0, { type: 'play', card: 'B1#1' }); // only the drawn card
  assert.equal(game.phase, 'drawn');
  game.onInput(0, { type: 'keep' });
  assert.equal(game.turn, 1);
});

test('skip, reverse, draw two: another turn (there are two of you); draw four and wilds pick the colour', () => {
  const { game } = setup({ hands: [['RS#1', 'RR#1', 'RD#1', 'W4#1', 'W#1', 'B2#1'], ['Y3#1']] });
  game.onInput(0, { type: 'play', card: 'RS#1' });
  assert.equal(game.turn, 0);
  game.onInput(0, { type: 'play', card: 'RR#1' });
  assert.equal(game.turn, 0);
  game.onInput(0, { type: 'play', card: 'RD#1' });
  assert.equal(game.hands[1].length, 3, 'drew two');
  assert.equal(game.turn, 0);
  game.onInput(0, { type: 'play', card: 'W4#1', colour: 'G' });
  assert.equal(game.hands[1].length, 7);
  assert.equal(game.colour, 'G');
  game.onInput(0, { type: 'play', card: 'W#1' }); // no colour yet: it asks
  assert.equal(game.phase, 'colour');
  game.onInput(0, { type: 'colour', colour: 'P' });
  game.onInput(0, { type: 'colour', colour: 'B' });
  assert.equal(game.colour, 'B');
  assert.equal(game.turn, 1);
});

test('one card left: call CLASH! or be caught (draw two); calling late saves you', () => {
  const { game } = setup({ hands: [['R7#1', 'R8#1'], ['Y3#1', 'Y4#1', 'R2#1']] });
  game.onInput(0, { type: 'play', card: 'R7#1' }); // no call
  assert.equal(game.uncalled, 0);
  assert.equal(game.playerView(1).uncalled, 0);
  game.onInput(0, { type: 'catch' }); // (can't catch yourself)
  game.onInput(1, { type: 'catch' });
  assert.equal(game.hands[0].length, 3);
  assert.equal(game.uncalled, null);

  const b = setup({ hands: [['R7#1', 'R8#1'], ['Y3#1']] }).game;
  b.onInput(0, { type: 'play', card: 'R7#1', call: true });
  assert.equal(b.uncalled, null);
  b.onInput(1, { type: 'catch' });
  assert.equal(b.hands[0].length, 1, 'called: safe');
  const c = setup({ hands: [['R7#1', 'R8#1'], ['Y3#1']] }).game;
  c.onInput(0, { type: 'play', card: 'R7#1' });
  c.onInput(0, { type: 'call' });
  c.onInput(1, { type: 'catch' });
  assert.equal(c.hands[0].length, 1, 'called late, but in time');
});

test('out of cards wins the hand and scores the other\'s; first to the target; out of time draws and passes', () => {
  const { ctx, game } = setup({ hands: [['R7#1'], ['Y3#1', 'GS#1', 'W#1']] }, { target: 100 });
  game.onInput(0, { type: 'play', card: 'R7#1' });
  assert.equal(game.phase, 'handEnd');
  assert.deepEqual(game.result, { winner: 0, points: 73, left: ['Y3#1', 'GS#1', 'W#1'], blocked: false });
  ctx.advance(TIMING.handEndMs);
  assert.equal(game.phase, 'play');
  const t = game.turn;
  const n = game.hands[t].length;
  ctx.advance(TIMING.turnMs);
  assert.equal(game.hands[t].length, n + 1);
  assert.equal(game.turn, 1 - t);
  game.scores = [90, 0];
  game.endHand(0);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
});

test('every card in a hand and nobody can play: fewer points wins', () => {
  const { game } = setup({ hands: [['B1#1'], ['G9#1', 'Y8#1']], stock: [] });
  game.onInput(0, { type: 'draw' });
  assert.equal(game.turn, 1);
  game.onInput(1, { type: 'draw' });
  assert.equal(game.phase, 'handEnd');
  assert.equal(game.result.blocked, true);
  assert.equal(game.result.winner, 0);
  assert.equal(game.result.points, 17 - 1);
});

test('the computer: plays a card that fits, picks its colour, calls, catches', () => {
  const { game } = setup({ hands: [['W#1', 'B2#1', 'B4#1'], ['R1#1', 'G3#1']] });
  for (const level of ['easy', 'normal', 'hard']) {
    const m = colourClashBot(game.playerView(0), level, Math.random);
    assert.equal(m.type, 'play');
    assert.ok(game.playerView(0).playable.includes(m.card));
  }
  assert.equal(colourClashBot(game.playerView(0), 'normal', Math.random).colour, 'B', 'its colour when it plays the wild');
  const c = setup({ hands: [['R7#1', 'R8#1'], ['Y3#1']] }).game;
  assert.equal(colourClashBot(c.playerView(0), 'hard', Math.random).call, true);
  c.onInput(0, { type: 'play', card: 'R7#1' });
  assert.equal(colourClashBot(c.playerView(1), 'hard', Math.random).type, 'catch');
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let hard = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const flip = seed % 2;
    const { view } = play('colour-clash', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 6, 'Hard won ' + hard + ' of 8');
  for (let seed = 1; seed <= 6; seed++) {
    const cpu = seed % 2;
    const { view } = play('colour-clash', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3 * 3600 * 1000 });
    assert.equal(view.winner, cpu, 'seed ' + seed);
  }
});
