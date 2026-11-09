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

// ---- Kart Race 3D's five big tracks ----

import { TRACKS_3D } from '../server/games/kart-tracks-3d.js';
import kartRace3dDef, { KartRace3D } from '../server/games/kart-race-3d.js';
import { kartRaceBot } from '../server/games/kart-race-bot.js';
import { GRID } from '../server/games/kart-race.js';

const NAMES_3D = ['Sunset Canyon Rally', 'Speedway Oval', 'Grand Prix Circuit', 'Serpent Pass', 'Zigzag Ridge'];

/** Do segments p1-p2 and q1-q2 cross? */
function crosses(p1, p2, q1, q2) {
  const side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return side(p1, p2, q1) * side(p1, p2, q2) < 0 && side(q1, q2, p1) * side(q1, q2, p2) < 0;
}

test('Kart Race 3D lists the five big tracks; Kart Race keeps its six', () => {
  assert.deepEqual(TRACKS_3D.map((t) => t.name), NAMES_3D);
  const game = kartRace3dDef.create(fakeCtx());
  game.start();
  assert.deepEqual(game.hostView().trackNames, NAMES_3D);
  assert.deepEqual(game.options.track, [0, 1, 2, 3, 4, 5]);
  assert.equal(new KartRace(fakeCtx()).tracks.length, 6);
});

TRACKS_3D.forEach((def, i) => {
  const t = buildTrack(i, TRACKS_3D);
  const L = t.line;
  const n = L.length;

  test(`${def.name}: a big track (road 7, field 128 x 72)`, () => {
    assert.equal(t.width, 7);
    assert.deepEqual(t.field, { w: 128, h: 72 });
  });

  test(`${def.name}: a clean loop on its field`, () => {
    const margin = t.width / 2 + t.out + 1;
    for (const [x, y] of L) assert.ok(x >= margin && x <= t.field.w - margin && y >= margin && y <= t.field.h - margin, `${x.toFixed(1)},${y.toFixed(1)} too near the edge`);
    for (let a = 0; a < n; a += 2) {
      for (let b = a + 20; b < n; b += 2) {
        if (n - (b - a) < 20) continue;
        assert.ok(!crosses(L[a], L[(a + 2) % n], L[b], L[(b + 2) % n]), `crosses itself at samples ${a} and ${b}`);
      }
    }
    assert.ok(Road.tightest(L).r >= Road.MIN_RADIUS);
  });

  test(`${def.name}: no bend tighter than half the road (its inside edge would fold over)`, () => {
    assert.ok(Road.tightest(L).r >= t.width / 2, `r ${Road.tightest(L).r.toFixed(2)}`);
  });

  test(`${def.name}: boxes, coins and boost pads on the road`, () => {
    const spots = [];
    for (const p of t.rows) for (const off of t.boxOffsets) spots.push(pointAt(t, p, off));
    for (const [p, off] of t.coins) spots.push(pointAt(t, p, off));
    for (const [p, off] of t.boosts) spots.push(pointAt(t, p, off));
    for (const s of spots) assert.ok(locate(t, s.x, s.y).d <= t.width / 2 + 1e-6, 'off the road');
    assert.ok(t.coins.length >= 40, `${t.coins.length} coins`);
    assert.ok(t.rows.length >= 3, `${t.rows.length} rows of boxes`);
  });

  test(`${def.name}: an 8-kart grid fits on the road at the start`, () => {
    const rows = 4;
    const spots = [];
    for (let j = 0; j < 8; j++) {
      const p = 0.012 + ((rows - 1 - Math.floor(j / 2)) * GRID.rowGap) / t.length;
      spots.push(pointAt(t, p, j % 2 ? GRID.side : -GRID.side));
    }
    for (const s of spots) assert.ok(locate(t, s.x, s.y).d <= t.width / 2, 'grid spot off the road');
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) assert.ok(Math.hypot(spots[a].x - spots[b].x, spots[a].y - spots[b].y) >= 1.4, 'grid spots too close');
  });

  test(`${def.name}: a Normal driver laps in 40-60 s`, () => {
    const ctx = fakeCtx();
    const game = new KartRace3D(ctx, () => 0.5);
    game.start();
    for (const [key, value] of Object.entries({ track: i + 1, laps: 3, items: 0 })) game.onInput(0, { type: 'setting', key, value });
    game.onInput(0, { type: 'go' });
    game.onInput(1, { type: 'go' });
    ctx.advance(TIMING.countdownMs + 50);
    assert.equal(game.track.name, def.name);
    const memory = [{}, {}];
    for (let ms = 0; ms < 120000 && game.karts[0].bestLap === null; ms += 17) {
      for (const slot of [0, 1]) {
        const move = kartRaceBot(game.botView(slot), 'normal', () => 0.5, 0, memory[slot]);
        if (move && move.type === 'drive') game.onInput(slot, { type: 'drive', steer: move.steer, gas: move.gas, brake: move.brake, drift: move.drift });
      }
      ctx.advance(17);
    }
    const lap = game.karts[0].bestLap;
    assert.ok(lap !== null && lap >= 40000 && lap <= 60000, `lap ${lap}`);
  });
});

test('a 4-race cup in Kart Race 3D uses five different tracks', () => {
  const ctx = fakeCtx();
  const game = kartRace3dDef.create(ctx);
  game.start();
  game.onInput(0, { type: 'setting', key: 'races', value: 4 });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  const seen = [];
  // Player 1 wins races 1 and 3, player 2 races 2 and 4: 2-2, then a sudden death.
  for (const winner of [0, 1, 0, 1, 0]) {
    ctx.advance(TIMING.countdownMs + 50);
    seen.push(game.track.name);
    game.finishLine(winner, ctx.now());
    ctx.advance(TIMING.finishMs + 100);
    if (game.phase === 'standings') {
      game.onInput(0, { type: 'go' });
      game.onInput(1, { type: 'go' });
    }
  }
  assert.equal(game.phase, 'over');
  assert.equal(new Set(seen).size, 5, seen.join(', '));
});

test("the setup view sends each track's own field and road width, for the previews", () => {
  const game = kartRace3dDef.create(fakeCtx());
  game.start();
  const v = game.hostView();
  assert.equal(v.trackSizes.length, 5);
  for (const s of v.trackSizes) assert.deepEqual(s, { field: { w: 128, h: 72 }, width: 7 });
  const two = new KartRace(fakeCtx());
  two.start();
  assert.deepEqual(two.hostView().trackSizes[0], { field: { w: 32, h: 18 }, width: 3.4 });
});

test("Kart Race 3D's tagline speaks of its own big tracks", () => {
  assert.match(kartRace3dDef.tagline, /big tracks/i);
  assert.doesNotMatch(kartRace3dDef.tagline, /Same racers, tracks/);
});

test("Sunset Canyon's view carries its canyon scenery", () => {
  const { game } = racingOn(KartRace3D, { track: 1 }); // (setting 0 is Mixed; n is track n - 1)
  assert.equal(game.track.name, 'Sunset Canyon Rally');
  assert.deepEqual(game.hostView().track.scenery, { kind: 'canyon', arches: [0.396, 0.85] });
});

test('other big tracks have no scenery', () => {
  const { game } = racingOn(KartRace3D, { track: 2 });
  assert.equal(game.track.name, 'Speedway Oval');
  assert.equal(game.hostView().track.scenery, null);
});

test("the 2D game's tracks have no scenery", () => {
  const { game } = racingOn(KartRace, { track: 1 });
  assert.equal(game.hostView().track.scenery, null);
});

test('a battle arena has no scenery', () => {
  const { game } = racingOn(KartRace3D, { mode: 1 });
  assert.ok(game.battle);
  assert.equal(game.hostView().track.scenery, null);
});
