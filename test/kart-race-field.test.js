// Kart Race with more than two karts (the 8-kart Cup's computer racers, PR 3), through a test-only
// race that adds extra entrants. With two karts every rule must stay as it was (kart-race.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KartRace, TIMING, ITEMS, ODDS, pointAt, locate } from '../server/games/kart-race.js';
import { useItem } from '../server/games/kart-items.js';
import { fakeCtx } from './helpers.js';

/** A race with `extra` more karts (index 2 up), like the 8-kart Cup's computers. */
class Field extends KartRace {
  constructor(ctx, rng, extra) {
    super(ctx, rng);
    this.extra = extra;
  }
  entrants() {
    const more = ['rex', 'zip', 'swift', 'boulder', 'rascal', 'roxy'].slice(0, this.extra).map((racer) => ({ racer, tyre: 'standard', cpu: { level: 'normal' } }));
    return super.entrants().concat(more);
  }
}

/** Setup, both ready, lights out: racing with 2 + extra karts. */
function field(extra = 6, settings = {}) {
  const ctx = fakeCtx();
  const game = new Field(ctx, () => 0, extra);
  game.start();
  for (const [key, value] of Object.entries(settings)) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

/** Put kart i at fraction p of the lap (laps done: `laps`), stopped. */
function placeAt(game, i, p, laps = 0) {
  const at = pointAt(game.track, p);
  Object.assign(game.karts[i], { x: at.x, y: at.y, angle: at.angle, speed: 0, progress: p, laps, seg: Math.round(p * game.track.line.length) % game.track.line.length });
}

test('extra entrants race too: 8 karts, players first, computers flagged', () => {
  const { game } = field(6);
  assert.equal(game.karts.length, 8);
  assert.equal(game.karts[0].cpu, null);
  assert.equal(game.karts[1].cpu, null);
  assert.equal(game.karts[2].cpu.level, 'normal');
  assert.equal(game.karts[2].racer, 'rex');
});

test('the grid: two a row, all past the line, front row furthest on', () => {
  // On the grid during the lights (once racing, each tick re-measures progress from where the kart is).
  const game = new Field(fakeCtx(), () => 0, 6);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  assert.equal(game.phase, 'countdown');
  const order = game.gridOrder(8);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (let j = 0; j < 8; j++) {
    const k = game.karts[order[j]];
    const want = 0.012 + (3 - Math.floor(j / 2)) * 2.6 / game.track.length;
    assert.ok(Math.abs(k.progress - want) < 1e-9, `place ${j}: ${k.progress} vs ${want}`);
    assert.ok(locate(game.track, k.x, k.y).d <= game.track.width / 2, `place ${j} on the road`);
    if (j % 2 === 1) {
      const mate = game.karts[order[j - 1]];
      assert.ok(Math.abs(Math.hypot(k.x - mate.x, k.y - mate.y) - 1.5) < 0.01, `row ${j >> 1} is 1.5 apart`);
    }
  }
});

test("two karts: the grid is today's", () => {
  const { game } = field(0);
  assert.equal(game.karts.length, 2);
  for (const k of game.karts) assert.ok(Math.abs(k.progress - 0.012) < 1e-9);
  const [a, b] = game.karts;
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 1.5) < 0.01);
});

test('a battle is always two karts, whatever the entrants', () => {
  const { game } = field(6, { mode: 1 });
  assert.equal(game.battle, true);
  assert.equal(game.karts.length, 2);
});

test("the next race keeps each kart's held controls, all eight", () => {
  const { ctx, game } = field(6, { races: 3 });
  game.karts[5].gas = true;
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'standings');
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  assert.equal(game.karts.length, 8);
  assert.equal(game.karts[5].gas, true);
});
