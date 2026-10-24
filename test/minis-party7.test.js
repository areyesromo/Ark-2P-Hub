// The seventh batch of Party Minigames (3D arenas): Bumper Cars and Paint Grab, each driven
// directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import bumperCars, { ARENA_R, CAR_R, SPIN_MS, TICK_MS } from '../server/games/minis/bumper-cars.js';
import paintGrab, { COLS, ROWS, BUCKET_MS, BUCKET_LIFE_MS, TICK_MS as PAINT_TICK } from '../server/games/minis/paint-grab.js';

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

test('the seventh batch: party minigames in 3D, in the party list', () => {
  for (const m of [bumperCars, paintGrab]) {
    assert.equal(m.kind, 'party');
    assert.equal(m.look, '3d');
    assert.ok(m.howTo && m.order && m.durationMs <= 45000, m.id);
    assert.ok(PARTIES.includes(m), m.id + ' is in PARTIES');
  }
});

// ---- Bumper Cars ----

const car = (inst, slot) => inst.view(null).cars[slot];

test('bumper cars: the car turns towards the stick and drives that way; bad input is ignored', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(1, { x: 3, y: 4 }); // out of the way
  const y0 = car(inst, 0).y;
  inst.onInput(0, { type: 'move', x: 0, y: 1 }); // towards the camera (+y)
  ctx.advance(1000);
  const c = car(inst, 0);
  assert.ok(c.y > y0 + 1, 'drove down the screen: ' + c.y);
  assert.ok(Math.abs(c.h - Math.PI / 2) < 0.2, 'faces that way: ' + c.h);
  for (const bad of [{ x: '1', y: 0 }, { x: NaN, y: 0 }, { x: 0 }, null]) inst.onInput(1, { type: 'move', ...bad });
  inst.onInput(2, { type: 'move', x: 1, y: 0 });
  ctx.advance(500);
  assert.deepEqual([car(inst, 1).x, car(inst, 1).y], [3, 4]);
});

test('bumper cars: the rail keeps you in the arena', () => {
  const { inst, ctx } = run(bumperCars);
  inst.onInput(0, { type: 'move', x: -1, y: 0 });
  ctx.advance(5000);
  const c = car(inst, 0);
  assert.ok(Math.hypot(c.x, c.y) <= ARENA_R - CAR_R + 0.01, String(Math.hypot(c.x, c.y))); // the view rounds to 0.01
});

test('bumper cars: ram them in the side and you score; they spin out', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(1, { x: 0, y: 0, h: -Math.PI / 2, vx: 0, vy: 0 }); // facing up the screen
  inst.debugPlace(0, { x: -2 * CAR_R - 0.3, y: 0, h: 0, vx: 5, vy: 0 }); // driving right, into its side
  ctx.advance(200);
  const v = inst.view(null);
  assert.deepEqual(v.points, [1, 0]);
  assert.equal(v.cars[1].spinning, true);
  assert.equal(v.cars[0].spinning, false);
});

test('bumper cars: ram them from behind and you score', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(0, { x: 0, y: 0, h: Math.PI, vx: 0, vy: 0 }); // facing left, away from car 1
  inst.debugPlace(1, { x: 2 * CAR_R + 0.3, y: 0, h: Math.PI, vx: -5, vy: 0 });
  ctx.advance(200);
  assert.deepEqual(inst.view(null).points, [0, 1]);
});

test('bumper cars: a head-on crash scores nothing, whoever was faster', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(0, { x: -CAR_R - 0.2, y: 0, h: 0, vx: 5, vy: 0 });
  inst.debugPlace(1, { x: CAR_R + 0.2, y: 0, h: Math.PI, vx: -1, vy: 0 });
  ctx.advance(300);
  assert.deepEqual(inst.view(null).points, [0, 0]);
  // Driving into a car that's facing you (standing still) is head-on too.
  const b = run(bumperCars);
  b.inst.debugPlace(1, { x: 0, y: 0, h: Math.PI, vx: 0, vy: 0 });
  b.inst.debugPlace(0, { x: -2 * CAR_R - 0.3, y: 0, h: 0, vx: 5, vy: 0 });
  b.ctx.advance(300);
  assert.deepEqual(b.inst.view(null).points, [0, 0]);
});

test('bumper cars: one ram scores once, even pushing on', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(1, { x: 0, y: 0, h: -Math.PI / 2, vx: 0, vy: 0 });
  inst.debugPlace(0, { x: -2 * CAR_R - 0.3, y: 0, h: 0, vx: 5, vy: 0 });
  inst.onInput(0, { type: 'move', x: 1, y: 0 });
  ctx.advance(400);
  assert.deepEqual(inst.view(null).points, [1, 0]);
});

test('bumper cars: rammed while sliding sideways into them, the rammer still scores (whoever was faster)', () => {
  const { inst, ctx } = run(bumperCars);
  // Car 0 faces up but is shoved sideways (right) fast; car 1 drives its front into car 0's side.
  inst.debugPlace(0, { x: 0, y: 0, h: -Math.PI / 2, vx: 5, vy: 0 });
  inst.debugPlace(1, { x: 2 * CAR_R + 0.05, y: 0, h: Math.PI, vx: -2, vy: 0 });
  ctx.advance(TICK_MS);
  assert.deepEqual(inst.view(null).points, [0, 1]);
});

test('bumper cars: a gentle nudge from behind isn\'t a ram', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(1, { x: 2 * CAR_R + 0.02, y: 0, h: 0, vx: 5.2, vy: 0 });
  inst.debugPlace(0, { x: 0, y: 0, h: 0, vx: 5.5, vy: 0 });
  ctx.advance(200);
  assert.deepEqual(inst.view(null).points, [0, 0]);
});

test('bumper cars: reversing into them isn\'t a ram', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(0, { x: 0, y: 0, h: Math.PI, vx: 3, vy: 0 }); // backing up to the right
  inst.debugPlace(1, { x: 2 * CAR_R + 0.1, y: 0, h: -Math.PI / 2, vx: 0, vy: 0 });
  ctx.advance(200);
  assert.deepEqual(inst.view(null).points, [0, 0]);
});

test('bumper cars: grinding against them is one bump, not one a tick; pushing on past the spin scores no more', () => {
  const { inst, ctx } = run(bumperCars);
  // Car 1 pinned against the rail, side on; car 0 keeps driving into it.
  inst.debugPlace(1, { x: ARENA_R - CAR_R, y: 0, h: -Math.PI / 2, vx: 0, vy: 0 });
  inst.debugPlace(0, { x: ARENA_R - 3 * CAR_R - 0.3, y: 0, h: 0, vx: 4, vy: 0 });
  inst.onInput(0, { type: 'move', x: 1, y: 0 });
  ctx.advance(SPIN_MS + 1500);
  const v = inst.view(null);
  assert.deepEqual(v.points, [1, 0]);
  assert.ok(v.bump.n <= 2, 'bumps: ' + v.bump.n);
  for (const c of v.cars) assert.ok(Math.hypot(c.x, c.y) <= ARENA_R - CAR_R + 0.01, 'inside the rail');
});

test('bumper cars: a spinning car can\'t steer until it stops', () => {
  const { inst, ctx } = run(bumperCars);
  inst.debugPlace(1, { x: 0, y: 0, h: -Math.PI / 2, vx: 0, vy: 0 });
  inst.debugPlace(0, { x: -2 * CAR_R - 0.3, y: 0, h: 0, vx: 5, vy: 0 });
  ctx.advance(100);
  assert.equal(car(inst, 1).spinning, true);
  inst.onInput(1, { type: 'move', x: 0, y: -1 });
  const at = car(inst, 1);
  ctx.advance(SPIN_MS - 200);
  assert.equal(car(inst, 1).spinning, true);
  assert.ok(car(inst, 1).y >= at.y - 0.3, 'not driving off while spinning');
  ctx.advance(1500);
  assert.equal(car(inst, 1).spinning, false);
  assert.ok(car(inst, 1).y < at.y - 0.5, 'drives once it has stopped spinning');
});

test('bumper cars: at time up more points wins; level is a draw', () => {
  const a = run(bumperCars);
  a.inst.debugPlace(1, { x: 0, y: 0, h: -Math.PI / 2, vx: 0, vy: 0 });
  a.inst.debugPlace(0, { x: -2 * CAR_R - 0.3, y: 0, h: 0, vx: 5, vy: 0 });
  a.ctx.advance(200);
  a.inst.onTimeUp();
  assert.deepEqual(a.ended(), { winner: 0 });
  const b = run(bumperCars);
  b.inst.onTimeUp();
  b.inst.onTimeUp();
  assert.deepEqual(b.ended(), { winner: null });
  assert.equal(b.ends(), 1);
});

test('bumper cars: standing still, no updates; driving, a steady stream', () => {
  const r = run(bumperCars);
  r.ctx.advance(500);
  const quiet = r.updates();
  r.ctx.advance(1000);
  assert.equal(r.updates() - quiet, 0);
  r.inst.onInput(0, { type: 'move', x: 1, y: 0 });
  const before = r.updates();
  r.ctx.advance(500);
  assert.ok(r.updates() - before >= 500 / TICK_MS - 1);
});

// ---- Paint Grab ----

const tileAt = (v, c, r) => v.tiles[r * COLS + c];

test('paint grab: you start on a tile of your colour', () => {
  const { inst, ctx } = run(paintGrab);
  ctx.advance(100);
  const v = inst.view(null);
  assert.equal(v.tiles.length, COLS * ROWS);
  assert.deepEqual(v.counts, [1, 1]);
  assert.equal(tileAt(v, Math.floor(v.players[0].x), Math.floor(v.players[0].y)), '0');
  assert.equal(tileAt(v, Math.floor(v.players[1].x), Math.floor(v.players[1].y)), '1');
});

test('paint grab: driving over tiles paints them, rival\'s too; you stay on the floor', () => {
  const { inst, ctx } = run(paintGrab);
  inst.onInput(0, { type: 'move', x: 1, y: 0 });
  ctx.advance(1000);
  const v = inst.view(null);
  assert.ok(v.counts[0] >= 4, String(v.counts[0]));
  // Take one of theirs.
  const p1 = v.players[1];
  inst.debugPlace(0, { x: p1.x, y: p1.y - 1 });
  inst.debugPlace(1, { x: 0.5, y: 0.5 });
  inst.onInput(0, { type: 'move', x: 0, y: 1 });
  ctx.advance(300);
  assert.equal(tileAt(inst.view(null), Math.floor(p1.x), Math.floor(p1.y)), '0');
  inst.onInput(0, { type: 'move', x: 1, y: 1 });
  ctx.advance(10000);
  const p = inst.view(null).players[0];
  assert.ok(p.x < COLS && p.y < ROWS && p.x > 0 && p.y > 0);
  for (const bad of [{ x: '1', y: 0 }, { x: Infinity, y: 0 }]) inst.onInput(1, { type: 'move', ...bad });
  inst.onInput(-1, { type: 'move', x: 1, y: 0 });
});

test('paint grab: a tile you both stand on stays whoever\'s it was', () => {
  const { inst, ctx } = run(paintGrab);
  ctx.advance(100);
  const p0 = inst.view(null).players[0];
  inst.debugPlace(1, { x: p0.x, y: p0.y });
  ctx.advance(500);
  assert.equal(tileAt(inst.view(null), Math.floor(p0.x), Math.floor(p0.y)), '0');
});

test('paint grab: grab a paint bucket and it splashes the tiles around you', () => {
  const { inst, ctx } = run(paintGrab);
  ctx.advance(100);
  inst.debugBucket({ c: 0, r: 0 });
  inst.debugPlace(1, { x: 0.5, y: 0.5 });
  ctx.advance(100);
  const v = inst.view(null);
  assert.equal(v.bucket, null);
  for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.equal(tileAt(v, c, r), '1', c + ',' + r);
  assert.equal(v.splash.slot, 1);
  inst.debugBucket({ c: 5, r: 4 });
  inst.debugPlace(0, { x: 5.5, y: 4.5 });
  ctx.advance(100);
  for (let c = 4; c <= 6; c++) for (let r = 3; r <= 5; r++) assert.equal(tileAt(inst.view(null), c, r), '0', c + ',' + r);
});

test('paint grab: a splash leaves the tile your rival is standing on theirs', () => {
  const { inst, ctx } = run(paintGrab);
  inst.debugPlace(0, { x: 5.5, y: 4.5 });
  inst.debugPlace(1, { x: 6.5, y: 4.5 });
  ctx.advance(100);
  // One tick each: the next tick would repaint the tile anyway.
  inst.debugBucket({ c: 6, r: 4 });
  ctx.advance(PAINT_TICK);
  assert.equal(tileAt(inst.view(null), 5, 4), '0');
  assert.equal(inst.view(null).counts[0], 1);
  // And the other way round.
  inst.debugBucket({ c: 5, r: 4 });
  ctx.advance(PAINT_TICK);
  assert.equal(tileAt(inst.view(null), 6, 4), '1');
});

test('paint grab: nobody grabs a bucket you\'re both standing on', () => {
  const { inst, ctx } = run(paintGrab);
  inst.debugPlace(0, { x: 5.5, y: 4.5 });
  inst.debugPlace(1, { x: 5.4, y: 4.4 });
  inst.debugBucket({ c: 5, r: 4 });
  ctx.advance(200);
  assert.ok(inst.view(null).bucket);
});

test('paint grab: buckets turn up now and then, one at a time, and go if nobody grabs them', () => {
  const { inst, ctx } = run(paintGrab, 5);
  inst.debugPlace(0, { x: 0.5, y: 0.5 });
  inst.debugPlace(1, { x: 0.5, y: ROWS - 0.5 });
  ctx.advance(BUCKET_MS + 100);
  const b = inst.view(null).bucket;
  assert.ok(b && Number.isInteger(b.c) && b.c >= 0 && b.c < COLS && b.r >= 0 && b.r < ROWS);
  for (const p of inst.view(null).players) assert.ok(Math.max(Math.abs(Math.floor(p.x) - b.c), Math.abs(Math.floor(p.y) - b.r)) > 1, 'away from both');
  ctx.advance(BUCKET_LIFE_MS);
  const later = inst.view(null).bucket;
  assert.ok(!later || later.id !== b.id, 'the first one went');
});

test('paint grab: at time up more tiles wins; level is a draw', () => {
  const a = run(paintGrab);
  a.inst.onInput(0, { type: 'move', x: 1, y: 0 });
  a.ctx.advance(500);
  a.inst.onTimeUp();
  assert.deepEqual(a.ended(), { winner: 0 });
  const b = run(paintGrab);
  b.ctx.advance(100);
  b.inst.onTimeUp();
  b.inst.onTimeUp();
  assert.deepEqual(b.ended(), { winner: null });
  assert.equal(b.ends(), 1);
});

test('paint grab: standing still, the screens hear (almost) nothing', () => {
  const r = run(paintGrab);
  r.ctx.advance(500);
  const quiet = r.updates();
  r.ctx.advance(1000);
  assert.ok(r.updates() - quiet <= 1);
});
