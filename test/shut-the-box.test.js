import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShutTheBox, TIMING, waysToShut, maskSum, oneDieOk } from '../server/games/shut-the-box.js';
import { shutTheBoxBot, plan } from '../server/games/shut-the-box-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

const mask = (...tiles) => tiles.reduce((m, n) => m | (1 << (n - 1)), 0);

function setup(rolls, settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  // Dice come from the rng: a value r gives 1 + floor(r * 6).
  const queue = rolls.map((d) => (d - 1) / 6 + 0.01);
  const g = new ShutTheBox(ctx, () => (queue.length ? queue.shift() : 0.5));
  g.start();
  return { ctx, g };
}

test('the ways to shut a roll, and when one die is allowed', () => {
  assert.deepEqual(waysToShut(mask(1, 2, 3, 4, 5), 5).map(maskSum).every((s) => s === 5), true);
  assert.equal(waysToShut(mask(1, 2, 3, 4, 5), 5).length, 3); // 5, 4 + 1, 3 + 2
  assert.deepEqual(waysToShut(mask(7, 9), 8), []);
  assert.equal(oneDieOk(mask(1, 6)), true);
  assert.equal(oneDieOk(mask(1, 7)), false);
});

test('a turn: roll, shut tiles that add up, until stuck; input is checked', () => {
  const { ctx, g } = setup([4, 5, 6, 6, 6, 6]);
  const s = g.turn;
  g.onInput(1 - s, { type: 'roll', dice: 2 }); // not their turn
  g.onInput(s, { type: 'roll', dice: 1 }); // the 7 and up are open: two dice
  assert.equal(g.phase, 'roll');
  g.onInput(s, { type: 'roll', dice: 2 });
  assert.equal(g.view().total, 9);
  for (const bad of [{ type: 'shut', tiles: [8] }, { type: 'shut', tiles: [4, 4, 1] }, { type: 'shut', tiles: [10] }, { type: 'shut', tiles: 'x' }]) g.onInput(s, bad);
  assert.equal(g.phase, 'shut');
  g.onInput(s, { type: 'shut', tiles: [9] });
  assert.deepEqual(g.view().open[s], [1, 2, 3, 4, 5, 6, 7, 8]);
  g.onInput(s, { type: 'roll', dice: 2 }); // 12
  g.onInput(s, { type: 'shut', tiles: [8, 4] });
  g.onInput(s, { type: 'roll', dice: 2 }); // 12 again: 7 + 5
  g.onInput(s, { type: 'shut', tiles: [7, 5] });
  // Out of time rolling: the dice roll for you (one die now: 7 and up are shut).
  ctx.advance(TIMING.rollMs);
  assert.equal(g.dice.length, 1);
});

test('the lower score takes the round; out of time shutting ends the turn', () => {
  const { ctx, g } = setup([]);
  const first = g.turn;
  g.onInput(first, { type: 'roll', dice: 2 }); // 4 + 4 (rng 0.5 → 4)
  ctx.advance(TIMING.shutMs); // ends with everything open: 45
  assert.equal(g.scores[first], 45);
  assert.equal(g.turn, 1 - first);
  g.onInput(1 - first, { type: 'roll', dice: 2 });
  g.onInput(1 - first, { type: 'shut', tiles: [8] });
  g.onInput(1 - first, { type: 'roll', dice: 2 });
  ctx.advance(TIMING.shutMs);
  assert.equal(g.result.winner, 1 - first);
  assert.equal(g.wins[1 - first], 1);
});

test('Hard plays the odds, and Easy beats a player who leaves it to the clock', () => {
  // One tile, the 6, open: one die has a 1 in 6 to shut the box, two dice 5 in 36: roll one.
  assert.equal(plan((s) => -s).dice(mask(6)), 1);
  // Going second with 3 to beat, a 3 + 4 left beats nothing: it must shut... the plan values it.
  const v = { phase: 'shut', turn: 1, you: 1, open: [[], [1, 2, 3, 4, 5, 6, 7, 8, 9]], scores: [3, null], total: 9, round: 1, n: 1 };
  const move = shutTheBoxBot(v, 'hard', seeded(1));
  assert.equal(move.tiles.reduce((a, b) => a + b, 0), 9);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('shut-the-box', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
