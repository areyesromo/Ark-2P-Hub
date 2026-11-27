import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Farkle, TIMING, scoreOf, bestScore } from '../server/games/farkle.js';
import { farkleBot, ODDS } from '../server/games/farkle-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

/** A game whose dice come up as `rolls` (in order), then 3s. */
function setup(rolls, settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const queue = rolls.map((d) => (d - 1) / 6 + 0.01);
  const g = new Farkle(ctx, () => (queue.length ? queue.shift() : 0.34));
  g.start();
  return { ctx, g };
}

test('scoring', () => {
  const cases = [[[1], 100], [[5], 50], [[2], 0], [[1, 1, 1], 1000], [[4, 4, 4], 400], [[2, 2, 2, 2], 1000], [[5, 5, 5, 5, 5], 2000],
    [[1, 2, 3, 4, 5, 6], 1500], [[2, 2, 3, 3, 4, 4], 1500], [[3, 3, 3, 4, 4, 4], 2500], [[6, 6, 6, 6, 2, 2], 1500], [[1, 5], 150], [[1, 2], 0]];
  for (const [dice, want] of cases) assert.equal(scoreOf(dice), want, dice.join(''));
  assert.equal(bestScore([2, 3, 4, 6, 6, 2]), 0);
  assert.equal(bestScore([1, 2, 3, 3, 4, 6]), 100);
});

test('the computer\'s odds are right: the chance of a farkle and the average score, for 1 to 6 dice', () => {
  for (let n = 1; n <= 6; n++) {
    let farkles = 0;
    let sum = 0;
    const dice = new Array(n);
    for (let k = 0; k < 6 ** n; k++) {
      let x = k;
      for (let i = 0; i < n; i++) { dice[i] = 1 + (x % 6); x = Math.floor(x / 6); }
      const b = bestScore(dice);
      if (b) sum += b; else farkles++;
    }
    assert.ok(Math.abs(farkles / 6 ** n - ODDS[n].farkle) < 0.001, 'farkle ' + n);
    assert.ok(Math.abs(sum / (6 ** n - farkles) - ODDS[n].avg) < 1, 'avg ' + n);
  }
});

test('keep and roll on, hot dice, bank; checked input; a farkle loses the turn', () => {
  const { ctx, g } = setup([1, 1, 1, 5, 5, 2, 6, 6, 3, 4, 2, 2]);
  const s = g.turn;
  g.onInput(s, { type: 'roll' });
  for (const bad of [{ type: 'keep', dice: [5], then: 'roll' }, { type: 'keep', dice: [0, 0], then: 'roll' }, { type: 'keep', dice: [0], then: 'stay' }, { type: 'keep', dice: [9], then: 'bank' }]) g.onInput(s, bad);
  assert.equal(g.phase, 'pick');
  g.onInput(s, { type: 'keep', dice: [0, 1, 2, 3, 4], then: 'roll' }); // 1,1,1,5,5: 1,100; one die left: a 2
  assert.equal(g.turnPoints, 1100);
  assert.equal(g.phase, 'farkle');
  ctx.advance(TIMING.farkleMs);
  assert.equal(g.scores[s], 0, 'a farkle: nothing banked');
  ctx.advance(10);
  g.onInput(1 - s, { type: 'roll' }); // 6,6,3,4,2,2: nothing… a farkle too
  assert.equal(g.phase, 'farkle');
});

test('bank, the last turn after the target, and the computer rolls on until it\'s ahead', () => {
  const { ctx, g } = setup([1, 1, 1, 1, 1, 1], { target: 3000 });
  const s = g.turn;
  g.onInput(s, { type: 'roll' });
  g.onInput(s, { type: 'keep', dice: [0, 1, 2, 3, 4, 5], then: 'bank' }); // six of a kind: 3,000
  assert.equal(g.scores[s], 3000);
  assert.equal(g.lastTurn, 1 - s);
  ctx.advance(TIMING.bankMs);
  g.onInput(1 - s, { type: 'roll' }); // all 3s from here: a farkle? no, 3,3,3,3,3,3 is 3,000
  g.onInput(1 - s, { type: 'keep', dice: [0, 1, 2, 3, 4, 5], then: 'bank' });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, null, '3,000 each: level');
  // Last turn, 800 behind, 500 on the table: Hard won't bank.
  const v = { phase: 'pick', turn: 1, you: 1, lastTurn: 1, scores: [5800, 5000], target: 5000, dice: [5, 2, 3], turnPoints: 450, n: 4 };
  assert.equal(farkleBot(v, 'hard', seeded(1)).then, 'roll');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('farkle', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
