// The sixth batch of Party Minigames (2D, aim & balance): Cannon Lob and Stack Attack, each driven
// directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import cannonLob, { ANGLE, BLOCKS, CHARGE_MS, RELOAD_MS, WIND_MAX, WIND_MS, TOWER_X, BLOCK_H, WALL } from '../server/games/minis/cannon-lob.js';
import stackAttack, { CATCH, TRAY_HALF, TICK_MS } from '../server/games/minis/stack-attack.js';

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
  let ends = 0;
  let updates = 0;
  // As in a real match: now() is the room's clock (long past 0), elapsed() is the minigame's own.
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: () => ctx.now() + 600000, elapsed: () => ctx.now(), update() { updates++; },
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { ends++; if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended, ends: () => ends, updates: () => updates };
}

test('the sixth batch: party minigames in 2D, in the party list', () => {
  for (const m of [cannonLob, stackAttack]) {
    assert.equal(m.kind, 'party');
    assert.equal(m.look, '2d');
    assert.ok(m.howTo && m.order && m.durationMs <= 45000, m.id);
    assert.ok(PARTIES.includes(m), m.id + ' is in PARTIES');
  }
});

// ---- Cannon Lob ----

/** Holds FIRE for `ms` (by the phone's own clock) and lets go. */
function shoot(r, slot, ms) {
  const t0 = r.ctx.now();
  r.inst.onInput(slot, { type: 'charge', t: t0 });
  r.ctx.advance(ms);
  r.inst.onInput(slot, { type: 'fire', t: t0 + ms });
}

/** Lets every shot in the air land. */
function settle(r) {
  for (let i = 0; i < 200 && r.inst.view(null).shots.length; i++) r.ctx.advance(50);
}

test('cannon lob: aim takes a whole angle in range; anything else is ignored', () => {
  const { inst } = run(cannonLob);
  inst.onInput(0, { type: 'aim', angle: 60 });
  assert.equal(inst.view(null).cannons[0].angle, 60);
  for (const angle of [ANGLE.min - 1, ANGLE.max + 1, 40.5, '50', null, NaN]) inst.onInput(0, { type: 'aim', angle });
  inst.onInput(2, { type: 'aim', angle: 30 });
  assert.equal(inst.view(null).cannons[0].angle, 60);
  assert.equal(inst.view(null).cannons[1].angle, ANGLE.start);
});

test('cannon lob: the stick turns the cannon steadily, and it stops at the end of its range', () => {
  const { inst, ctx } = run(cannonLob);
  inst.onInput(1, { type: 'turn', v: 1 });
  ctx.advance(300);
  const a = inst.view(null).cannons[1].angle;
  assert.ok(a > ANGLE.start && a < ANGLE.max, String(a));
  ctx.advance(5000);
  assert.equal(inst.view(null).cannons[1].angle, ANGLE.max);
  inst.onInput(1, { type: 'turn', v: 0 });
  inst.onInput(1, { type: 'turn', v: 'up' }); // ignored
  ctx.advance(500);
  assert.equal(inst.view(null).cannons[1].angle, ANGLE.max);
});

test('cannon lob: hold FIRE to charge, let go to shoot; longer holds shoot harder', () => {
  const r = run(cannonLob);
  r.inst.debugWind(0);
  r.inst.onInput(0, { type: 'fire', t: 0 }); // not charging: nothing
  assert.equal(r.inst.view(null).shots.length, 0);
  shoot(r, 0, 200);
  const soft = r.inst.view(null).shots[0];
  assert.ok(soft && soft.slot === 0);
  settle(r);
  r.ctx.advance(RELOAD_MS);
  shoot(r, 1, CHARGE_MS);
  const hard = r.inst.view(null).shots[0];
  assert.ok(Math.hypot(hard.vx, hard.vy) > Math.hypot(soft.vx, soft.vy));
  assert.ok(hard.vx < 0, 'the right-hand cannon shoots left');
});

test('cannon lob: the charge counts from the phone\'s own times, not when they arrived', () => {
  const r = run(cannonLob);
  r.ctx.advance(1000);
  // Pressed at 900 and let go at 1000 (both arrive late, together): a short, soft shot.
  r.inst.onInput(0, { type: 'charge', t: 900 });
  r.inst.onInput(0, { type: 'fire', t: 1000 });
  r.ctx.advance(1000);
  r.inst.onInput(1, { type: 'charge', t: 1000 });
  r.inst.onInput(1, { type: 'fire', t: 2000 });
  const [a, b] = r.inst.view(null).shots;
  assert.ok(Math.hypot(a.vx, a.vy) < Math.hypot(b.vx, b.vy));
});

test('cannon lob: a charge can\'t claim to have started long before it arrived', () => {
  const r = run(cannonLob);
  r.inst.debugWind(0);
  r.ctx.advance(5000);
  // A forged press time from the start of the game, let go at once: still a soft shot.
  r.inst.onInput(0, { type: 'charge', t: 0 });
  r.inst.onInput(0, { type: 'fire', t: 5000 });
  const s = r.inst.view(null).shots[0];
  assert.ok(Math.hypot(s.vx, s.vy) < 40, String(Math.hypot(s.vx, s.vy)));
});

test('cannon lob: hold FIRE through the reload and the charge starts when it\'s loaded', () => {
  const r = run(cannonLob);
  shoot(r, 0, 100);
  settle(r);
  r.inst.onInput(0, { type: 'charge', t: r.ctx.now() }); // still reloading
  assert.equal(r.inst.view(null).cannons[0].charging, false);
  r.ctx.advance(RELOAD_MS + 100);
  assert.equal(r.inst.view(null).cannons[0].charging, true);
  r.inst.onInput(0, { type: 'fire', t: r.ctx.now() });
  assert.equal(r.inst.view(null).shots.length, 1);
  // Let go during the reload: nothing waits.
  settle(r);
  r.inst.onInput(0, { type: 'charge', t: r.ctx.now() });
  r.inst.onInput(0, { type: 'fire', t: r.ctx.now() });
  r.ctx.advance(RELOAD_MS + 100);
  assert.equal(r.inst.view(null).cannons[0].charging, false);
});

test('cannon lob: aiming sends one update per change, through the tick', () => {
  const r = run(cannonLob);
  r.ctx.advance(200);
  const before = r.updates();
  r.inst.onInput(0, { type: 'aim', angle: 50 });
  r.inst.onInput(0, { type: 'aim', angle: 50 });
  r.ctx.advance(100);
  assert.equal(r.updates() - before, 1);
});

test('cannon lob: both towers down in the same moment is a draw', () => {
  const r = run(cannonLob);
  for (let i = 0; i < BLOCKS - 1; i++) {
    r.inst.debugShot(0, { x: TOWER_X[1], y: 19, vx: 0, vy: -10 });
    r.inst.debugShot(1, { x: TOWER_X[0], y: 19, vx: 0, vy: -10 });
    settle(r);
  }
  r.inst.debugShot(1, { x: TOWER_X[0], y: 19, vx: 0, vy: -10 });
  r.inst.debugShot(0, { x: TOWER_X[1], y: 19, vx: 0, vy: -10 });
  settle(r);
  assert.deepEqual(r.ended(), { winner: null });
});

test('cannon lob: one shot at a time, then a short reload', () => {
  const r = run(cannonLob);
  shoot(r, 0, 500);
  shoot(r, 0, 100); // still in the air
  assert.equal(r.inst.view(null).shots.length, 1);
  settle(r);
  assert.equal(r.inst.view(null).cannons[0].ready, false, 'reloading');
  r.ctx.advance(RELOAD_MS);
  assert.equal(r.inst.view(null).cannons[0].ready, true);
  shoot(r, 0, 100);
  assert.equal(r.inst.view(null).shots.length, 1);
});

test('cannon lob: a shot dropped on the rival\'s tower knocks a block off; your own tower and the wall stop it', () => {
  const r = run(cannonLob);
  r.inst.debugShot(0, { x: TOWER_X[1], y: BLOCKS * BLOCK_H + 4, vx: 0, vy: -10 });
  settle(r);
  let v = r.inst.view(null);
  assert.equal(v.towers[1].blocks, BLOCKS - 1);
  assert.deepEqual(v.knocked, [1, 0]);
  assert.equal(v.last.kind, 'hit');
  // Over your own tower: it lands on the ground behind it, nothing knocked.
  r.inst.debugShot(0, { x: TOWER_X[0], y: BLOCKS * BLOCK_H + 4, vx: 0, vy: -10 });
  settle(r);
  assert.equal(r.inst.view(null).towers[0].blocks, BLOCKS);
  // Into the wall.
  r.inst.debugShot(1, { x: WALL.x + 10, y: WALL.h / 2, vx: -40, vy: 0 });
  settle(r);
  v = r.inst.view(null);
  assert.equal(v.last.kind, 'wall');
  assert.deepEqual(v.knocked, [1, 0]);
});

test('cannon lob: knock off all three and you win at once', () => {
  const r = run(cannonLob);
  for (let i = 0; i < BLOCKS; i++) {
    r.inst.debugShot(1, { x: TOWER_X[0], y: BLOCKS * BLOCK_H + 4, vx: 0, vy: -10 });
    settle(r);
  }
  assert.deepEqual(r.ended(), { winner: 1 });
  r.inst.onTimeUp();
  r.ctx.advance(1000);
  assert.equal(r.ends(), 1);
});

test('cannon lob: at time up, more blocks knocked wins; level is a draw', () => {
  const a = run(cannonLob);
  a.inst.debugShot(0, { x: TOWER_X[1], y: 20, vx: 0, vy: -10 });
  settle(a);
  a.inst.onTimeUp();
  assert.deepEqual(a.ended(), { winner: 0 });
  const b = run(cannonLob);
  b.inst.onTimeUp();
  assert.deepEqual(b.ended(), { winner: null });
});

test('cannon lob: a real shot can clear the wall and hit, from both sides alike', () => {
  // Some angle and hold reach the rival's tower in still air, and the same works mirrored.
  let found = null;
  for (let angle = ANGLE.min; angle <= ANGLE.max && !found; angle += 5) {
    for (let ms = 100; ms <= CHARGE_MS && !found; ms += 50) {
      const r = run(cannonLob);
      r.inst.debugWind(0);
      r.inst.onInput(0, { type: 'aim', angle });
      shoot(r, 0, ms);
      settle(r);
      if (r.inst.view(null).knocked[0] === 1) found = { angle, ms };
    }
  }
  assert.ok(found, 'some shot hits');
  const r = run(cannonLob);
  r.inst.debugWind(0);
  r.inst.onInput(1, { type: 'aim', angle: found.angle });
  shoot(r, 1, found.ms);
  settle(r);
  assert.equal(r.inst.view(null).knocked[1], 1);
});

test('cannon lob: the wind blows shots along, and it changes every few seconds within its range', () => {
  const still = run(cannonLob);
  still.inst.debugWind(0);
  shoot(still, 0, 600);
  still.ctx.advance(500);
  const windy = run(cannonLob);
  windy.inst.debugWind(WIND_MAX);
  shoot(windy, 0, 600);
  windy.ctx.advance(500);
  assert.ok(windy.inst.view(null).shots[0].x > still.inst.view(null).shots[0].x);

  const { inst, ctx } = run(cannonLob, 7);
  const winds = new Set();
  for (let i = 0; i < 6; i++) {
    const w = inst.view(null).wind;
    assert.ok(Number.isInteger(w) && Math.abs(w) <= WIND_MAX, String(w));
    winds.add(w);
    ctx.advance(WIND_MS);
  }
  assert.ok(winds.size > 1);
});

test('cannon lob: the screens only hear about changes, not every tick', () => {
  const r = run(cannonLob);
  r.ctx.advance(1000);
  const quiet = r.updates();
  r.ctx.advance(1000);
  assert.ok(r.updates() - quiet <= 1, 'nothing moving: (almost) no updates');
  shoot(r, 0, 500);
  const before = r.updates();
  r.ctx.advance(500);
  assert.ok(r.updates() - before >= 5, 'a shot in the air is followed');
});

// ---- Stack Attack ----

/**
 * Advances until the next crate lands, with each tray placed under it at `off` (in catch widths),
 * or as far from it as it goes ('away'), or left where it is (null).
 */
function landNext(r, offs) {
  const c = r.inst.view(null).crates[0];
  assert.ok(c, 'a crate is falling');
  offs.forEach((off, slot) => {
    if (off === 'away') r.inst.debugTray(slot, c.x < 0.5 ? 1 : 0);
    else if (off !== null) r.inst.debugTray(slot, c.x - off * CATCH);
  });
  r.ctx.advance(c.left + TICK_MS);
  return c;
}

/** Advances until a crate is falling. */
function nextCrate(r) {
  for (let i = 0; i < 100 && !r.inst.view(null).crates.length; i++) r.ctx.advance(TICK_MS);
}

test('stack attack: the same crates fall for both of you', () => {
  const { inst, ctx } = run(stackAttack, 3);
  ctx.advance(3000);
  const v0 = inst.view(0);
  const v1 = inst.view(1);
  assert.ok(v0.crates.length > 0);
  assert.deepEqual(v0.crates, v1.crates);
  for (const c of v0.crates) assert.ok(c.x >= TRAY_HALF && c.x <= 1 - TRAY_HALF);
});

test('stack attack: the tray slides with the stick and stays in its half; bad input is ignored', () => {
  const { inst, ctx } = run(stackAttack);
  const x0 = inst.view(null).trays[0].x;
  inst.onInput(0, { type: 'move', x: 1 });
  ctx.advance(200);
  assert.ok(inst.view(null).trays[0].x > x0);
  ctx.advance(5000);
  assert.equal(inst.view(null).trays[0].x, 1 - TRAY_HALF);
  for (const x of ['1', NaN, null, Infinity]) inst.onInput(1, { type: 'move', x });
  inst.onInput(2, { type: 'move', x: 1 });
  ctx.advance(300);
  assert.equal(inst.view(null).trays[1].x, x0);
});

test('stack attack: catch a crate and it stacks; miss and it doesn\'t', () => {
  const r = run(stackAttack);
  nextCrate(r);
  landNext(r, [0, 'away']);
  const v = r.inst.view(null);
  assert.equal(v.stacks[0].height, 1);
  assert.equal(v.stacks[0].lean, 0, 'dead centre: no lean');
  nextCrate(r);
  landNext(r, [0, 'away']);
  assert.equal(r.inst.view(null).stacks[0].height, 2);
  assert.equal(r.inst.view(null).stacks[1].height, 0);
});

test('stack attack: off-centre catches lean the stack; lean too far and it topples', () => {
  const r = run(stackAttack);
  let toppled = false;
  for (let i = 0; i < 6 && !toppled; i++) {
    nextCrate(r);
    landNext(r, [0.9, null]);
    const s = r.inst.view(null).stacks[0];
    if (s.height === 0) toppled = true;
    else assert.ok(s.lean > 0, 'leans the way the crate landed');
  }
  assert.ok(toppled, 'it toppled');
  assert.equal(r.inst.view(null).stacks[0].lean, 0, 'starts over straight');
  assert.ok(r.inst.view(null).stacks[0].topples === 1);
});

test('stack attack: catching on the other side straightens it again', () => {
  const r = run(stackAttack);
  // Crates near a wall are let go (the tray can't get that far off-centre on that side).
  for (let caught = 0; caught < 6;) {
    nextCrate(r);
    const near = Math.abs(r.inst.view(null).crates[0].x - 0.5) > 0.5 - TRAY_HALF - CATCH;
    landNext(r, [near ? 'away' : caught % 2 ? -0.9 : 0.9, null]);
    if (!near) caught++;
  }
  const s = r.inst.view(null).stacks[0];
  assert.equal(s.height, 6);
  assert.ok(Math.abs(s.lean) < 0.01, String(s.lean));
});

test('stack attack: at time up the taller stack wins; level is a draw', () => {
  const a = run(stackAttack);
  nextCrate(a);
  landNext(a, [0, 'away']);
  a.inst.onTimeUp();
  assert.deepEqual(a.ended(), { winner: 0 });
  const b = run(stackAttack);
  b.inst.onTimeUp();
  assert.deepEqual(b.ended(), { winner: null });
  b.inst.onTimeUp();
  assert.equal(b.ends(), 1);
});

test('stack attack: standing still, the screens hear about crates, not every tick', () => {
  const r = run(stackAttack);
  r.ctx.advance(2000);
  const before = r.updates();
  r.ctx.advance(2000);
  assert.ok(r.updates() - before <= 8, String(r.updates() - before));
});
