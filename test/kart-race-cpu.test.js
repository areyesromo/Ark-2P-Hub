// The computer racers in Kart Race (3D): one driving function shared with the seat-filling
// computer opponent, lanes and passing, and the race loop driving every computer kart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { TIMING, KartRace } from '../server/games/kart-race.js';
import { KartRace3D } from '../server/games/kart-race-3d.js';
import { kartRaceBot, driveKart } from '../server/games/kart-race-bot.js';
import { kartRaceBot as kartRaceBotMain } from './fixtures/kart-race-bot-main.js';
import { fakeCtx } from './helpers.js';

/** A seeded random number generator (mulberry32), so two drivers can get the same draws. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 3D 1v1 race on big track `track` (1-5), lights out. */
function race3d(settings = {}) {
  const ctx = fakeCtx();
  const game = new KartRace3D(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries({ track: 2, laps: 3, items: 1, ...settings })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

test('on the 2D tracks the seat computer drives exactly as before', () => {
  // Some real driver's views from a 2D race (both karts driven, items on so there's something to
  // use): the big 3D roads have their own driving (below); the small ones must not change.
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries({ track: 1, laps: 3, items: 1 })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  const views = [];
  const mem = [{}, {}];
  for (let n = 0; n < 2000 && views.length < 200; n++) {
    for (const slot of [0, 1]) {
      const m = kartRaceBot(game.botView(slot), 'normal', () => 0.5, 0, mem[slot]);
      if (m && m.type === 'drive') game.onInput(slot, { type: 'drive', steer: m.steer, gas: m.gas, brake: m.brake, drift: m.drift });
    }
    ctx.advance(17);
    if (n % 10 === 0) views.push(JSON.parse(JSON.stringify(game.botView(0))));
  }
  for (const level of ['easy', 'normal', 'hard']) {
    const [ra, rb] = [seeded(7), seeded(7)];
    const [ma, mb] = [{}, {}];
    for (const v of views) assert.deepEqual(kartRaceBot(v, level, ra, 0, ma), kartRaceBotMain(v, level, rb, 0, mb), level);
  }
});

test('a lane shifts the line the driver takes', () => {
  const { game } = race3d();
  const v = game.botView(0);
  const steer = (lane) => driveKart(v, 'hard', () => 0.5, {}, lane).steer;
  // Further right a lane, further right it steers (full lock is the limit): the track's own lanes.
  const [left, mid, right] = game.track.lanes;
  assert.ok(steer(left) < steer(right), `${steer(left)} ${steer(right)}`);
  assert.ok(steer(left) <= steer(mid) && steer(mid) <= steer(right), `${steer(left)} ${steer(mid)} ${steer(right)}`);
});

// ---- the race loop drives the computer racers ----

import { race8, placeAt } from './helpers-kart.js';
import { CPU, pointAt } from '../server/games/kart-race.js';
import { TRACKS_3D } from '../server/games/kart-tracks-3d.js';

/** Race on until every computer has a lap (or the time is up), noting the longest any sat still. */
function runLap(ctx, game, maxMs = 200000) { // (a big track's lap is about 450 units)
  const still = new Map();
  let worst = 0;
  for (let ms = 0; ms < maxMs; ms += 17) {
    ctx.advance(17);
    for (let i = 2; i < game.karts.length; i++) {
      const k = game.karts[i];
      if (ms > 5000 && Math.abs(k.speed) < 0.5 && k.finishedAt === null) still.set(i, (still.get(i) || 0) + 17);
      else still.set(i, 0);
      worst = Math.max(worst, still.get(i));
    }
    if (game.karts.slice(2).every((k) => k.laps >= 1)) break;
  }
  return worst;
}

TRACKS_3D.forEach((def, t) => {
  test(`six computers lap ${def.name} without getting stuck`, () => {
    const { ctx, game } = race8({ track: t + 1 });
    assert.equal(game.karts.length, 8);
    const worst = runLap(ctx, game);
    game.karts.slice(2).forEach((k, n) => assert.ok(k.laps >= 1, `computer ${n + 2} has no lap`));
    assert.ok(worst <= 4000, `a computer sat still for ${worst} ms`);
  });
});

test('no pile-up at the start', () => {
  const { ctx, game } = race8({ track: 2 });
  const from = game.karts.map((k) => k.progress);
  for (let ms = 0; ms < 8000; ms += 17) ctx.advance(17);
  for (let i = 2; i < 8; i++) {
    const moved = (((game.karts[i].progress - from[i]) % 1) + 1) % 1 * game.track.length + game.karts[i].laps * game.track.length;
    assert.ok(moved >= 25, `computer ${i} moved only ${moved.toFixed(1)}`);
  }
});

test('a computer passes a stopped kart in its lane', () => {
  const { ctx, game } = race8({ track: 2 });
  // The straightest bit of Speedway Oval: where the heading changes least over the next 12 units.
  const L = game.track.length;
  let best = { p: 0, turn: Infinity };
  for (let p = 0.15; p < 0.8; p += 0.01) { // (well away from the line, which only counts once halfway round)
    const turn = Math.abs(Math.atan2(Math.sin(pointAt(game.track, p + 12 / L).angle - pointAt(game.track, p).angle), Math.cos(pointAt(game.track, p + 12 / L).angle - pointAt(game.track, p).angle)));
    if (turn < best.turn) best = { p, turn };
  }
  game.karts.forEach((k, i) => { if (i !== 0 && i !== 2) placeAt(game, i, (best.p + 0.5 + i * 0.03) % 1); });
  const lane = CPU.lanes[0];
  placeAt(game, 2, best.p, lane);
  placeAt(game, 0, best.p + 6 / L, lane);
  game.karts[2].driver.lane = lane;
  for (let ms = 0; ms < 5000; ms += 17) ctx.advance(17);
  const along = (k) => k.laps + k.progress; // (it may cross the line)
  assert.ok(along(game.karts[2]) > along(game.karts[0]), `${along(game.karts[2])} vs ${along(game.karts[0])}`);
});

test('Easy is slower than Normal, Normal slower than Hard', () => {
  const lap = (level) => {
    const { ctx, game } = race8({ track: 2, level });
    runLap(ctx, game, 120000);
    const laps = game.karts.slice(2).map((k) => k.bestLap).filter((x) => x !== null);
    return laps.reduce((a, b) => a + b, 0) / laps.length;
  };
  const [easy, normal, hard] = ['easy', 'normal', 'hard'].map(lap);
  assert.ok(easy > normal && normal > hard, `easy ${easy} normal ${normal} hard ${hard}`);
});

test("the players' karts are never driven by the race", () => {
  const { ctx, game } = race8({ track: 2 });
  const at = game.karts.slice(0, 2).map((k) => [k.x, k.y]);
  for (let ms = 0; ms < 10000; ms += 17) ctx.advance(17);
  game.karts.slice(0, 2).forEach((k, i) => assert.ok(Math.hypot(k.x - at[i][0], k.y - at[i][1]) < 0.5, `player ${i + 1} moved`));
});

// ---- the seat computer on the big 3D roads, driven as the room drives it ----

/**
 * The computer in player 2's seat as the room runs it (rooms.js driveBot): a move each time its view
 * changes, played a reaction time later. Player 1 sits still. Returns its first lap's time (ms, or
 * null) and how often its steering flipped from lock to lock (a weave), a minute.
 */
function seatLap(trackSetting, level) {
  const ctx = fakeCtx();
  const rng = seeded(11);
  const game = new KartRace3D(ctx, rng);
  game.start();
  for (const [key, value] of Object.entries({ track: trackSetting, laps: 3, items: 1 })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  const k = game.karts[1];
  const memory = {};
  let pending = null;
  let seen = '';
  let flips = 0;
  let lastSteer = 0;
  let ms = 0;
  for (; ms < 150000 && k.bestLap === null; ms += 17) {
    const view = game.botView(1);
    const key = JSON.stringify(view);
    if (key !== seen && !pending) {
      seen = key;
      const move = kartRaceBot(view, level, rng, 0, memory);
      if (move) pending = { at: ms + (move.botDelayMs || 0), move };
    }
    if (pending && ms >= pending.at) {
      const { botDelayMs, ...input } = pending.move;
      game.onInput(1, input);
      pending = null;
    }
    if (k.steer * lastSteer < -0.5) flips++;
    if (k.steer) lastSteer = k.steer;
    ctx.advance(17);
  }
  return { lap: k.bestLap, flipsPerMin: flips / (ms / 60000) };
}

const LAP_MS = { easy: 75000, normal: 62000, hard: 55000 }; // a first lap well inside these

TRACKS_3D.forEach((def, t) => {
  test(`the seat computer laps ${def.name} at each level, Hard fastest, without weaving`, () => {
    const laps = {};
    for (const level of ['easy', 'normal', 'hard']) {
      const r = seatLap(t + 1, level);
      assert.ok(r.lap !== null && r.lap <= LAP_MS[level], `${level}: lap ${r.lap}`);
      if (level !== 'easy') assert.ok(r.flipsPerMin < 2, `${level} weaves: ${r.flipsPerMin.toFixed(1)} lock flips a minute`);
      laps[level] = r.lap;
    }
    assert.ok(laps.hard < laps.normal && laps.normal < laps.easy, JSON.stringify(laps));
  });
});

test('two seat computers side by side on a big road give each other room instead of grinding', () => {
  // Same racer, same driving: both aim at the same middle, and used to rub along at a crawl.
  const ctx = fakeCtx();
  const game = new KartRace3D(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries({ track: 2, laps: 3, items: 0 })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  const memory = [{}, {}];
  for (let ms = 0; ms < 15000; ms += 17) {
    for (const slot of [0, 1]) {
      const m = kartRaceBot(game.botView(slot), 'normal', () => 0.5, 0, memory[slot]);
      if (m && m.type === 'drive') game.onInput(slot, { type: 'drive', steer: m.steer, gas: m.gas, brake: m.brake, drift: m.drift });
    }
    ctx.advance(17);
  }
  for (const k of game.karts) assert.ok(k.speed > 6, `speed ${k.speed}`);
  assert.ok(game.events.bumps < 20, `bumps ${game.events.bumps}`);
});
