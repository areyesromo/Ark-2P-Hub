import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Cave, FIELD, COPTER, CAVE, PHYS, MAPS, VEHICLES, TIMING } from '../server/solo/games/cave.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

function game(seed = 2, settings) {
  const ctx = fakeCtx('Ana', settings);
  const g = new Cave(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** The cave's middle a little ahead of the copter, where it's heading. */
function middle(g, ahead = 6) {
  const x = COPTER.x + ahead;
  const col = g.cols.find((c) => c.x <= x && c.x + CAVE.col > x);
  return (col.top + col.bottom) / 2;
}

test('waits for the first hold, then falls into the floor without one', () => {
  const { ctx, g } = game();
  ctx.advance(2000);
  assert.equal(g.phase, 'ready');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'hold', on: true });
  g.onInput({ type: 'hold', on: false });
  assert.equal(g.phase, 'play');
  ctx.advance(5000);
  assert.equal(g.phase, 'over');
  assert.equal(g.crashed, true);
  assert.ok(g.copter.y > FIELD.h / 2);
  assert.equal(ctx.pendingTimers(), 0);
});

test('holding all the way flies into the ceiling', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'hold', on: true });
  ctx.advance(5000);
  assert.equal(g.phase, 'over');
  assert.ok(g.copter.y < FIELD.h / 2);
});

/** Fly by following the middle of the cave (rocks cleared away) for up to ms; returns the game. */
function autopilot(g, ctx, ms) {
  g.onInput({ type: 'hold', on: true });
  for (let t = 0; t < ms && g.phase === 'play'; t += TIMING.tickMs) {
    g.rocks = []; // this is about the walls
    ctx.advance(TIMING.tickMs);
    // Climb when it would still stop below the middle (counting the distance it takes to stop).
    const { y, vy } = g.copter;
    const want = y + (vy * Math.abs(vy)) / (2 * (vy < 0 ? PHYS.gravity : -PHYS.lift)) > middle(g);
    if (want !== g.holding) g.onInput({ type: 'hold', on: want });
  }
  return g;
}

test('following the middle of the cave goes a long way, on every map; the cave narrows and rocks appear', () => {
  for (const map of Object.keys(MAPS)) {
    for (const seed of [1, 2, 3]) {
      const { ctx, g } = game(seed, { map });
      autopilot(g, ctx, 30000);
      assert.equal(g.phase, 'play', `${map} ${seed}: crashed at ${g.metres} m`);
      assert.ok(g.hostView().score > 200, `${map}: ${g.metres} m`);
      assert.ok(g.gap < MAPS[map].gap, 'narrower');
      assert.ok(g.nextRock > FIELD.w + 120, 'rocks were dug');
      assert.equal(g.hostView().variant, MAPS[map].name);
    }
  }
});

test('the cave never climbs or drops faster than the copter can at its top speed', () => {
  for (const m of Object.values(MAPS)) assert.ok(m.slope * m.maxSpeed < -PHYS.maxRise && m.slope * m.maxSpeed < PHYS.maxFall, m.name);
});

test('icicles only hang from the ceiling', () => {
  const { ctx, g } = game(4, { map: 'ice' });
  for (let i = 0; i < 400; i++) g.dig();
  assert.ok(g.rocks.length > 5);
  assert.ok(g.rocks.every((r) => r.y0 === g.cols.find((c) => c.x === r.x).top));
  assert.ok(ctx);
});

test('maps and vehicles unlock with Helicopter Cave achievements; the rest are open', () => {
  const def = getGame('cave');
  const ctx = fakeCtx();
  ctx.achievements = () => ({});
  const locked = lockedFor(ctx, def.spec);
  assert.deepEqual(Object.keys(locked.map).sort(), ['ice', 'mine', 'volcano']);
  assert.deepEqual(Object.keys(locked.vehicle).sort(), ['dragon', 'jet', 'ufo']);
  assert.match(locked.map.mine, /100 m/);
  ctx.achievements = () => ({ 'cave-100': 1, 'cave-500': 1 });
  const after = lockedFor(ctx, def.spec);
  assert.equal(after.map.mine, undefined);
  assert.equal(after.vehicle.jet, undefined);
  assert.ok(after.map.ice);
  // A locked pick is refused, an open one taken.
  const setup = def.create(ctx);
  setup.start();
  setup.onInput({ type: 'setting', key: 'map', value: 'ice' });
  assert.equal(setup.hostView().hubSetup.settings.map, 'crystal');
  setup.onInput({ type: 'setting', key: 'map', value: 'mine' });
  setup.onInput({ type: 'setting', key: 'vehicle', value: 'jet' });
  setup.onInput({ type: 'go' });
  const v = setup.hostView();
  assert.equal(v.variant, 'Old Mine');
  assert.equal(v.vehicle, 'jet');
});

test('a map picked by one player goes back to the first map for a player who has not unlocked it', () => {
  const def = getGame('cave');
  const ctx = fakeCtx();
  let have = { 'cave-100': 1 };
  ctx.achievements = () => have;
  const setup = def.create(ctx);
  setup.start();
  setup.onInput({ type: 'setting', key: 'map', value: 'mine' });
  have = {}; // someone else sits down
  setup.onInput({ type: 'go' });
  assert.equal(setup.hostView().variant, 'Crystal Cave');
  assert.equal(Object.keys(VEHICLES)[0], 'copter');
});

test('a rock in the way ends the run', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'hold', on: true });
  g.rocks = [{ x: COPTER.x - 1, y0: 0, y1: FIELD.h }];
  ctx.advance(TIMING.tickMs * 2);
  assert.equal(g.phase, 'over');
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'ready');
  assert.equal(g.hostView().score, 0);
});

test('pause stops the clock and carries on level; bad input is ignored', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'hold', on: true });
  ctx.advance(200);
  g.onInput({ type: 'pause' });
  const y = g.copter.y;
  ctx.advance(3000);
  assert.equal(g.phase, 'paused');
  assert.equal(g.copter.y, y);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'pause' });
  assert.equal(g.phase, 'play');
  assert.equal(g.copter.vy, 0);
  for (const input of [{ type: 'hold', on: 'yes' }, { type: 'hold' }, { type: 'zap' }, { type: 'rematch' }]) g.onInput(input);
  assert.equal(g.holding, true);
  assert.equal(g.phase, 'play');
});
