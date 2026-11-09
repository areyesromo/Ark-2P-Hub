// Kart Race 3D's 8-kart Cup: the two players and six computer racers, five races on the big tracks,
// points for every place, the leader starting at the back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { TIMING } from '../server/games/kart-race.js';
import { KartRace3D, CUP_POINTS } from '../server/games/kart-race-3d.js';
import { fakeCtx } from './helpers.js';

/** Setup with `settings` (an 8-kart Cup by default), both ready, lights out. */
function cup(settings = {}) {
  const ctx = fakeCtx();
  const game = new KartRace3D(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries({ field: 1, cpu: 'normal', ...settings })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

/** End the current race with these places (by kart index), then on to the next (both ready). */
function endWith(ctx, game, places) {
  assert.equal(game.phase, 'race');
  game.result = { winner: places[0] < places[1] ? 0 : 1, time: 60000 };
  places.forEach((rank, i) => { game.karts[i].finishedAt = rank; });
  game.endRace();
  if (game.phase === 'standings') {
    game.onInput(0, { type: 'go' });
    game.onInput(1, { type: 'go' });
    ctx.advance(TIMING.countdownMs + 50);
  }
}

test('an 8-kart Cup: the players and six computers neither picked', () => {
  const { game } = cup();
  assert.equal(game.karts.length, 8);
  game.karts.slice(2).forEach((k) => assert.equal(k.cpu.level, 'normal'));
  assert.equal(new Set(game.karts.map((k) => k.racer)).size, 8);
  for (const k of game.karts.slice(2)) assert.ok(k.racer !== game.picks[0].racer && k.racer !== game.picks[1].racer);
  const v = game.hostView();
  assert.ok(v.karts[2].cpu && typeof v.karts[2].name === 'string' && v.karts[2].name.length > 0);
  assert.equal(v.karts[0].cpu, false);
  assert.deepEqual(v.cupPoints, [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('race 1 grid: computers in front, the players at the back', () => {
  const { game } = cup();
  assert.deepEqual(game.gridOrder(8), [2, 3, 4, 5, 6, 7, 0, 1]);
});

test('points for every place, and the leader starts at the back', () => {
  const { ctx, game } = cup();
  assert.deepEqual(CUP_POINTS, [10, 8, 6, 5, 4, 3, 2, 1]);
  endWith(ctx, game, [3, 5, 1, 2, 4, 6, 7, 8]);
  assert.deepEqual(game.points, [6, 4, 10, 8, 5, 3, 2, 1]);
  assert.deepEqual(game.scores, [6, 4]);
  assert.equal(game.race, 2);
  assert.deepEqual(game.gridOrder(8), [7, 6, 5, 1, 4, 0, 3, 2]);
  const last = game.history[game.history.length - 1];
  assert.deepEqual(last.places, [3, 5, 1, 2, 4, 6, 7, 8]);
});

test('five races on five different tracks, then the player with more points wins', () => {
  const { ctx, game } = cup();
  const tracks = [];
  for (let r = 0; r < 5; r++) {
    tracks.push(game.track.name);
    endWith(ctx, game, [2, 4, 1, 3, 5, 6, 7, 8]);
  }
  assert.equal(new Set(tracks).size, 5, tracks.join(', '));
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.scores, [40, 25]);
  assert.equal(game.winner, 0);
  const v = game.hostView();
  assert.equal(v.cup, true);
  assert.deepEqual(v.scores, [40, 25]);
});

test('a points tie between the players goes to the better place in the last race', () => {
  const { ctx, game } = cup();
  // Player 1 3rd and player 2 4th four times (24 to 20), then player 2 2nd and player 1 5th: 28 each.
  for (let r = 0; r < 4; r++) endWith(ctx, game, [3, 4, 1, 2, 5, 6, 7, 8]);
  endWith(ctx, game, [5, 2, 1, 3, 4, 6, 7, 8]);
  assert.deepEqual(game.scores, [28, 28]);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test("a cup's settings don't let a battle or a 4-track cup in", () => {
  const { ctx, game } = cup({ mode: 1, races: 4 });
  assert.equal(game.battle, false);
  assert.equal(game.cup, false);
  assert.equal(game.karts.length, 8);
  for (let r = 0; r < 4; r++) endWith(ctx, game, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notEqual(game.phase, 'over', 'five races, not four');
  endWith(ctx, game, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(game.phase, 'over');
});

test('1v1 is untouched', () => {
  const { game } = cup({ field: 0 });
  assert.equal(game.karts.length, 2);
  assert.equal(game.hostView().cupPoints, null);
  assert.equal(game.hostView().karts[0].cpu, false);
});

// ---- edge cases ----

import { kartRaceBot } from '../server/games/kart-race-bot.js';
import { placeAt } from './helpers-kart.js';

test("a dropped player's kart coasts and the cup goes on", () => {
  const { ctx, game } = cup({ laps: 3 });
  ctx.players[1].connected = false;
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'standings');
  assert.ok(game.points[1] >= 1, 'the dropped player still scores their place');
  game.onInput(0, { type: 'go' }); // (the dropped player counts as ready)
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.race, 2);
  assert.equal(game.phase, 'race');
});

test('a rematch starts a fresh cup', () => {
  const { ctx, game } = cup();
  for (let r = 0; r < 5; r++) endWith(ctx, game, [2, 4, 1, 3, 5, 6, 7, 8]);
  assert.equal(game.phase, 'over');
  game.onInput(0, { type: 'rematch' });
  game.onInput(1, { type: 'rematch' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.race, 1);
  assert.deepEqual(game.points, [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(game.gridOrder(8), [2, 3, 4, 5, 6, 7, 0, 1]);
  assert.equal(game.cpuRacers.length, 6);
  assert.equal(game.karts.length, 8);
});

test('switching back to 1v1 on the setup screen', () => {
  const ctx = fakeCtx();
  const game = new KartRace3D(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries({ track: 3, races: 3, field: 1, cpu: 'hard' })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'setting', key: 'field', value: 0 });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.karts.length, 2);
  assert.equal(game.settings.track, 3);
  assert.equal(game.settings.races, 3);
  assert.equal(game.track.name, game.tracks[2].name);
});

test('the seat computer in an 8-kart Cup scores like a player', () => {
  const { ctx, game } = cup({ laps: 3 });
  const memory = {};
  for (let ms = 0; ms < 400000 && game.phase !== 'standings'; ms += 17) {
    const move = kartRaceBot(game.botView(1), 'normal', () => 0.5, 0, memory);
    if (move && move.type === 'drive') game.onInput(1, { type: 'drive', steer: move.steer, gas: move.gas, brake: move.brake, drift: move.drift });
    ctx.advance(17);
  }
  assert.equal(game.phase, 'standings');
  assert.notEqual(game.karts[1].finishedAt, null);
  assert.ok(game.points[1] > 0);
  assert.equal(game.scores[1], game.points[1]);
});

test('a computer stuck against a wall backs out', () => {
  const { ctx, game } = cup({ laps: 3 });
  const k = game.karts[3];
  placeAt(game, 3, 0.4, 3.2); // at the road's right edge…
  k.angle += Math.PI / 2; // …facing the wall
  const from = k.laps + k.progress;
  for (let ms = 0; ms < 10000; ms += 17) ctx.advance(17);
  assert.ok(k.laps + k.progress > from + 10 / game.track.length, 'it got going again');
});
