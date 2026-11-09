// The computer racers in Kart Race (3D): one driving function shared with the seat-filling
// computer opponent, lanes and passing, and the race loop driving every computer kart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { TIMING } from '../server/games/kart-race.js';
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

test('the seat computer drives exactly as before', () => {
  // Some real driver's views from a race (both karts driven, items on so there's something to use).
  const { ctx, game } = race3d();
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
  assert.ok(Math.sign(steer(2)) !== Math.sign(steer(-2)) && steer(2) !== 0, `${steer(-2)} ${steer(2)}`);
  const mid = steer(0);
  assert.ok(mid > Math.min(steer(-2), steer(2)) && mid < Math.max(steer(-2), steer(2)), String(mid));
});
