// Crazy Eights: match the top card's suit or rank, eights are wild, first out wins the hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { CrazyEights, TIMING, HAND_SIZE, value, deck as fullDeck } from '../server/games/crazy-eights.js';
import { getGame } from '../server/games/index.js';

/** A hand in play (actions on unless said), every update building every view (as the room does). */
function game({ actions = 1, target = 100, rng = () => 0.5 } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { actions, target };
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new CrazyEights(ctx, rng);
  g.start();
  return { ctx, g };
}

/** Set the table up: hands, the top card (and suit), whose turn, the draw pile. */
function table(g, { hands, top, turn = 0, deck = ['2C', '3C', '4C', '5C', '6C', '7C', '9C', '10C'], suit } = {}) {
  g.hands = hands.map((h) => h.slice());
  g.discard = [top];
  g.suit = suit || top.slice(-1);
  g.deck = deck.slice();
  g.turn = turn;
  g.pending = 0;
  g.pendingKind = null;
  g.drew = null;
  g.phase = 'play';
  g.turnStart();
}

const play = (g, slot, card) => g.onInput(slot, { type: 'play', card });

test('a full deck: 52 different cards; card values for scoring', () => {
  const d = fullDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d).size, 52);
  assert.deepEqual(['8S', 'KH', 'QD', 'JC', '10S', 'AH', '2D', '7C'].map(value), [50, 10, 10, 10, 10, 1, 2, 7]);
});

test('the deal: seven each, a top card that is no 8 or action card, the rest face down; your hand on your phone only', () => {
  const { g } = game();
  assert.equal(HAND_SIZE, 7);
  assert.deepEqual(g.hands.map((h) => h.length), [7, 7]);
  const top = g.discard.at(-1);
  assert.ok(!/^(8|2|J)/.test(top) && top !== 'QS', top);
  assert.equal(g.deck.length + g.discard.length + 14, 52);
  const tv = g.hostView();
  assert.deepEqual(tv.counts, [7, 7]);
  assert.equal(tv.top, top);
  assert.equal(JSON.stringify(tv).includes(g.hands[0][0] + '"'), g.hands[0][0] === top, 'no hand on the TV');
  assert.deepEqual(g.playerView(0).hand.slice().sort(), g.hands[0].slice().sort());
  assert.equal(g.playerView(0).hand.length, 7);
  assert.equal(g.playerView(1).hand.length, 7);
  assert.ok(!('hands' in g.playerView(0)), 'only your own');
  assert.ok(!g.playerView(1).hand.includes(g.hands[0][0]));
});

test('play a card of the same suit or rank; anything else is ignored', () => {
  const { g } = game();
  table(g, { hands: [['5H', '9S', 'KD'], ['3C', '4C']], top: '5S' });
  play(g, 0, 'KD'); // neither suit nor rank
  assert.equal(g.hands[0].length, 3);
  assert.deepEqual(g.playerView(0).playable.sort(), ['5H', '9S']);
  play(g, 0, '9S');
  assert.equal(g.discard.at(-1), '9S');
  assert.equal(g.turn, 1);
  play(g, 0, '5H'); // not your turn
  assert.equal(g.hands[0].length, 2);
});

test('an 8 goes on anything and you call the suit (only you choose)', () => {
  const { g } = game();
  table(g, { hands: [['8C', '4H', '6D'], ['3C', '4C', '9D']], top: 'KS' });
  play(g, 0, '8C');
  assert.equal(g.phase, 'suit');
  assert.equal(g.turn, 0);
  g.onInput(1, { type: 'suit', suit: 'D' });
  g.onInput(0, { type: 'suit', suit: 'X' });
  assert.equal(g.phase, 'suit');
  g.onInput(0, { type: 'suit', suit: 'D' });
  assert.equal(g.suit, 'D');
  assert.equal(g.hostView().suit, 'D');
  assert.equal(g.turn, 1);
  assert.deepEqual(g.playerView(1).playable, ['9D'], 'diamonds now (or another 8)');
});

test('draw one when you can\'t (or won\'t) play: play it if it fits, or pass', () => {
  const { g } = game();
  table(g, { hands: [['KD', 'QH'], ['3C']], top: '5S', deck: ['7S', '2D'] });
  g.onInput(0, { type: 'pass' }); // not before drawing
  assert.equal(g.turn, 0);
  g.onInput(0, { type: 'draw' });
  assert.equal(g.playerView(0).drew, '7S');
  assert.deepEqual(g.playerView(0).playable, ['7S'], 'only the card you drew');
  g.onInput(0, { type: 'draw' }); // one draw a turn
  assert.equal(g.hands[0].length, 3);
  play(g, 0, '7S');
  assert.equal(g.turn, 1);
  // A draw that doesn't fit: pass.
  table(g, { hands: [['KD'], ['3C']], top: '5S', deck: ['9H'] });
  g.onInput(0, { type: 'draw' });
  assert.deepEqual(g.playerView(0).playable, []);
  assert.equal(g.playerView(0).canPass, true);
  g.onInput(0, { type: 'pass' });
  assert.equal(g.turn, 1);
});

test('action cards: a 2 makes them draw two (unless they answer with a 2: it stacks), a Jack goes again, the Queen of spades is five', () => {
  const { g } = game();
  table(g, { hands: [['2S', 'JS', 'QS', '4S'], ['2H', '9C', '5D']], top: '6S', deck: ['3D', '4D', '5C', '6C', '7D', '9H', '10H', 'KH', 'KC'] });
  play(g, 0, '2S');
  assert.equal(g.turn, 1);
  assert.equal(g.hostView().pending, 2);
  assert.deepEqual(g.playerView(1).playable, ['2H'], 'only another 2 (an 8 doesn\'t stop it)');
  play(g, 1, '2H');
  assert.equal(g.hostView().pending, 4);
  assert.equal(g.turn, 0);
  assert.deepEqual(g.playerView(0).playable, [], 'no 2 left: you have to take them');
  g.onInput(0, { type: 'draw' });
  assert.equal(g.hands[0].length, 3 + 4);
  assert.equal(g.turn, 1, 'and your turn is over');
  assert.equal(g.hostView().pending, 0);
  // The Jack: play again.
  table(g, { hands: [['JS', '4S', '9H'], ['3C', '4C']], top: '6S' });
  play(g, 0, 'JS');
  assert.equal(g.turn, 0);
  play(g, 0, '4S');
  assert.equal(g.turn, 1);
  // The Queen of spades: five, and no answering it.
  table(g, { hands: [['QS', '4S'], ['2S', '4C']], top: '6S', deck: ['3D', '4D', '5C', '6C', '7D', '9H'] });
  play(g, 0, 'QS');
  assert.equal(g.hostView().pending, 5);
  assert.deepEqual(g.playerView(1).playable, []);
  g.onInput(1, { type: 'draw' });
  assert.equal(g.hands[1].length, 2 + 5);
});

test('classic rules (action cards off): 2s, Jacks and the Queen of spades are ordinary cards', () => {
  const { g } = game({ actions: 0 });
  table(g, { hands: [['2S', 'JS'], ['3C', '4C']], top: '6S' });
  play(g, 0, 'JS');
  assert.equal(g.turn, 1);
  assert.equal(g.hostView().pending, 0);
});

test('out of cards: the hand is yours, scored with what\'s left in their hand; first to the target wins', () => {
  const { ctx, g } = game({ target: 100 });
  table(g, { hands: [['9S'], ['8H', 'KD', '3C']], top: '5S' });
  play(g, 0, '9S');
  assert.equal(g.phase, 'handEnd');
  const v = g.hostView();
  assert.deepEqual(v.result, { winner: 0, points: 50 + 10 + 3, left: [[], ['8H', 'KD', '3C']] });
  assert.deepEqual(v.scores, [63, 0]);
  ctx.advance(TIMING.handEndMs + 10);
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.hands.map((h) => h.length), [7, 7], 'a new deal');
  assert.equal(g.turn, 1, 'the other player starts the next hand');
  table(g, { hands: [['9S'], ['8H', '8C', '3C']], top: '5S' });
  play(g, 0, '9S');
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().winner, 0);
  assert.deepEqual(g.hostView().scores, [63 + 103, 0]);
  assert.equal(ctx.pendingTimers(), 0);
});

test('one hand: whoever goes out first wins the match', () => {
  const { g } = game({ target: 0 });
  table(g, { hands: [['3C', '4C'], ['9S']], top: '5S', turn: 1 });
  play(g, 1, '9S');
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().winner, 1);
});

test('going out with an 8 needs no suit; going out with a 2 still wins', () => {
  const { g } = game({ target: 0 });
  table(g, { hands: [['8D'], ['3C']], top: '5S' });
  play(g, 0, '8D');
  assert.equal(g.phase, 'over');
  const h = game({ target: 0 }).g;
  table(h, { hands: [['2S'], ['3C']], top: '5S' });
  play(h, 0, '2S');
  assert.equal(h.phase, 'over');
  assert.equal(h.hostView().winner, 0);
});

test('the draw pile runs out: the discards (all but the top) are shuffled back in', () => {
  const { g } = game();
  table(g, { hands: [['KD'], ['3C']], top: '5S', deck: [] });
  g.discard = ['4H', '9C', '5S'];
  g.onInput(0, { type: 'draw' });
  assert.equal(g.hands[0].length, 2);
  assert.equal(g.discard.length, 1);
  assert.equal(g.discard[0], '5S');
  assert.equal(g.deck.length, 1);
  // Nothing at all left to draw: the turn just passes.
  table(g, { hands: [['KD'], ['3C']], top: '5S', deck: [] });
  g.onInput(0, { type: 'draw' });
  assert.equal(g.turn, 1);
});

test('the turn clock: out of time, you draw (or take what\'s owed) and pass; a pending suit call picks the suit you hold most', () => {
  const { ctx, g } = game();
  table(g, { hands: [['KD', '5S'], ['3C']], top: '5H', deck: ['9C'] });
  ctx.advance(TIMING.turnMs + 10);
  assert.equal(g.hands[0].length, 3);
  assert.equal(g.turn, 1);
  table(g, { hands: [['8C', '4D', '6D', '9H'], ['3C']], top: 'KS' });
  play(g, 0, '8C');
  ctx.advance(TIMING.turnMs + 10);
  assert.equal(g.suit, 'D');
  assert.equal(g.turn, 1);
});

test('bad input is ignored', () => {
  const { g } = game();
  table(g, { hands: [['5H', '9S'], ['3C']], top: '5S' });
  for (const card of ['ZZ', 5, null, 'KD', ['5H']]) play(g, 0, card);
  g.onInput(0, { type: 'suit', suit: 'H' });
  g.onInput(3, { type: 'draw' });
  g.onInput(1, { type: 'draw' });
  g.onInput(0, { type: 'rematch' });
  assert.deepEqual([g.turn, g.phase, g.hands[0].length, g.hands[1].length], [0, 'play', 2, 1]);
});

test('a rematch deals a fresh match', () => {
  const { g } = game({ target: 0 });
  table(g, { hands: [['9S'], ['3C']], top: '5S' });
  play(g, 0, '9S');
  g.onInput(1, { type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.scores, [0, 0]);
  assert.deepEqual(g.hands.map((h) => h.length), [7, 7]);
});

test('in the lobby: two phones only, with action cards on or off and the match length', () => {
  const def = getGame('crazy-eights');
  assert.equal(def.phoneOnly, true);
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"actions"') && setup.includes('"target"'));
  assert.ok(setup.includes('One hand') && setup.includes('First to 100') && setup.includes('First to 200'));
});
