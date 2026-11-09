// Kart Race 3D's big tracks, and what makes a track's size its own (road samples, width, field,
// item rows, coins), while the 2D Kart Race keeps its small tracks exactly as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { KartRace, TRACKS, ARENAS, OPTIONS, TIMING, buildTrack, buildArena, coinSpots, CUT_JUMP, pointAt, locate } from '../server/games/kart-race.js';
import { fakeCtx } from './helpers.js';
import { ITEMS } from '../server/games/kart-items.js';

const Road = globalThis.ArkKartTrack;

/** A plain big loop, sized like the 3D tracks. */
const BIG = { name: 'Test Loop', points: [[10, 10], [118, 10], [118, 62], [10, 62]], width: 7, field: { w: 128, h: 72 }, rows: [0.2, 0.45, 0.7, 0.95], boxOffsets: [-2.4, -1.2, 0, 1.2, 2.4], coins: 96, boosts: [] };

test('2D tracks and arenas keep 240 samples', () => {
  TRACKS.forEach((t, i) => assert.equal(buildTrack(i).line.length, 240, t.name));
  ARENAS.forEach((a, i) => assert.equal(buildArena(i).line.length, 240, a.name));
});

test('a big loop gets more samples, about 0.3 apart', () => {
  const square = [[10, 10], [118, 10], [118, 62], [10, 62]];
  assert.equal(Road.samplesFor(square), Math.round(320 / 0.3));
  const road = Road.build(square);
  const spacing = road.length / road.line.length;
  assert.ok(spacing > 0.25 && spacing < 0.35, String(spacing));
});

test('a big track keeps its own width, field, rows and coins', () => {
  const t = buildTrack(0, [BIG]);
  assert.equal(t.width, 7);
  assert.equal(t.field.w, 128);
  assert.equal(t.rows.length, 4);
  assert.deepEqual(t.boxOffsets, BIG.boxOffsets);
  assert.ok(t.coins.length >= 80 && t.coins.length <= 96, String(t.coins.length));
  for (const [p, off] of t.coins) {
    const at = pointAt(t, p, off);
    assert.ok(locate(t, at.x, at.y).d <= t.width / 2, 'coin on the road');
  }
  assert.ok(Math.abs(t.cutJump - 3.5 / t.length) < 1e-9);
});

test('2D tracks: same coins, rows and shortcut threshold as before', () => {
  TRACKS.forEach((def, i) => {
    const t = buildTrack(i);
    assert.deepEqual(t.coins, coinSpots(def), def.name);
    assert.deepEqual(t.rows, ITEMS.rows, def.name);
    assert.deepEqual(t.boxOffsets, ITEMS.offsets, def.name);
    assert.equal(t.cutJump, CUT_JUMP, def.name);
    assert.equal(t.width, 3.4, def.name);
    assert.deepEqual(t.field, { w: 32, h: 18 }, def.name);
  });
});

/** A game with its own two big tracks. */
class Big extends KartRace {
  get tracks() {
    return [BIG, { ...BIG, name: 'Test Loop 2' }];
  }
  get options() {
    return { ...OPTIONS, track: [0, 1, 2] };
  }
}

/** A race on game class G, settings applied, lights out. */
function racingOn(G, settings = {}, ctx = fakeCtx()) {
  const game = new G(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries(settings)) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

test('a game races on its own track list', () => {
  const { game } = racingOn(Big, { track: 1 });
  assert.equal(game.track.name, 'Test Loop');
  const v = game.hostView();
  assert.deepEqual(v.trackNames, ['Test Loop', 'Test Loop 2']);
  assert.equal(v.field.w, 128);
  assert.equal(v.trackWidth, 7);
});

test("a saved track the game doesn't have falls back to Mixed", () => {
  const ctx = fakeCtx();
  ctx.saved = { settings: { track: 6 } };
  assert.equal(new Big(ctx).settings.track, 0);
});

test("a kart at the big field's edge is held by the big field", () => {
  const { ctx, game } = racingOn(Big, { track: 1 });
  const k = game.karts[0];
  const here = locate(game.track, 120, 36);
  Object.assign(k, { x: 120, y: 36, angle: 0, speed: 8, gas: true, progress: here.s, seg: Math.round(here.s * game.track.line.length) % game.track.line.length });
  for (let n = 0; n < 120; n++) ctx.advance(17);
  assert.ok(k.x <= 128 && k.x > 32, String(k.x));
});

test('Kart Race keeps its six tracks', () => {
  const game = new KartRace(fakeCtx());
  assert.equal(game.tracks, TRACKS);
  game.start();
  assert.equal(game.hostView().trackNames.length, 6);
});
