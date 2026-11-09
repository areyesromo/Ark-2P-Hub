// Kart Race 3D's big tracks, and what makes a track's size its own (road samples, width, field,
// item rows, coins), while the 2D Kart Race keeps its small tracks exactly as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { TRACKS, ARENAS, buildTrack, buildArena } from '../server/games/kart-race.js';

const Road = globalThis.ArkKartTrack;

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
