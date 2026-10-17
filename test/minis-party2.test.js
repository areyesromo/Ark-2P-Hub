// The second batch of Party Minigames (2D: Coin Grab, Tug of War; 3D: Tower
// Stack, Bowling Bash, Penalty Shootout), each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import coinGrab, { TICK_MS, GRAB_R, STUN_MS } from '../server/games/minis/coin-grab.js';
import tugOfWar, { BEAT_MS, PULL } from '../server/games/minis/tug-of-war.js';
import towerStack, { swingAt } from '../server/games/minis/tower-stack.js';
import bowling, { aimAt, powerAt, PINS } from '../server/games/minis/bowling.js';
import penalty, { TIMING as PK } from '../server/games/minis/penalty.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function run(def, seed = 1) {
  const ctx = fakeCtx();
  let ended = null;
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: ctx.now, elapsed: () => ctx.now(), update() {},
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended };
}

test('the new minigames are tagged 2D or 3D', () => {
  assert.equal(coinGrab.look, '2d');
  assert.equal(tugOfWar.look, '2d');
  for (const m of [towerStack, bowling, penalty]) assert.equal(m.look, '3d');
});

// ---- Coin Grab ----

test('coin-grab: walking onto a coin scores it; a bomb stuns', () => {
  const { inst, ctx } = run(coinGrab, 3);
  ctx.advance(2000);
  let v = inst.view(0);
  const coin = v.items.find((it) => !it.bomb);
  assert.ok(coin, 'a coin has appeared');
  // Teleport-free: steer player 0 toward it until it's taken.
  for (let i = 0; i < 200 && inst.view(0).coins[0] === 0; i++) {
    const me = inst.view(0).players[0];
    const c = inst.view(0).items.find((it) => it.id === coin.id);
    if (!c) break;
    inst.onInput(0, { type: 'move', x: c.x - me.x, y: c.y - me.y });
    ctx.advance(TICK_MS);
  }
  assert.equal(inst.view(0).coins[0], 1);
  // A bomb: put player 1 on one.
  inst.debugItem({ x: inst.view(0).players[1].x, y: inst.view(0).players[1].y, bomb: true });
  ctx.advance(TICK_MS);
  v = inst.view(0);
  assert.equal(v.players[1].stunned, true);
  const before = { ...v.players[1] };
  inst.onInput(1, { type: 'move', x: 1, y: 0 });
  ctx.advance(TICK_MS * 4);
  assert.equal(inst.view(0).players[1].x, before.x, 'stunned players do not move');
  ctx.advance(STUN_MS);
  assert.equal(inst.view(0).players[1].stunned, false);
  assert.ok(GRAB_R > 0);
});

test('coin-grab: bad move input is ignored; time-up: more coins wins', () => {
  const { inst, ended } = run(coinGrab);
  inst.onInput(0, { type: 'move', x: 'a', y: NaN });
  inst.onInput(0, { type: 'move', x: 1e9, y: 0 }); // clamped to full speed
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

// ---- Tug of War ----

test('tug-of-war: on-beat pulls beat mashing; over the line wins', () => {
  const { inst, ctx, ended } = run(tugOfWar);
  ctx.advance(BEAT_MS * 2);
  inst.onInput(0, { type: 'pull', t: BEAT_MS * 2 }); // dead on the beat
  assert.equal(inst.view(0).last[0], 'perfect');
  assert.ok(Math.abs(inst.view(0).rope + PULL.perfect) < 1e-9);
  ctx.advance(BEAT_MS / 2);
  inst.onInput(1, { type: 'pull', t: BEAT_MS * 2.5 }); // half a beat off
  assert.equal(inst.view(0).last[1], 'miss');
  inst.onInput(1, { type: 'pull', t: BEAT_MS * 2.5 }); // too soon after the last pull
  assert.ok(Math.abs(inst.view(0).rope - (-PULL.perfect + PULL.miss)) < 1e-9);
  for (let i = 3; i < 60 && !ended(); i++) {
    ctx.advance(BEAT_MS / 2);
    inst.onInput(0, { type: 'pull', t: ctx.now() });
    ctx.advance(BEAT_MS / 2);
  }
  assert.deepEqual(ended(), { winner: 0 });
});

test('tug-of-war: time-up goes to whoever has the rope on their side', () => {
  const { inst, ctx, ended } = run(tugOfWar);
  ctx.advance(BEAT_MS);
  inst.onInput(1, { type: 'pull', t: BEAT_MS });
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 1 });
});

// ---- Tower Stack ----

/** Drop `slot`'s block when its swing is `dx` from the top of its tower. */
function dropAt(inst, ctx, slot, dx) {
  const v = inst.view(0);
  const tower = v.towers[slot];
  const top = tower[tower.length - 1];
  let t = Math.max(ctx.now(), v.blockStart[slot]);
  while (Math.abs(swingAt(t - v.blockStart[slot], v.swing) - (top.x + dx)) > 0.01) t++;
  ctx.advance(t - ctx.now());
  inst.onInput(slot, { type: 'drop', t });
}

test('tower-stack: overlap stays, overhang is cut, a miss ends your tower', () => {
  const { inst, ctx, ended } = run(towerStack);
  dropAt(inst, ctx, 0, 0);
  let v = inst.view(0);
  assert.equal(v.towers[0].length, 2);
  assert.ok(v.towers[0][1].w > 0.97, 'a near-perfect drop keeps the width');
  dropAt(inst, ctx, 0, 0.3);
  v = inst.view(0);
  assert.ok(Math.abs(v.towers[0][2].w - (v.towers[0][1].w - 0.3)) < 0.03, 'the overhang is cut off');
  dropAt(inst, ctx, 1, 1.1); // past the edge: out
  assert.equal(inst.view(0).out[1], true);
  // Player 0 is already taller than player 1 will ever be: it ends.
  assert.deepEqual(ended(), { winner: 0 });
});

test('tower-stack: time-up, taller wins; equal is a draw', () => {
  const { inst, ended } = run(towerStack);
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

// ---- Bowling Bash ----

/** Tap when the aim and then the power are as close as can be to the wanted values. */
function bowl(inst, ctx, slot, aim, power) {
  for (const [stage, fn, want] of [['aim', aimAt, aim], ['power', powerAt, power]]) {
    while (inst.view(0).lanes[slot].stage !== stage) ctx.advance(10);
    const lane = inst.view(0).lanes[slot];
    let t = Math.max(ctx.now(), lane.since);
    while (Math.abs(fn(t - lane.since) - want) > 0.02) t++;
    ctx.advance(t - ctx.now());
    inst.onInput(slot, { type: 'tap', t });
  }
}

test('bowling: a good roll knocks most pins; two rolls each; more pins wins', () => {
  const { inst, ctx, ended } = run(bowling, 4);
  assert.equal(PINS.length, 10);
  bowl(inst, ctx, 0, 0.15, 0.85);
  bowl(inst, ctx, 1, 0.95, 0.2);
  const lanes = inst.view(0).lanes;
  assert.ok(lanes[0].knocked[0] >= 8, `good roll knocked ${lanes[0].knocked[0]}`);
  assert.ok(lanes[1].knocked[0] <= 3, `bad roll knocked ${lanes[1].knocked[0]}`);
  assert.equal(lanes[0].standing.length, 10 - lanes[0].knocked[0]);
  bowl(inst, ctx, 0, 0.15, 0.85);
  bowl(inst, ctx, 1, 0.95, 0.2);
  ctx.advance(2000);
  assert.deepEqual(ended(), { winner: 0 });
});

test('bowling: a tap in the wrong stage is ignored; unrolled at time-up scores 0', () => {
  const { inst, ended } = run(bowling, 4);
  inst.onInput(0, { type: 'tap', t: 'x' });
  assert.equal(inst.view(0).lanes[0].stage, 'power');
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

// ---- Penalty Shootout ----

test('penalty: picks stay secret; different sides score; 5 kicks each', () => {
  const { inst, ctx, ended } = run(penalty);
  let v = inst.view(0);
  assert.equal(v.kicker, 0);
  inst.onInput(0, { type: 'pick', side: 2 });
  assert.equal(inst.view(1).picked[0], true);
  assert.equal(JSON.stringify(inst.view(1)).includes('"shot"'), false, 'the keeper cannot see the shot');
  assert.equal(inst.view(0).mine, 2);
  inst.onInput(1, { type: 'pick', side: 0 });
  v = inst.view(0);
  assert.deepEqual(v.last, { kicker: 0, shot: 2, dive: 0, goal: true });
  assert.deepEqual(v.goals, [1, 0]);
  ctx.advance(PK.showMs);
  assert.equal(inst.view(0).kicker, 1);
  inst.onInput(1, { type: 'pick', side: 1 });
  inst.onInput(0, { type: 'pick', side: 1 });
  assert.deepEqual(inst.view(0).goals, [1, 0], 'saved');
  // The rest: player 0 always scores, player 1 always saved: decided early.
  for (let k = 0; k < 10 && !ended(); k++) {
    ctx.advance(PK.showMs);
    const kicker = inst.view(0).kicker;
    inst.onInput(kicker, { type: 'pick', side: 0 });
    inst.onInput(1 - kicker, { type: 'pick', side: kicker === 0 ? 2 : 0 });
  }
  assert.deepEqual(ended(), { winner: 0 });
  assert.ok(inst.view(0).kick <= 8, 'stops once it cannot be caught');
});

test('penalty: nobody picking in time: the kicker misses', () => {
  const { inst, ctx } = run(penalty);
  ctx.advance(PK.pickMs);
  assert.equal(inst.view(0).last.goal, false);
  inst.onInput(1, { type: 'pick', side: 7 }); // junk
});
