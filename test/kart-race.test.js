import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KartRace, TRACKS, FIELD, TRACK_WIDTH, KART, WALL, TIMING, ITEMS, COINS, SAMPLES, buildTrack, locate, pointAt } from '../server/games/kart-race.js';
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
  const off = Math.abs(k.seg - Math.round(before * SAMPLES));
  assert.ok(Math.min(off, SAMPLES - off) <= 2, `and on its own stretch again (seg ${k.seg})`);
  assert.equal(game.events.cuts, 1);
  assert.equal(game.hostView().karts[0].cut, true);
  // Normal driving never trips it (the autopilot test drives every track at full speed).
});

test('items: drive through a ? box to get one; it comes back later', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  const box = game.boxes[0];
  assert.equal(game.boxes.length, ITEMS.rows.length * ITEMS.offsets.length);
  place(game, k, box.x, box.y);
  k.speed = 0;
  ctx.advance(TICK);
  assert.equal(k.items.length, 1);
  assert.ok(ITEMS.kinds.includes(k.items[0]), `got ${k.items[0]}`);
  assert.equal(game.hostView().boxes.length, game.boxes.length - 1, 'the box is gone for now');
  assert.deepEqual(game.hostView().karts[0].items, k.items);
  ctx.advance(ITEMS.respawnMs);
  assert.equal(game.hostView().boxes.length, game.boxes.length, 'back again');
});

test('items: turbo boosts; a banana spins out whoever hits it (not you, just after dropping it); a shield blocks it', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  ctx.advance(1000);
  // Turbo.
  a.items = ['turbo'];
  game.onInput(0, { type: 'item' });
  assert.deepEqual(a.items, []);
  assert.ok(a.speed >= KART.boostSpeed && game.hostView().karts[0].boosting);
  // Banana: dropped behind a, which drives on safely.
  a.items = ['banana'];
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
  b.items = ['shield'];
  game.onInput(1, { type: 'item' });
  game.bananas.push({ x: b.x, y: b.y, owner: 0, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, false);
  assert.equal(game.events.blocked, 1);
  assert.equal(game.hostView().karts[1].shield, false, 'one hit and the shield pops');
  // Using nothing does nothing.
  game.onInput(1, { type: 'item' });
  assert.equal(game.events.used, 3);
});

test('items: odds by place; 1st never draws the catch-up items; items off means no boxes', () => {
  const { game } = racing();
  game.karts[0].laps = 1; // kart 1 leads
  const count = (slot) => {
    const n = {};
    for (let i = 0; i < 2000; i++) {
      game.rng = () => (i + 0.5) / 2000;
      const kind = game.rollItem(slot);
      n[kind] = (n[kind] || 0) + 1;
    }
    return n;
  };
  const leader = count(0);
  const chaser = count(1);
  for (const kind of ['star', 'goldturbo', 'thunder', 'freeze', 'swap', 'hover']) {
    assert.ok(!leader[kind], `1st drew ${kind}`);
    assert.ok(chaser[kind] > 0, `2nd never drew ${kind}`);
  }
  assert.ok(leader.banana > (chaser.banana || 0));
  assert.ok(Object.keys(leader).concat(Object.keys(chaser)).every((k) => ITEMS.kinds.includes(k)));
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
  assert.deepEqual(game.picks, [{ racer: 'dash', tyre: 'standard' }, { racer: 'dot', tyre: 'standard' }]);
  game.onInput(0, { type: 'racer', id: 'daisy' });
  assert.equal(game.picks[0].racer, 'dot', 'the old name still picks her');
  game.onInput(0, { type: 'racer', id: 'dash' });
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

/** The way to a track's right (+1) or left (-1) at centre-line sample i (as Road.outline). */
function sideAt(track, i, side) {
  const L = track.line;
  const n = L.length;
  const a = L[(i - 1 + n) % n];
  const b = L[(i + 1) % n];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { x: (-(b[1] - a[1]) / len) * side, y: ((b[0] - a[0]) / len) * side };
}

test('barriers: every road keeps its full width; close stretches share a barrier between them', () => {
  const full = TRACK_WIDTH / 2 + WALL.out;
  let shared = 0;
  TRACKS.forEach((t, i) => {
    const track = buildTrack(i);
    for (const side of ['left', 'right']) {
      const e = track.edge[side];
      assert.equal(e.length, track.line.length);
      e.forEach((d) => {
        assert.ok(d >= TRACK_WIDTH / 2 + 0.3, `${t.name}: barrier at ${d} pinches the road`);
        assert.ok(d <= full + 1e-9);
      });
      if (e.some((d) => d < full - 0.3)) shared++;
    }
  });
  assert.ok(shared >= 3, 'close stretches (Hairpins, Serpent, ...) have a barrier between them');
});

test('stretches of road never run so close that the wrong one could claim a kart', () => {
  // A kart's own stretch is found by searching near where it was; if it's further than this from
  // that, it was moved (a reset) and the whole road is searched. Two different stretches (20+
  // samples apart) must be further apart than that, or a reset could leave it on the wrong one.
  const far = TRACK_WIDTH / 2 + WALL.out + 1;
  TRACKS.forEach((t, ti) => {
    const L = buildTrack(ti).line;
    const n = L.length;
    let min = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 20; j <= i + n - 20; j++) {
        const q = L[j % n];
        min = Math.min(min, Math.hypot(L[i][0] - q[0], L[i][1] - q[1]));
      }
    }
    assert.ok(min > far, `${t.name}: stretches ${min.toFixed(2)} apart (need over ${far})`);
  });
});

test('crashing into the barrier between two stretches bounces you off: never onto the other stretch', () => {
  TRACKS.forEach((t, ti) => {
    const { ctx, game } = racing({ track: ti + 1 });
    const [k, other] = game.karts;
    const track = game.track;
    // The tightest shared barrier on this track (if any): drive straight at it, flat out.
    let best = null;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      track.edge[side].forEach((d, i) => { if (!best || d < best.d) best = { d, i, sign }; });
    }
    if (best.d > TRACK_WIDTH / 2 + WALL.out - 0.3) return; // no stretches close together here
    const c = track.line[best.i];
    const n = sideAt(track, best.i, best.sign);
    const p = best.i / SAMPLES;
    onRoad(game, other, (p + 0.5) % 1); // parked well away, so its walls don't count
    other.seg = Math.round(((p + 0.5) % 1) * SAMPLES) % SAMPLES;
    Object.assign(k, { x: c[0], y: c[1], angle: Math.atan2(n.y, n.x), speed: KART.maxSpeed, progress: p, seg: best.i });
    game.onInput(0, { type: 'drive', steer: 0, gas: true });
    const walls = game.events.walls;
    const cuts = game.events.cuts;
    for (let tick = 0; tick < 90; tick++) {
      ctx.advance(TICK);
      // Every tick, the stretch it's held to is the road it's really nearest (it may slide along
      // the barrier, even round the end of it, but never through it).
      const nearest = locate(track, k.x, k.y).i;
      const gap = Math.abs(nearest - k.seg);
      assert.ok(Math.min(gap, SAMPLES - gap) < 20, `${t.name}: crossed onto another stretch (sample ${nearest}, own ${k.seg})`);
    }
    assert.ok(game.events.walls > walls, `${t.name}: it hit the barrier`);
    assert.equal(game.events.cuts, cuts, `${t.name}: hitting the barrier is not a shortcut`);
  });
});

test('coins: single coins spread round every track, alternating sides, clear of pads, boxes and the start', () => {
  TRACKS.forEach((t, ti) => {
    const track = buildTrack(ti);
    const spots = track.coins; // [progress, offset] for each coin
    assert.ok(spots.length >= 14 && spots.length <= 20, `${t.name}: ${spots.length} coins`);
    const near = (a, b) => Math.abs(((a - b + 1.5) % 1) - 0.5) < 0.035;
    spots.forEach(([p, off], i) => {
      assert.ok(!t.boosts.some(([b]) => near(p, b)), `${t.name}: a coin at ${p} on a boost pad`);
      assert.ok(!ITEMS.rows.some((r) => near(p, r)), `${t.name}: a coin at ${p} on a box row`);
      assert.ok(!near(p, 0), `${t.name}: a coin at ${p} on the start line`);
      assert.ok(Math.abs(off) > 0.5 && Math.abs(off) < TRACK_WIDTH / 2, `${t.name}: off the racing line, on the road`);
      if (i) assert.ok(Math.sign(off) !== Math.sign(spots[i - 1][1]), `${t.name}: sides alternate`);
    });
    // One at a time: no two coins within reach of a kart at once.
    const { game } = racing({ track: ti + 1 });
    assert.equal(game.coins.length, spots.length);
    for (const a of game.coins) {
      for (const b of game.coins) {
        if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 2 * (COINS.r + KART.r), `${t.name}: two coins in one grab`);
      }
      assert.ok(locate(track, a.x, a.y).d < TRACK_WIDTH / 2, `${t.name}: a coin off the road`);
    }
  });
});

test('coins: pick up (max 15), top speed rises, respawn after 8 s, reset each race', () => {
  const { ctx, game } = racing({ races: 3 });
  const [a, b] = game.karts;
  const c = game.coins[0];
  // Both karts on the same coin, same tick: only the first (slot order) takes it.
  Object.assign(a, { x: c.x, y: c.y, speed: 0 });
  Object.assign(b, { x: c.x + 0.05, y: c.y, speed: 0 });
  ctx.advance(TICK);
  assert.deepEqual([a.coins, b.coins], [1, 0], 'one coin, one taker (the first kart)');
  assert.equal(game.hostView().coins.length, game.coins.length - 1, 'gone from the track');
  assert.equal(game.hostView().karts[0].coins, a.coins);
  // Back after 8 s (the karts moved off it, or they'd take it again straight away).
  onRoad(game, a, 0.75);
  onRoad(game, b, 0.75, 0);
  b.x += 1.2;
  ctx.advance(COINS.respawnMs + 50);
  assert.equal(game.hostView().coins.length, game.coins.length);
  // Max 15: a full purse leaves the coin for the other kart.
  b.x = -50;
  Object.assign(a, { coins: COINS.max, x: c.x, y: c.y, speed: 0 });
  ctx.advance(TICK);
  assert.equal(a.coins, COINS.max);
  assert.equal(game.hostView().coins.length, game.coins.length, 'still there');
  // Each coin adds to top speed (Dash: 8.5 + 15 x 0.05).
  onRoad(game, a, 0.05);
  a.coins = COINS.max;
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  for (let i = 0; i < 40; i++) {
    onRoad(game, a, 0.05, a.speed);
    a.coins = COINS.max;
    ctx.advance(100);
  }
  assert.ok(Math.abs(a.speed - (8.5 + COINS.max * COINS.perCoin)) < 0.05, `top speed with 15 coins: ${a.speed}`);
  // The next race: no coins, every coin back.
  game.coins[0].backAt = ctx.now() + 99999;
  game.newRace();
  assert.deepEqual(game.karts.map((k) => k.coins), [0, 0]);
  assert.ok(game.coins.every((x) => x.backAt === 0));
});

test('coins: a spin-out costs 3 (never below 0), a head-on wall hit costs 1', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  game.karts[1].x = -50;
  onRoad(game, k, 0.6);
  k.coins = 5;
  const lost = game.events.coinsLost;
  game.bananas.push({ x: k.x, y: k.y, owner: 1, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(k.coins, 2, 'banana: -3');
  assert.ok(game.events.coinsLost > lost);
  ctx.advance(ITEMS.spinMs + 100);
  game.bananas.push({ x: k.x, y: k.y, owner: 1, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(k.coins, 0, 'never below 0');
  // Head-on into the wall.
  ctx.advance(ITEMS.spinMs + 100);
  k.coins = 4;
  const p = pointAt(game.track, 0.1);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  const limit = TRACK_WIDTH / 2 + WALL.out - KART.r;
  Object.assign(k, { x: p.x + nx * (limit - 0.3), y: p.y + ny * (limit - 0.3), angle: Math.atan2(ny, nx), speed: KART.maxSpeed, progress: 0.1, seg: Math.round(0.1 * SAMPLES) });
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(TICK * 4);
  assert.equal(k.coins, 3, 'head-on wall hit: -1');
});

test('coins: pressing into a wall costs one coin, not the whole purse; finished karts take none', () => {
  const { ctx, game } = racing();
  const [k, other] = game.karts;
  other.x = -50;
  k.coins = 10;
  const p = pointAt(game.track, 0.1);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  const limit = TRACK_WIDTH / 2 + WALL.out - KART.r;
  Object.assign(k, { x: p.x + nx * (limit - 0.3), y: p.y + ny * (limit - 0.3), angle: Math.atan2(ny, nx), speed: KART.maxSpeed, progress: 0.1, seg: Math.round(0.1 * SAMPLES) });
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(1000); // nose against the wall, foot down
  assert.ok(k.coins >= 9, `one hard hit, not a drain (${k.coins} left)`);
  game.onInput(0, { type: 'drive', steer: 0, brake: true });
  ctx.advance(1500); // and reversing back into it
  assert.ok(k.coins >= 8, `reversing into it, then nudging (${k.coins} left)`);
  // The view's red line includes the coin bonus.
  assert.ok(Math.abs(game.hostView().karts[0].top - (8.5 + k.coins * COINS.perCoin)) < 1e-9);
  // Over the line: no more coins (they're left for the kart still racing).
  game.finishLine(0, ctx.now());
  const c = game.coins.find((x) => x.backAt <= ctx.now());
  const had = k.coins;
  Object.assign(k, { x: c.x, y: c.y, speed: 0 });
  ctx.advance(TICK);
  assert.equal(k.coins, had);
});

/** Use kart `slot`'s next item, having given it these. */
function useNow(game, slot, ...items) {
  game.karts[slot].items = items;
  game.onInput(slot, { type: 'item' });
}

test('items: hold up to 3, used oldest first; a double box gives two; a full queue leaves the box', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  game.karts[1].x = -50;
  const double = game.boxes.find((b) => b.double);
  assert.ok(double, 'each row has a double box');
  assert.equal(game.boxes.filter((b) => b.double).length, ITEMS.rows.length);
  assert.equal(game.hostView().boxes.filter((b) => b.double).length, ITEMS.rows.length);
  place(game, k, double.x, double.y);
  k.speed = 0;
  ctx.advance(TICK);
  assert.equal(k.items.length, 2, 'two from a double box');
  // One slot left: a double box gives one, and is spent.
  onRoad(game, k, 0.55); // (off the boxes while they come back)
  ctx.advance(ITEMS.respawnMs + 50);
  k.items = ['turbo', 'shield'];
  place(game, k, double.x, double.y);
  ctx.advance(TICK);
  assert.equal(k.items.length, 3);
  assert.deepEqual(k.items.slice(0, 2), ['turbo', 'shield'], 'new ones join the back');
  // Full: the box stays for the other kart.
  ctx.advance(ITEMS.respawnMs + 50);
  place(game, k, double.x, double.y);
  ctx.advance(TICK);
  assert.equal(k.items.length, ITEMS.maxHeld);
  assert.ok(ctx.now() >= double.backAt, 'still there');
  onRoad(game, k, 0.55);
  // Oldest first.
  k.items = ['turbo', 'shield', 'banana'];
  game.onInput(0, { type: 'item' });
  assert.deepEqual(k.items, ['shield', 'banana']);
  assert.ok(game.hostView().karts[0].boosting);
});

test('items: shield blocks one hit then pops; Star is immune and spins out whoever it rams', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  onRoad(game, a, 0.3);
  onRoad(game, b, 0.6);
  useNow(game, 1, 'shield');
  game.bananas.push({ x: b.x, y: b.y, owner: 0, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, false);
  ctx.advance(ITEMS.graceMs + 50); // (a moment's grace after the shield pops)
  game.bananas.push({ x: b.x, y: b.y, owner: 0, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, true, 'the shield only blocks one hit');
  ctx.advance(ITEMS.spinMs + 100);
  // Star: bananas don't touch you, and a ram spins the rival out.
  useNow(game, 0, 'star');
  assert.equal(game.hostView().karts[0].star, true);
  game.bananas.push({ x: a.x, y: a.y, owner: 1, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[0].spin, false, 'immune');
  assert.equal(game.bananas.length, 0, 'and it clears the banana away');
  b.coins = 5;
  Object.assign(b, { x: a.x + 0.4, y: a.y, speed: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, true, 'rammed');
  assert.equal(b.coins, 2);
  // Two stars: neither spins.
  ctx.advance(ITEMS.spinMs + 100);
  useNow(game, 1, 'star');
  Object.assign(b, { x: a.x + 0.4, y: a.y, speed: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[0].spin, false);
  assert.equal(game.hostView().karts[1].spin, false);
  // A Star's top speed is higher.
  onRoad(game, a, 0.05);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  for (let i = 0; i < 20; i++) { onRoad(game, a, 0.05, a.speed); ctx.advance(100); }
  assert.ok(Math.abs(a.speed - (8.5 + ITEMS.starSpeed)) < 0.05, `star speed ${a.speed}`);
  ctx.advance(ITEMS.starMs);
  assert.equal(game.hostView().karts[0].star, false, 'wears off');
});

test('items: Gold Turbo boosts on every press for 5 s without using the queue; Coin Bag +5 (max 15)', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  game.karts[1].x = -50;
  onRoad(game, k, 0.55); // well away from the ? boxes
  useNow(game, 0, 'goldturbo', 'banana');
  assert.deepEqual(k.items, ['banana']);
  assert.equal(game.hostView().karts[0].gold, true);
  const boosts = game.events.used;
  ctx.advance(2000);
  game.onInput(0, { type: 'item' });
  assert.deepEqual(k.items, ['banana'], 'the banana is kept for later');
  assert.ok(game.hostView().karts[0].boosting);
  assert.equal(game.events.used, boosts + 1);
  ctx.advance(ITEMS.goldMs);
  game.onInput(0, { type: 'item' });
  assert.deepEqual(k.items, [], 'window over: the queue again');
  k.coins = 12;
  useNow(game, 0, 'coinbag');
  assert.equal(k.coins, 15);
});

test('items: Thunder shrinks the rival (slower, lighter) unless shielded; Freeze cuts their turning', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  onRoad(game, a, 0.3);
  useNow(game, 1, 'shield');
  useNow(game, 0, 'thunder');
  assert.equal(game.hostView().karts[1].shrunk, false, 'blocked by the shield');
  assert.equal(game.hostView().karts[1].shield, false, 'which pops');
  useNow(game, 0, 'thunder');
  assert.equal(game.hostView().karts[1].shrunk, true);
  onRoad(game, b, 0.05);
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  for (let i = 0; i < 20; i++) { onRoad(game, b, 0.05, b.speed); ctx.advance(100); }
  assert.ok(Math.abs(b.speed - (8.5 - ITEMS.thunderSpeed)) < 0.05, `shrunk top speed ${b.speed}`);
  ctx.advance(ITEMS.thunderMs);
  assert.equal(game.hostView().karts[1].shrunk, false);
  // Freeze: the same turn covers less angle.
  onRoad(game, b, 0.05, 4);
  let a0 = b.angle;
  game.onInput(1, { type: 'drive', steer: 1, gas: true });
  ctx.advance(200);
  const normal = b.angle - a0;
  useNow(game, 0, 'freeze');
  assert.equal(game.hostView().karts[1].frozen, true);
  onRoad(game, b, 0.05, 4);
  a0 = b.angle;
  ctx.advance(200);
  assert.ok(b.angle - a0 < normal * 0.75, `frozen ${b.angle - a0} vs ${normal}`);
});

test('items: Magnet collects nearby coins and slipstreams you; Hover skips the grass slowdown and rides over bananas', () => {
  const { ctx, game } = racing({ items: 1 });
  const [a, b] = game.karts;
  b.x = -50;
  const c = game.coins[0];
  useNow(game, 0, 'magnet');
  assert.equal(game.hostView().karts[0].magnet, true);
  Object.assign(a, { x: c.x + 2.5, y: c.y, speed: 0 });
  a.seg = locate(game.track, a.x, a.y).i;
  ctx.advance(TICK);
  assert.ok(a.coins >= 1, 'pulled in from 2.5 away');
  // Slipstream: right behind the rival (ahead, within 6), a little faster; not when they're behind.
  onRoad(game, a, 0.55);
  onRoad(game, b, 0.55 + 3 / game.track.length);
  assert.equal(game.slipstream(a, ctx.now()), ITEMS.slipSpeed);
  assert.equal(game.slipstream(b, ctx.now()), 0, 'no magnet, no slipstream');
  onRoad(game, b, 0.55 - 3 / game.track.length);
  assert.equal(game.slipstream(a, ctx.now()), 0, 'rival behind: nothing to pull you');
  b.x = -50;
  ctx.advance(ITEMS.magnetMs);
  // Hover: no grass slowdown, bananas pass under.
  useNow(game, 0, 'hover');
  assert.equal(game.hostView().karts[0].hover, true);
  place(game, a, 16, 9);
  Object.assign(a, { angle: 0, speed: KART.maxSpeed });
  ctx.advance(300);
  assert.ok(a.speed > KART.grassSpeed + 2, `hovering over the grass at ${a.speed}`);
  onRoad(game, a, 0.6);
  game.bananas.push({ x: a.x, y: a.y, owner: 1, safeUntil: 0 });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[0].spin, false);
  assert.equal(game.bananas.length, 1, 'still there for the next kart');
});

test('items: Swap trades queues (the Swap itself is spent)', () => {
  const { game } = racing();
  const [a, b] = game.karts;
  b.items = ['star', 'turbo'];
  useNow(game, 0, 'swap', 'banana');
  assert.deepEqual(a.items, ['star', 'turbo']);
  assert.deepEqual(b.items, ['banana']);
  b.items = [];
  useNow(game, 0, 'swap');
  assert.deepEqual(a.items, []);
  assert.deepEqual(b.items, []);
});

test('items: a Star ram spins the rival once (not every tick), and a shield still blocks one ram', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  onRoad(game, b, 0.55);
  onRoad(game, a, 0.55 - 0.5 / game.track.length);
  b.coins = 15;
  useNow(game, 1, 'shield');
  useNow(game, 0, 'star');
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  const spins = game.events.spins;
  for (let i = 0; i < 60; i++) {
    Object.assign(a, { x: b.x - Math.cos(b.angle) * 0.6, y: b.y - Math.sin(b.angle) * 0.6, angle: b.angle }); // pressed against b
    ctx.advance(TICK);
  }
  assert.ok(game.events.spins - spins <= 1, `spun ${game.events.spins - spins} times`);
  assert.ok(b.coins >= 12, `coins ${b.coins}`);
});

test('items: Thunder and Freeze miss a Star kart; Freeze is blocked by a shield; nothing hits a finished kart', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  onRoad(game, a, 0.55);
  onRoad(game, b, 0.2);
  useNow(game, 1, 'star');
  useNow(game, 0, 'thunder');
  useNow(game, 0, 'freeze');
  assert.equal(game.hostView().karts[1].shrunk, false);
  assert.equal(game.hostView().karts[1].frozen, false);
  ctx.advance(ITEMS.starMs + 50);
  useNow(game, 1, 'shield');
  useNow(game, 0, 'freeze');
  assert.equal(game.hostView().karts[1].frozen, false, 'shield took it');
  // Over the line (the other kart still racing): no zaps or swaps on it.
  b.finishedAt = ctx.now();
  b.items = ['banana'];
  useNow(game, 0, 'thunder');
  assert.equal(game.hostView().karts[1].shrunk, false);
  useNow(game, 0, 'swap', 'turbo');
  assert.deepEqual(b.items, ['banana']);
  assert.deepEqual(a.items, ['turbo']);
});

test('items: ITEM does nothing with an empty queue, while spinning or after finishing; a Magnet pulls in a box', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  b.x = -50;
  onRoad(game, a, 0.55);
  const used = game.events.used;
  useNow(game, 0);
  a.items = ['turbo'];
  a.spinUntil = ctx.now() + 500;
  game.onInput(0, { type: 'item' });
  assert.deepEqual(a.items, ['turbo'], 'not while spinning');
  ctx.advance(600);
  game.finishLine(0, ctx.now());
  game.onInput(0, { type: 'item' });
  assert.deepEqual(a.items, ['turbo'], 'not after finishing');
  assert.equal(game.events.used, used);
  // Magnet: a box 2.5 away comes to you.
  const g2 = racing().game;
  const k = g2.karts[0];
  g2.karts[1].x = -50;
  useNow(g2, 0, 'magnet');
  const box = g2.boxes[0];
  Object.assign(k, { x: box.x, y: box.y + 2.5, speed: 0 });
  k.seg = locate(g2.track, k.x, k.y).i;
  g2.itemCheck(k, 0, g2.ctx.now());
  assert.ok(k.items.length >= 1, 'pulled in from 2.5 away');
});
