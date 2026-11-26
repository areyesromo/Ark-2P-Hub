import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LuckySeven, TIMING, fullDeck, bank, LUCKY_BONUS } from '../server/games/lucky-seven.js';
import { luckySevenBot } from '../server/games/lucky-seven-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}, seed = 3) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new LuckySeven(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('the deck: nine 1s down to one 9, four Doubles, four Shields; banking adds up, doubles, and pays a Lucky Seven', () => {
  const d = fullDeck();
  assert.equal(d.length, 45 + 8);
  assert.equal(d.filter((c) => c === '1').length, 9);
  assert.equal(d.filter((c) => c === '9').length, 1);
  assert.equal(bank(['3', '5']), 8);
  assert.equal(bank(['3', 'D', '5']), 16);
  assert.equal(bank(['1', '2', '3', '4', '5', '6', '7']), 28 + LUCKY_BONUS);
});

test('flip and stop in turn; you flip once before you can stop; a repeat busts you unless a Shield takes it', () => {
  const { g } = setup();
  const s = g.turn;
  g.onInput(s, { type: 'stop' });
  assert.equal(g.status[s], 'in', 'no stopping before your first flip');
  g.deck.push('4');
  g.onInput(s, { type: 'flip' });
  assert.deepEqual(g.hands[s], ['4']);
  assert.equal(g.turn, 1 - s);
  g.deck.push('6');
  g.onInput(1 - s, { type: 'flip' });
  g.hands[s].push('S');
  g.deck.push('4');
  g.onInput(s, { type: 'flip' });
  assert.equal(g.status[s], 'in', 'the Shield took it');
  assert.ok(!g.hands[s].includes('S'));
  g.deck.push('6');
  g.onInput(1 - s, { type: 'flip' });
  assert.equal(g.status[1 - s], 'bust');
  assert.equal(g.turn, s, 'the other is out: it\'s you again');
  g.onInput(s, { type: 'stop' });
  assert.equal(g.phase, 'roundEnd');
  assert.equal(g.result.gains[s], 4);
  assert.equal(g.result.gains[1 - s], 0);
});

test('a Lucky Seven ends the round for both; first past the target at the end of a round wins', () => {
  const { g } = setup({ target: 50 });
  const s = g.turn;
  g.hands[s] = ['1', '2', '3', '4', '5', '6'];
  g.flipped[s] = true;
  g.hands[1 - s] = ['9'];
  g.deck.push('8');
  g.onInput(s, { type: 'flip' });
  assert.equal(g.status[s], 'lucky');
  assert.deepEqual(g.scores[s], 29 + LUCKY_BONUS);
  assert.equal(g.scores[1 - s], 9, 'the other banks what they had');
  g.scores = [49, 10];
  g.phase = 'play';
  g.turn = 0;
  g.status = ['in', 'stopped'];
  g.hands = [['2'], ['3']];
  g.flipped = [true, true];
  g.onInput(0, { type: 'stop' });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
});

test('out of time: you flip if you haven\'t, else stop; the deck reshuffles what isn\'t on the table', () => {
  const { ctx, g } = setup();
  const s = g.turn;
  ctx.advance(TIMING.turnMs);
  assert.equal(g.flipped[s], true);
  g.deck = [];
  g.hands[g.turn] = g.hands[g.turn].concat(['2']);
  g.onInput(g.turn, { type: 'flip' });
  assert.equal(g.deck.length + g.hands.flat().length, 53);
  for (const bad of [{ type: 'flip', extra: 1 }, { type: 'nope' }]) g.onInput(1 - g.turn, bad);
});

test('the computer: flips on nothing, stops on plenty when the deck is dangerous; Easy beats a player who leaves it to the clock', () => {
  const base = { phase: 'play', you: 1, turn: 1, round: 1, n: 1, target: 200, scores: [0, 0], gone: [], flipped: [false, true] };
  assert.equal(luckySevenBot({ ...base, hands: [[], ['1']] }, 'normal', seeded(1)).type, 'flip');
  const risky = { ...base, hands: [[], ['1', '2', '3', '4', '5', '9']], gone: ['7', '8', '6', '6', '6', '7', '7', '8'] };
  assert.equal(luckySevenBot(risky, 'hard', seeded(2)).type, 'stop');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('lucky-seven', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
