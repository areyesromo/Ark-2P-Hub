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

/** A known running order: kart 6 finished, kart 3 a lap up, kart 1 near the end of lap 1, the rest spread behind. */
function knownOrder(game) {
  [0, 2, 4, 5, 7].forEach((i, n) => placeAt(game, i, 0.3 - n * 0.05));
  placeAt(game, 3, 0.2, 1);
  placeAt(game, 1, 0.9);
  placeAt(game, 6, 0.1, 3);
  game.karts[6].finishedAt = 1;
}

test('places 1 to 8 by laps and progress, finished karts first', () => {
  const { game } = field(6);
  knownOrder(game);
  const ranks = game.positions();
  assert.equal(ranks[6], 1);
  assert.equal(ranks[3], 2);
  assert.equal(ranks[1], 3);
  assert.deepEqual([0, 2, 4, 5, 7].map((i) => ranks[i]), [4, 5, 6, 7, 8]);
  assert.deepEqual([...ranks].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('two karts: places as before', () => {
  const { game } = field(0);
  placeAt(game, 0, 0.3);
  placeAt(game, 1, 0.3);
  assert.deepEqual(game.positions(), [1, 2]);
  placeAt(game, 1, 0.4);
  assert.deepEqual(game.positions(), [2, 1]);
});

test('targets: the kart just ahead, or just behind for the leader', () => {
  const { game } = field(6);
  knownOrder(game);
  assert.equal(game.targetOf(1), 3);
  assert.equal(game.targetOf(6), 3);
  assert.equal(game.targetOf(0), 1);
  const two = field(0).game;
  assert.equal(two.targetOf(0), 1);
  assert.equal(two.targetOf(1), 0);
});

test("item odds: the front half rolls the leader's odds, the back half the catch-up ones", () => {
  const { game } = field(6);
  knownOrder(game);
  game.rng = () => 0.999; // the last kind in each table
  assert.notEqual(Object.keys(ODDS.first).at(-1), Object.keys(ODDS.second).at(-1));
  assert.equal(game.rollItem(0), Object.keys(ODDS.first).at(-1), 'rank 4 of 8: the front half');
  assert.equal(game.rollItem(2), Object.keys(ODDS.second).at(-1), 'rank 5 of 8: the back half');
});

/** Everyone out of the way at the start of the lap, except the karts a test uses. */
function clearRoad(game, except) {
  game.karts.forEach((k, i) => { if (!except.includes(i)) placeAt(game, i, 0.05 + i * 0.004); });
}

test('karts bump in a pack: three in a pile all end up apart', () => {
  const { ctx, game } = field(6);
  clearRoad(game, [2, 3, 4]);
  for (const i of [2, 3, 4]) placeAt(game, i, 0.5);
  const bumps = game.events.bumps;
  ctx.advance(17);
  const [a, b, c] = [2, 3, 4].map((i) => game.karts[i]);
  for (const [p, q] of [[a, b], [a, c], [b, c]]) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > 0, 'apart');
  assert.ok(game.events.bumps - bumps >= 2, 'every touching pair counts');
});

test('a ? box reached by three karts goes to the nearest; a three-way dead heat takes turns', () => {
  const { ctx, game } = field(6);
  clearRoad(game, [2, 3, 4]);
  const at = pointAt(game.track, 0.5);
  const box = { x: at.x, y: at.y, angle: at.angle, double: false, backAt: 0 };
  game.boxes = [box];
  // Three karts round the box at the same distance, each pointing away from it.
  const ring = (dist) => [2, 3, 4].forEach((i, n) => {
    const a = (n * 2 * Math.PI) / 3;
    Object.assign(game.karts[i], { x: box.x + Math.cos(a) * dist, y: box.y + Math.sin(a) * dist, angle: a, items: [] });
  });
  const got = [];
  for (let n = 0; n < 3; n++) {
    ring(0.6);
    box.backAt = 0;
    game.boxCheck(ctx.now());
    got.push([2, 3, 4].find((i) => game.karts[i].items.length));
  }
  assert.deepEqual([...got].sort(), [2, 3, 4], 'each tied kart gets it once');
  ring(0.6);
  game.karts[3].x = box.x + (game.karts[3].x - box.x) * 0.8; // kart 3 a little nearer
  game.karts[3].y = box.y + (game.karts[3].y - box.y) * 0.8;
  box.backAt = 0;
  game.boxCheck(ctx.now());
  assert.equal(game.karts[3].items.length, 1);
  assert.equal(game.karts[2].items.length + game.karts[4].items.length, 0);
});

test("a Magnet's slipstream works behind any kart", () => {
  const { ctx, game } = field(6);
  clearRoad(game, [0, 5]);
  placeAt(game, 0, 0.5);
  const k = game.karts[0];
  Object.assign(game.karts[5], { x: k.x + Math.cos(k.angle) * 3, y: k.y + Math.sin(k.angle) * 3 });
  k.magnetUntil = ctx.now() + 10000;
  assert.equal(game.slipstream(k, ctx.now()), ITEMS.slipSpeed);
});
