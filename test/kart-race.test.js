import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KartRace, TRACKS, FIELD, TRACK_WIDTH, KART, WALL, TIMING, ITEMS, buildTrack, locate, pointAt } from '../server/games/kart-race.js';
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

/** Put kart k on the road at progress p, in the middle, facing along it. */
function onRoad(game, k, p = 0.05, speed = 0) {
  const pt = pointAt(game.track, p);
  Object.assign(k, { x: pt.x, y: pt.y, angle: pt.angle, speed, progress: p });
}

/** A race on a given track (1-based, as in the settings), past the countdown. */
function racing({ track = 1, laps = 3, races = 1, items = 1 } = {}) {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  for (const [key, value] of Object.entries({ track, laps, races, items })) game.onInput(0, { type: 'setting', key, value });
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
  const brake = Math.abs(bend) > 0.6 && k.speed > 4.5;
  game.onInput(slot, { type: 'drive', steer: Math.max(-1, Math.min(1, d * 3)), gas: !brake, brake });
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
  assert.equal(k.lapStart, 0, 'back on lap 1: its clock runs from the start again (no fake best lap)');
});

test('controls held into the next race stay held; boost pads only push karts going forwards', () => {
  const { ctx, game } = racing({ races: 3 });
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  game.newRace();
  assert.equal(game.karts[0].gas, true, 'GAS still held: no need to lift and press again');
  ctx.advance(TIMING.countdownMs + 50);
  const k = game.karts[0];
  const pad = game.hostView().track.boosts[0];
  game.onInput(0, { type: 'drive', steer: 0 });
  place(game, k, pad.x, pad.y);
  k.speed = -2;
  ctx.advance(TICK);
  assert.ok(k.speed < 0, 'reversing over a pad');
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
  onRoad(game, a, 0.3);
  Object.assign(b, { x: a.x + 0.3, y: a.y, speed: 0, progress: a.progress });
  ctx.advance(TICK);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= KART.r * 2 - 1e-9);
  assert.ok(game.events.bumps > 0);
});

test('gas, coasting, steering, braking, reverse and bad input', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  ctx.advance(1000);
  assert.equal(k.speed, 0, 'no gas, no go');
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(1000);
  const fast = k.speed;
  assert.ok(fast > 6, `holding gas accelerates (${fast})`);
  onRoad(game, k, 0.05, fast);
  game.onInput(0, { type: 'drive', steer: 0 });
  ctx.advance(400);
  assert.ok(k.speed < fast && k.speed > fast - 2, `let go: it coasts, slowing gently (${fast} -> ${k.speed})`);
  const heading = k.angle;
  game.onInput(0, { type: 'drive', steer: 1, gas: true });
  ctx.advance(300);
  assert.ok(k.angle > heading + 0.3, 'turning right');
  game.onInput(0, { type: 'drive', steer: 0, brake: true });
  ctx.advance(300);
  assert.ok(k.speed < fast - 3, 'braking');
  ctx.advance(1500);
  assert.ok(k.speed < -1, `keep braking once stopped: reverse (${k.speed})`);
  assert.ok(k.speed >= -KART.reverseSpeed);
  // Reversing and steering turns the other way, like a car.
  const back = k.angle;
  game.onInput(0, { type: 'drive', steer: 1, brake: true });
  ctx.advance(200);
  assert.ok(k.angle < back, 'reversing with right lock swings the nose left');
  // Gas while reversing stops first, then drives on.
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(800);
  assert.ok(k.speed > 0);
  // Even crawling off the mark, the kart can turn (it used to need speed to steer).
  Object.assign(k, { speed: 0.4 });
  const slow = k.angle;
  game.onInput(0, { type: 'drive', steer: 1, gas: true });
  ctx.advance(200);
  assert.ok(k.angle - slow > 0.1, 'turns at a crawl');
  game.onInput(0, { type: 'drive', steer: 'left', brake: 0, gas: 'yes' });
  assert.equal(k.steer, 0);
  game.onInput(0, { type: 'drive', steer: 99 });
  assert.equal(k.steer, 1);
  assert.equal(k.gas, false);
});

test('walls: a glancing hit slides along; head-on bounces back; never stuck', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  const limit = TRACK_WIDTH / 2 + WALL.out - KART.r;
  // Head-on into the outside wall at full speed.
  const p = pointAt(game.track, 0.1);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle); // to the right of the road
  place(game, k, p.x + nx * (limit - 0.3), p.y + ny * (limit - 0.3));
  Object.assign(k, { angle: Math.atan2(ny, nx), speed: KART.maxSpeed });
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(TICK * 4);
  assert.ok(game.events.walls > 0);
  assert.ok(k.speed < 0, 'bounced back off the wall');
  assert.ok(locate(game.track, k.x, k.y).d <= limit + 1e-6, 'kept inside the wall');
  // Hold gas into the wall and steer: it turns away and drives off within a second.
  game.onInput(0, { type: 'drive', steer: 1, gas: true });
  ctx.advance(1000);
  assert.ok(k.speed > 2, `driving away (${k.speed})`);
  // A glancing hit (heading 20° into the wall) keeps most of the speed, turned along it.
  place(game, k, p.x + nx * (limit - 0.15), p.y + ny * (limit - 0.15));
  Object.assign(k, { angle: p.angle + 0.35, speed: KART.maxSpeed });
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(TICK * 3);
  assert.ok(k.speed > KART.maxSpeed * 0.6, `slid on (${k.speed})`);
});

test('drift: tighter turns; a long enough drift gives a mini-boost on release', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  onRoad(game, k, 0.05, KART.maxSpeed);
  game.onInput(0, { type: 'drive', steer: 1, gas: true, drift: true });
  ctx.advance(TICK * 3);
  assert.equal(game.hostView().karts[0].drifting, true);
  // Keep it on the road while it drifts (a test can't steer a racing line).
  for (let t = 0; t < KART.driftChargeMs + 50; t += 100) {
    const { angle, speed } = k;
    onRoad(game, k, 0.05, speed);
    k.angle = angle;
    ctx.advance(100);
  }
  assert.equal(game.hostView().karts[0].driftCharge, 1);
  game.onInput(0, { type: 'drive', steer: 0, gas: true, drift: false });
  ctx.advance(TICK * 2);
  assert.ok(game.hostView().karts[0].boosting, 'mini-boost');
  assert.equal(game.events.miniBoosts, 1);
  // Too slow to drift: nothing happens.
  Object.assign(k, { speed: 2, boostUntil: 0 });
  game.onInput(0, { type: 'drive', steer: 1, gas: false, drift: true });
  ctx.advance(TICK * 2);
  assert.equal(game.hostView().karts[0].drifting, false);
});

test('setup: track, laps and races; best of 3 is first to 2; Mixed varies the track', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0.5);
  game.start();
  assert.equal(game.hostView().phase, 'setup');
  assert.deepEqual(game.settings, { track: 0, laps: 5, races: 1, items: 1 });
  game.onInput(1, { type: 'setting', key: 'races', value: 3 });
  game.onInput(1, { type: 'setting', key: 'laps', value: 4 }); // not a choice
  assert.deepEqual(ctx.saved.settings, { track: 0, laps: 5, races: 3, items: 1 });
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

test('items: drive through a ? box to get one; it comes back later; one item at a time', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  const box = game.boxes[1];
  assert.equal(game.boxes.length, ITEMS.rows.length * ITEMS.offsets.length);
  place(game, k, box.x, box.y);
  k.speed = 0;
  ctx.advance(TICK);
  assert.ok(ITEMS.kinds.includes(k.item), `got ${k.item}`);
  assert.equal(game.hostView().boxes.length, game.boxes.length - 1, 'the box is gone for now');
  const held = k.item;
  const other = game.boxes[0];
  place(game, k, other.x, other.y);
  ctx.advance(TICK);
  assert.equal(k.item, held, 'still the same item');
  assert.equal(game.hostView().boxes.length, game.boxes.length - 1, "the other box wasn't used up");
  ctx.advance(ITEMS.respawnMs);
  assert.equal(game.hostView().boxes.length, game.boxes.length, 'back again');
});

test('items: turbo boosts; a banana spins out whoever hits it (not you, just after dropping it); a shield blocks it', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  ctx.advance(1000);
  // Turbo.
  a.item = 'turbo';
  game.onInput(0, { type: 'item' });
  assert.equal(a.item, null);
  assert.ok(a.speed >= KART.boostSpeed && game.hostView().karts[0].boosting);
  // Banana: dropped behind a, which drives on safely.
  a.item = 'banana';
  game.onInput(0, { type: 'item' });
  assert.equal(game.bananas.length, 1);
  const banana = game.bananas[0];
  ctx.advance(TICK * 3);
  assert.equal(game.hostView().karts[0].spin, false);
  // b drives into it.
  place(game, b, banana.x, banana.y);
  b.speed = 6;
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, true);
  assert.equal(game.bananas.length, 0, 'used up');
  ctx.advance(600);
  assert.ok(b.speed < 2, 'spun out');
  game.onInput(1, { type: 'drive', steer: 1 });
  const angle = b.angle;
  ctx.advance(200);
  assert.equal(b.angle, angle, 'no steering while spinning');
  // Shield: a fresh banana is blocked.
  ctx.advance(ITEMS.spinMs);
  b.item = 'shield';
  game.onInput(1, { type: 'item' });
  game.bananas.push({ x: b.x, y: b.y, owner: 0, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, false);
  assert.equal(game.events.blocked, 1);
  assert.equal(game.hostView().karts[1].shield, true);
  // Using nothing does nothing.
  game.onInput(1, { type: 'item' });
  assert.equal(game.events.used, 3);
});

test('items: the kart behind gets more turbos; items off means no boxes', () => {
  const { game } = racing();
  game.karts[0].laps = 1; // kart 1 leads
  const count = (slot) => {
    const n = { banana: 0, turbo: 0, shield: 0 };
    for (let i = 0; i < 600; i++) {
      game.rng = () => (i + 0.5) / 600;
      n[game.rollItem(slot)]++;
    }
    return n;
  };
  const leader = count(0);
  const chaser = count(1);
  assert.ok(chaser.turbo > leader.turbo * 2, JSON.stringify({ leader, chaser }));
  assert.ok(leader.banana > chaser.banana);
  const off = racing({ items: 0 }).game;
  assert.equal(off.boxes.length, 0);
  assert.equal(off.hostView().boxes.length, 0);
});

/** A one-race game on track 1 with these racer / tyre picks, past the countdown. */
function picked(picks) {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'setting', key: 'track', value: 1 });
  picks.forEach(([racer, tyre], slot) => {
    if (racer) game.onInput(slot, { type: 'racer', id: racer });
    if (tyre) game.onInput(slot, { type: 'tyre', id: tyre });
  });
  game.onInput(0, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

test('racer and tyre picks: own slot, setup/over only, bad ids ignored, kept across rematch', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  assert.deepEqual(game.picks, [{ racer: 'dash', tyre: 'standard' }, { racer: 'daisy', tyre: 'standard' }]);
  game.onInput(1, { type: 'racer', id: 'rex' });
  game.onInput(1, { type: 'tyre', id: 'slicks' });
  game.onInput(1, { type: 'racer', id: 'nope' });
  game.onInput(1, { type: 'tyre', id: 42 });
  assert.deepEqual(game.picks, [{ racer: 'dash', tyre: 'standard' }, { racer: 'rex', tyre: 'slicks' }]);
  game.onInput(0, { type: 'racer', id: 'rex' });
  assert.equal(game.picks[0].racer, 'rex', 'both may race as the same racer');
  assert.deepEqual(game.hostView().picks, game.picks);
  game.onInput(0, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.ok(Math.abs(game.karts[1].car.maxSpeed - 9.85) < 1e-9, 'Rex on Slicks: speed 6');
  assert.equal(game.hostView().karts[1].racer, 'rex');
  assert.equal(game.hostView().karts[1].tyre, 'slicks');
  assert.ok(Math.abs(game.hostView().karts[1].top - 9.85) < 1e-9, "each kart's own top speed, for its speedometer");
  game.onInput(1, { type: 'racer', id: 'zip' });
  assert.equal(game.picks[1].racer, 'rex', 'no changing racer mid-race');
  game.finishLine(1, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'over');
  game.onInput(1, { type: 'racer', id: 'zip' });
  assert.equal(game.picks[1].racer, 'zip', 'the end screen can change it');
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.picks[0].racer, 'rex', 'picks kept for the rematch');
  assert.ok(Math.abs(game.karts[1].car.accel - 11.5) < 1e-9, 'rebuilt from the new pick (Zip: acceleration 5)');
  assert.equal(game.karts[1].racer, 'zip');
  game.onInput(0, { type: 'setup' });
  assert.equal(game.picks[1].racer, 'zip', 'and kept back at the setup screen');
});

test('racers drive differently: top speed, acceleration, turning', () => {
  const { ctx, game } = picked([['rex'], ['zip']]);
  const [rex, zip] = game.karts;
  // Acceleration: from a standstill, half a second of gas.
  onRoad(game, rex, 0.05);
  onRoad(game, zip, 0.55);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  ctx.advance(500);
  assert.ok(zip.speed > rex.speed + 0.5, `Zip gets going quicker (${zip.speed} vs ${rex.speed})`);
  // Top speed: hold it (back on the straight each time so nothing slows them).
  for (let i = 0; i < 30; i++) {
    onRoad(game, rex, 0.05, rex.speed);
    onRoad(game, zip, 0.55, zip.speed);
    ctx.advance(100); // short hops: never far enough to reach a bend
  }
  assert.ok(Math.abs(rex.speed - 9.4) < 0.05, `Rex tops out at 9.4 (${rex.speed})`);
  assert.ok(Math.abs(zip.speed - 8.05) < 0.05, `Zip tops out at 8.05 (${zip.speed})`);
});

test('handling: Swift turns further than Boulder', () => {
  const { ctx, game } = picked([['swift'], ['boulder']]);
  const [swift, boulder] = game.karts;
  onRoad(game, swift, 0.05, 4);
  onRoad(game, boulder, 0.55, 4);
  const a0 = swift.angle;
  const b0 = boulder.angle;
  game.onInput(0, { type: 'drive', steer: 1, gas: true });
  game.onInput(1, { type: 'drive', steer: 1, gas: true });
  ctx.advance(300);
  assert.ok(swift.angle - a0 > boulder.angle - b0 + 0.05, `${swift.angle - a0} vs ${boulder.angle - b0}`);
});

test('heavier karts win bumps', () => {
  const { ctx, game } = picked([['bella'], ['ruby']]);
  const [bella, ruby] = game.karts;
  onRoad(game, bella, 0.3);
  Object.assign(ruby, { x: bella.x + 0.3, y: bella.y, speed: 0, angle: bella.angle, progress: bella.progress });
  const b0 = { x: bella.x, y: bella.y };
  const r0 = { x: ruby.x, y: ruby.y };
  ctx.advance(TICK);
  const moved = (k, p) => Math.hypot(k.x - p.x, k.y - p.y);
  assert.ok(moved(ruby, r0) > moved(bella, b0) * 2, `Ruby ${moved(ruby, r0)} vs Bella ${moved(bella, b0)}`);
});
