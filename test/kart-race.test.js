import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KartRace, TRACKS, FIELD, TRACK_WIDTH, KART, TIMING, buildTrack, locate, pointAt } from '../server/games/kart-race.js';
import { fakeCtx } from './helpers.js';

const TICK = 1000 / 60;

/** Put a kart somewhere (as if it had driven there: its progress along the lap matches). */
function place(game, k, x, y) {
  Object.assign(k, { x, y, progress: locate(game.track, x, y).s });
}

/** Drive a kart along the centre line to progress p, a small step per tick (no shortcut). */
function driveTo(ctx, game, k, p, dir = 1) {
  let at = k.progress;
  for (let n = 0; n < 200; n++) {
    const left = (((p - at) * dir) % 1 + 1) % 1;
    if (left < 0.015) break;
    at = (at + dir * 0.012 + 1) % 1;
    const pt = pointAt(game.track, at);
    Object.assign(k, { x: pt.x, y: pt.y, speed: 0 });
    ctx.advance(TICK);
  }
  const pt = pointAt(game.track, p);
  Object.assign(k, { x: pt.x, y: pt.y, speed: 0 });
  ctx.advance(TICK);
}

/** A race on a given track (1-based, as in the settings), past the countdown. */
function racing({ track = 1, laps = 3, races = 1 } = {}) {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  for (const [key, value] of Object.entries({ track, laps, races })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.phase, 'race');
  return { ctx, game };
}

/** Steer a kart along its own lane of the track, like a (careful) player. */
function autopilot(game, slot) {
  const k = game.karts[slot];
  const where = locate(game.track, k.x, k.y);
  const target = pointAt(game.track, where.s + 0.03, slot === 0 ? -0.8 : 0.8);
  let d = Math.atan2(target.y - k.y, target.x - k.x) - k.angle;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const ahead = pointAt(game.track, where.s + 0.08);
  const bend = Math.atan2(Math.sin(ahead.angle - k.angle), Math.cos(ahead.angle - k.angle));
  game.onInput(slot, { type: 'drive', steer: Math.max(-1, Math.min(1, d * 3)), brake: Math.abs(bend) > 0.6 && k.speed > 4.5 });
}

test('every track is a clean loop: it never overlaps itself and stays on the field', () => {
  for (let t = 0; t < TRACKS.length; t++) {
    const tr = buildTrack(t);
    const L = tr.line;
    for (let i = 0; i < L.length; i++) {
      const [x, y] = L[i];
      assert.ok(x > TRACK_WIDTH / 2 && y > TRACK_WIDTH / 2 && x < FIELD.w - TRACK_WIDTH / 2 && y < FIELD.h - TRACK_WIDTH / 2, `${tr.name} on the field`);
      for (let j = 0; j < L.length; j++) {
        const along = Math.min(Math.abs(tr.cum[i] - tr.cum[j]), tr.length - Math.abs(tr.cum[i] - tr.cum[j]));
        if (along < TRACK_WIDTH * 2.5) continue;
        assert.ok(Math.hypot(x - L[j][0], y - L[j][1]) > TRACK_WIDTH + 0.5, `${tr.name}: the track doesn't touch itself`);
      }
    }
    // Progress runs 0 -> 1 around the lap.
    assert.ok(Math.abs(locate(tr, ...Object.values(pointAt(tr, 0.3)).slice(0, 2)).s - 0.3) < 0.01);
  }
});

test('a careful driver completes the race on every track; laps and the winner are counted', () => {
  for (let t = 1; t <= TRACKS.length; t++) {
    const { ctx, game } = racing({ track: t, laps: 3 });
    for (let i = 0; i < 60 * 120 && game.phase === 'race'; i++) {
      autopilot(game, 0);
      autopilot(game, 1);
      ctx.advance(TICK);
    }
    assert.equal(game.phase, 'finish', TRACKS[t - 1].name);
    const w = game.result.winner;
    assert.equal(game.karts[w].laps, 3);
    assert.ok(game.result.time > 8000 && game.result.time < 75000, `${TRACKS[t - 1].name}: ${game.result.time} ms`);
    assert.deepEqual(game.hostView().positions[w], 1);
    assert.equal(game.events.cuts, 0, 'fair driving (even running wide on the grass) is never a shortcut');
    ctx.advance(TIMING.finishMs + 100);
    assert.equal(game.phase, 'over', 'one race: that was the match');
    assert.equal(game.winner, w);
    assert.equal(ctx.pendingTimers(), 0);
  }
});

test('no shortcuts: driving backwards over the line takes a lap away, and laps need the halfway point', () => {
  const { ctx, game } = racing({ laps: 3 });
  const k = game.karts[0];
  // Reverse over the start line and forwards again: no lap.
  driveTo(ctx, game, k, 0.97, -1);
  driveTo(ctx, game, k, 0.03);
  assert.equal(k.laps, 0, 'never reached halfway');
  // Halfway, then over the line: a lap.
  driveTo(ctx, game, k, 0.5);
  driveTo(ctx, game, k, 0.9);
  driveTo(ctx, game, k, 0.02);
  assert.equal(k.laps, 1);
  // Back over the line: taken away again.
  driveTo(ctx, game, k, 0.95, -1);
  assert.equal(k.laps, 0);
});

test('grass slows you down, boost pads speed you up, karts bump apart', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  // a: straight off into the grass (well away from the track).
  place(game, a, 16, 9);
  Object.assign(a, { angle: 0, speed: KART.maxSpeed });
  ctx.advance(1500);
  assert.ok(a.offTrack);
  assert.ok(a.speed <= KART.grassSpeed + 0.01, `grass speed ${a.speed}`);
  // b: onto a boost pad.
  const pad = game.hostView().track.boosts[0];
  place(game, b, pad.x, pad.y);
  b.speed = 4;
  ctx.advance(TICK * 2);
  assert.ok(b.speed > KART.maxSpeed, 'boosted');
  assert.equal(game.hostView().karts[1].boosting, true);
  // Overlapping karts get pushed apart.
  Object.assign(a, { x: 10, y: 10, speed: 0 });
  Object.assign(b, { x: 10.3, y: 10, speed: 0 });
  ctx.advance(TICK);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= KART.r * 2 - 1e-9);
  assert.ok(game.events.bumps > 0);
});

test('steering, braking and bad input', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  ctx.advance(1000);
  const fast = k.speed;
  assert.ok(fast > 4, 'karts accelerate on their own');
  const heading = k.angle;
  game.onInput(0, { type: 'drive', steer: 1, brake: false });
  ctx.advance(300);
  assert.ok(k.angle > heading + 0.3, 'turning right');
  game.onInput(0, { type: 'drive', steer: 0, brake: true });
  ctx.advance(400);
  assert.ok(k.speed < fast - 3, 'braking');
  game.onInput(0, { type: 'drive', steer: 'left', brake: 0 });
  assert.equal(k.steer, 0);
  game.onInput(0, { type: 'drive', steer: 99 });
  assert.equal(k.steer, 1);
});

test('setup: track, laps and races; best of 3 is first to 2; Mixed varies the track', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0.5);
  game.start();
  assert.equal(game.hostView().phase, 'setup');
  assert.deepEqual(game.settings, { track: 0, laps: 5, races: 1 });
  game.onInput(1, { type: 'setting', key: 'races', value: 3 });
  game.onInput(1, { type: 'setting', key: 'laps', value: 4 }); // not a choice
  assert.deepEqual(ctx.saved.settings, { track: 0, laps: 5, races: 3 });
  game.onInput(0, { type: 'go' });
  assert.equal(game.hostView().winScore, 2);
  const tracks = [game.track.index];
  for (let r = 0; r < 2; r++) {
    ctx.advance(TIMING.countdownMs + 50); // lights out
    game.finishLine(1, ctx.now()); // (as if kart 2 just crossed the line on its last lap)
    ctx.advance(TIMING.finishMs + 100);
    if (game.phase !== 'over') tracks.push(game.track.index);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.deepEqual(game.scores, [0, 2]);
  assert.notEqual(tracks[0], tracks[1], 'a different track for the next race');
});

test('no cutting across the grass: a jump ahead puts the kart back where it left the road', () => {
  const hairpins = TRACKS.findIndex((t) => t.name === 'Hairpins') + 1;
  const { ctx, game } = racing({ track: hairpins });
  const k = game.karts[0];
  // Drive a little way along the first straight...
  for (let i = 0; i < 60; i++) ctx.advance(TICK);
  const before = k.progress;
  assert.ok(before > 0.01 && before < 0.1);
  // ...then hop across the grass onto the next straight (the far side of the first hairpin).
  const across = pointAt(game.track, before + 0.2);
  Object.assign(k, { x: across.x, y: across.y });
  ctx.advance(TICK);
  assert.ok(Math.abs(k.progress - before) < 0.01, 'progress kept from before the cut');
  const back = pointAt(game.track, before);
  assert.ok(Math.hypot(k.x - back.x, k.y - back.y) < 0.6, 'back on the road');
  assert.equal(game.events.cuts, 1);
  assert.equal(game.hostView().karts[0].cut, true);
  // Normal driving never trips it (the autopilot test drives every track at full speed).
});
