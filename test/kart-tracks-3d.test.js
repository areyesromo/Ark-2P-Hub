// Kart Race 3D's big tracks, and what makes a track's size its own (road samples, width, field,
// item rows, coins), while the 2D Kart Race keeps its small tracks exactly as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { TRACKS, ARENAS, buildTrack, buildArena, coinSpots, CUT_JUMP, pointAt, locate } from '../server/games/kart-race.js';
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
