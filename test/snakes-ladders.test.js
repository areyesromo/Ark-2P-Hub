import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnakesLadders, TIMING, LADDERS, SNAKES, landing, BUMP } from '../server/games/snakes-ladders.js';
import { snakesLaddersBot, TURNS } from '../server/games/snakes-ladders-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

/** A game whose dice come up as `rolls` (in order), then 3s. */
function setup(rolls, settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const queue = rolls.map((d) => (d - 1) / 6 + 0.01);
  const g = new SnakesLadders(ctx, () => (queue.length ? queue.shift() : 0.34));
  g.start();
  return { ctx, g };
}

test('ladders up, snakes down, a bounce off 100', () => {
  for (const [a, b] of Object.entries(LADDERS)) assert.ok(b > a);
  for (const [h, t] of Object.entries(SNAKES)) assert.ok(t < h);
  assert.equal(landing(0, 3), LADDERS[3]);
  assert.equal(landing(20, 4), SNAKES[24]);
  assert.equal(landing(97, 5), SNAKES[98] || 98, '97 + 5 bounces back to 98');
  assert.equal(landing(96, 4), 100);
});

test('roll two dice, move by either; checked input; out of time stays put', () => {
  const { ctx, g } = setup([2, 5]);
  const s = g.turn;
  g.onInput(1 - s, { type: 'roll' }); // not their turn
  g.onInput(s, { type: 'move', die: 0 }); // nothing rolled yet
  assert.equal(g.phase, 'roll');
  g.onInput(s, { type: 'roll' });
  assert.deepEqual(g.dice, [2, 5]);
  assert.deepEqual(g.view().options, [2, 5]);
  g.onInput(s, { type: 'move', die: 2 });
  g.onInput(s, { type: 'move', die: 1 });
  assert.equal(g.pos[s], 5);
  ctx.advance(TIMING.moveMs);
  g.onInput(1 - s, { type: 'roll' });
  ctx.advance(TIMING.chooseMs);
  assert.equal(g.pos[1 - s], 0, 'out of time: no move');
});

test('a bump sends the other back 10; exactly 100 wins', () => {
  const { ctx, g } = setup([3, 3, 4, 4]);
  const s = g.turn;
  g.pos = s === 0 ? [40, 43] : [43, 40];
  g.onInput(s, { type: 'roll' });
  g.onInput(s, { type: 'move', die: 0 }); // 40 + 3 = 43: right on them
  assert.equal(g.pos[1 - s], 43 - BUMP);
  assert.equal(g.lastMove.bumped, true);
  ctx.advance(TIMING.moveMs);
  g.pos[1 - s] = 96;
  g.onInput(1 - s, { type: 'roll' });
  g.onInput(1 - s, { type: 'move', die: 0 });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 1 - s);
});

test('Hard knows the board, and Easy beats a player who leaves it to the clock', () => {
  assert.equal(TURNS[100], 0);
  assert.ok(TURNS[0] > TURNS[50]);
  // From 18, a 6 lands on the snake at 24; a 2 doesn't. Hard and Normal both dodge it.
  const v = { phase: 'choose', turn: 1, you: 1, pos: [0, 18], dice: [6, 2], options: [landing(18, 6), landing(18, 2)], round: 1, n: 3 };
  assert.equal(snakesLaddersBot(v, 'hard', seeded(1)).die, 1);
  assert.equal(snakesLaddersBot(v, 'normal', seeded(1)).die, 1);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('snakes-ladders', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
