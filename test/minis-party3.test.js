// The third batch of Party Minigames (2D: Whack-a-Mole, Fishing, Simon Says; 3D: Glass Bridge,
// Ice Rink Sumo), each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import whackAMole, { POINTS, SPAWN } from '../server/games/minis/whack-a-mole.js';
import fishing, { BITE, SCARE_MS, SNAP_MS } from '../server/games/minis/fishing.js';
import glassBridge, { ROWS, STEP_MS, FALL_MS } from '../server/games/minis/glass-bridge.js';
import iceSumo, { RINK_R, TICK_MS } from '../server/games/minis/ice-sumo.js';
import simonSays, { COLORS, ORDER, POINTS as SIMON } from '../server/games/minis/simon-says.js';

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

test('the third batch is tagged 2D or 3D', () => {
  assert.equal(whackAMole.look, '2d');
  assert.equal(fishing.look, '2d');
  assert.equal(glassBridge.look, '3d');
  assert.equal(iceSumo.look, '3d');
});

// ---- Whack-a-Mole ----

test('whack-a-mole: your mole +1, gold +2, theirs -1; a hit hole empties; most points wins', () => {
  const { inst, ctx, ended } = run(whackAMole, 5);
  const seen = { mine: 0, gold: 0, theirs: 0 };
  for (let t = 0; t < 20000 && (!seen.mine || !seen.gold || !seen.theirs); t += 50) {
    ctx.advance(50);
    inst.view(0).holes.forEach((m, hole) => {
      if (!m) return;
      const kind = m.who === 'gold' ? 'gold' : m.who === 0 ? 'mine' : 'theirs';
      if (seen[kind]) return;
      const before = inst.view(0).points[0];
      inst.onInput(0, { type: 'whack', hole });
      assert.equal(inst.view(0).points[0] - before, POINTS[kind], kind);
      assert.equal(inst.view(0).holes[hole], null, 'the hole empties');
      assert.equal(inst.view(0).last.kind, kind);
      seen[kind]++;
    });
  }
  assert.deepEqual(seen, { mine: 1, gold: 1, theirs: 1 }, 'all three kinds came up');
  // An empty hole does nothing.
  const empty = inst.view(0).holes.findIndex((m) => !m);
  const pts = inst.view(0).points.slice();
  inst.onInput(1, { type: 'whack', hole: empty });
  assert.deepEqual(inst.view(0).points, pts);
  inst.onTimeUp();
  assert.equal(ended().winner, pts[0] === pts[1] ? null : pts[0] > pts[1] ? 0 : 1);
});

test('whack-a-mole: moles appear soon and drop back down', () => {
  const { inst, ctx } = run(whackAMole, 2);
  ctx.advance(SPAWN.firstMs + 1);
  const up = inst.view(0).holes.filter(Boolean);
  assert.equal(up.length, 1);
  ctx.advance(3000);
  assert.ok(!inst.view(0).holes.some((m) => m && m.id === up[0].id), 'the first mole went back down');
});

// ---- Fishing ----

test('fishing: hooking too early scares the fish; a bite then reeling lands one', () => {
  const { inst, ctx, ended } = run(fishing, 3);
  inst.onInput(0, { type: 'tap' });
  assert.equal(inst.view(0).lines[0].stage, 'scared');
  ctx.advance(SCARE_MS + 10);
  assert.equal(inst.view(0).lines[0].stage, 'wait');
  for (let t = 0; t < BITE.maxMs + 100 && inst.view(0).lines[0].stage !== 'bite'; t += 50) ctx.advance(50);
  assert.equal(inst.view(0).lines[0].stage, 'bite');
  inst.onInput(0, { type: 'tap' });
  assert.equal(inst.view(0).lines[0].stage, 'reel');
  // Steady taps (one every 300 ms) keep the tension down and land it.
  for (let i = 0; i < 40 && inst.view(0).lines[0].stage === 'reel'; i++) {
    inst.onInput(0, { type: 'tap' });
    ctx.advance(300);
  }
  assert.equal(inst.view(0).lines[0].fish, 1);
  inst.onTimeUp();
  assert.equal(ended().winner, 0);
});

test('fishing: mashing snaps the line; a missed bite swims off', () => {
  const { inst, ctx } = run(fishing, 4);
  const waitFor = (slot, stage) => {
    for (let t = 0; t < 10000 && inst.view(0).lines[slot].stage !== stage; t += 20) ctx.advance(20);
    assert.equal(inst.view(0).lines[slot].stage, stage);
  };
  waitFor(0, 'bite');
  inst.onInput(0, { type: 'tap' });
  for (let i = 0; i < 20 && inst.view(0).lines[0].stage === 'reel'; i++) inst.onInput(0, { type: 'tap' });
  assert.equal(inst.view(0).lines[0].stage, 'snapped');
  assert.equal(inst.view(0).lines[0].fish, 0);
  ctx.advance(SNAP_MS + 10);
  assert.equal(inst.view(0).lines[0].stage, 'wait');
  // Player 2 lets the bite go by.
  waitFor(1, 'bite');
  ctx.advance(BITE.windowMs + 10);
  assert.equal(inst.view(0).lines[1].stage, 'wait');
});

// ---- Glass Bridge ----

test('glass-bridge: the fake panel breaks for both and sends you back; first across wins', () => {
  const { inst, ctx, ended } = run(glassBridge, 1500);
  // Player 1 learns the bridge the hard way: try the left; if it breaks, the right is safe.
  const safe = [];
  let falls = 0;
  for (let i = 0; i < 100 && !ended(); i++) {
    const row = inst.view(0).runners[0].row;
    const side = safe[row] ?? 0;
    inst.onInput(0, { type: 'pick', side });
    const v = inst.view(0);
    if (v.broken[row][side]) {
      falls++;
      assert.equal(v.runners[0].row, 0, 'a fall sends you back to the start');
      assert.deepEqual(v.runners[0].falling && v.runners[0].falling.row, row);
      safe[row] = 1 - side;
      ctx.advance(FALL_MS);
    } else {
      safe[row] = side;
      if (!ended()) assert.ok(v.solid[row][side]);
      ctx.advance(STEP_MS);
    }
  }
  assert.equal(ended().winner, 0);
  assert.equal(inst.view(0).runners[0].falls, falls);
});

test('glass-bridge: a broken panel is gone for both; you can\'t step again mid-jump; at the end of time the furthest wins', () => {
  const { inst, ctx, ended } = run(glassBridge, 1000); // a bridge whose first left panel is fake
  const v0 = inst.view(0);
  // Player 2 tries the left of row 0. If it breaks, it's gone for player 1 too.
  inst.onInput(1, { type: 'pick', side: 0 });
  assert.ok(inst.view(0).broken[0][0]);
  assert.equal(inst.view(0).runners[1].falls, 1);
  inst.onInput(0, { type: 'pick', side: 0 }); // the broken panel: ignored
  assert.equal(inst.view(0).runners[0].falls, 0);
  const safe0 = 1;
  ctx.advance(FALL_MS);
  inst.onInput(0, { type: 'pick', side: safe0 });
  assert.equal(inst.view(0).runners[0].row, 1);
  assert.ok(inst.view(0).runners[0].busy);
  inst.onInput(0, { type: 'pick', side: 0 }); // too soon: ignored
  assert.equal(inst.view(0).runners[0].row, 1);
  assert.equal(inst.view(0).runners[0].falls, 0);
  assert.equal(v0.rows, ROWS);
  inst.onTimeUp();
  const [a, b] = inst.view(0).runners.map((r) => r.row);
  assert.equal(ended().winner, a === b ? null : a > b ? 0 : 1);
});

// ---- Ice Rink Sumo ----

test('ice-sumo: steering builds speed; sliding off the ice loses', () => {
  const { inst, ctx, ended } = run(iceSumo, 1);
  inst.onInput(0, { type: 'move', x: -1, y: 0 }); // player 1 drives off the left edge
  for (let i = 0; i < 300 && !ended(); i++) ctx.advance(TICK_MS);
  assert.ok(ended());
  assert.equal(ended().winner, 1);
  assert.ok(Math.hypot(inst.view(0).pucks[0].x, inst.view(0).pucks[0].y) > RINK_R);
});

test('ice-sumo: a head-on bump knocks the still puck away', () => {
  const { inst, ctx, ended } = run(iceSumo, 1);
  inst.debugPlace(0, { x: -1, y: 0, vx: 6, vy: 0 });
  inst.debugPlace(1, { x: 0.3, y: 0, vx: 0, vy: 0 });
  ctx.advance(TICK_MS * 3);
  const v = inst.view(0);
  assert.ok(v.bumps >= 1);
  assert.ok(v.pucks[1].vx > 3, 'the hit puck flies off');
  assert.ok(v.pucks[0].vx < 1, 'the hitter nearly stops');
  // Bad input is ignored; long sticks are clamped.
  inst.onInput(1, { type: 'move', x: NaN, y: 0 });
  inst.onInput(1, { type: 'move', x: 'a', y: 0 });
  for (let i = 0; i < 300 && !ended(); i++) ctx.advance(TICK_MS);
  assert.equal(ended().winner, 0, 'the knocked puck slid off');
});

test('ice-sumo: at the end of time the puck nearer the middle wins', () => {
  const { inst, ended } = run(iceSumo, 1);
  inst.debugPlace(0, { x: 0.5, y: 0 });
  inst.debugPlace(1, { x: 3, y: 1 });
  inst.onTimeUp();
  assert.equal(ended().winner, 0);
});

// ---- Simon Says ----

test('simon-says: obey Simon (+1), wrong colour or a trap order (-1); one answer per order', () => {
  const { inst, ctx, ended } = run(simonSays, 9);
  ctx.advance(600);
  let v = inst.view(0);
  assert.ok(v.order && v.order.simon, 'the first order is a real one');
  inst.onInput(0, { type: 'press', color: v.order.color });
  inst.onInput(1, { type: 'press', color: COLORS.find((c) => c !== v.order.color) });
  inst.onInput(0, { type: 'press', color: v.order.color }); // a second press does nothing
  inst.onInput(1, { type: 'press', color: 'purple' }); // not a colour
  v = inst.view(0);
  assert.deepEqual(v.points, [SIMON.right, SIMON.wrong]);
  assert.deepEqual(v.answers, ['right', 'wrong']);
  // Find a trap order (no "Simon says") and fall for it.
  let trap = null;
  for (let t = 0; t < 20000 && !trap; t += 50) {
    ctx.advance(50);
    const o = inst.view(0).order;
    if (o && !o.done && !o.simon) trap = o;
  }
  assert.ok(trap, 'trap orders come up');
  const before = inst.view(0).points[1];
  inst.onInput(1, { type: 'press', color: trap.color });
  assert.equal(inst.view(0).points[1], before + SIMON.trap);
  assert.equal(inst.view(0).answers[1], 'trap');
  inst.onTimeUp();
  const [a, b] = inst.view(0).points;
  assert.equal(ended().winner, a === b ? null : a > b ? 0 : 1);
});

test('simon-says: an order goes away after its time; late presses do nothing', () => {
  const { inst, ctx } = run(simonSays, 3);
  ctx.advance(600);
  const o = inst.view(0).order;
  ctx.advance(ORDER.startMs + 10);
  assert.equal(inst.view(0).order.done, true);
  inst.onInput(0, { type: 'press', color: o.color });
  assert.deepEqual(inst.view(0).points, [0, 0]);
  ctx.advance(ORDER.gapMs);
  assert.equal(inst.view(0).order.id, o.id + 1, 'the next order');
  assert.equal(inst.view(0).order.done, false);
});
