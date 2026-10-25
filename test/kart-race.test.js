import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KartRace, TRACKS, FIELD, TRACK_WIDTH, KART, WALL, TIMING, LIGHTS, JUMP, REACTION_SHOW_MS, ITEMS, COINS, SAMPLES, buildTrack, locate, pointAt } from '../server/games/kart-race.js';
import { fakeCtx } from './helpers.js';

const TICK = 1000 / 60;

/** Put a kart somewhere (as if it had driven there: its progress along the lap matches). */
function place(game, k, x, y) {
  Object.assign(k, { x, y, progress: locate(game.track, x, y).s });
}

/** place(), facing along the road there (as if driving through). */
function placeAlong(game, k, x, y) {
  place(game, k, x, y);
  k.angle = pointAt(game.track, k.progress).angle;
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
  game.onInput(1, { type: 'go' }); // both ready
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
  Object.assign(b, { x: a.x + 0.3, y: a.y, angle: a.angle, speed: 0, progress: a.progress });
  ctx.advance(TICK);
  // The closest the two capsules come (sampling a's spine against b's edge): no longer overlapping.
  let edge = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = (i / 20 - 1) * KART.reach;
    edge = Math.min(edge, game.gap(b, a.x + Math.cos(a.angle) * t, a.y + Math.sin(a.angle) * t));
  }
  assert.ok(edge >= KART.r - 1e-6, `pushed apart (gap ${edge})`);
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
  assert.deepEqual(game.settings, { mode: 0, arena: 0, track: 0, laps: 5, races: 1, items: 1 });
  game.onInput(1, { type: 'setting', key: 'races', value: 3 });
  game.onInput(1, { type: 'setting', key: 'laps', value: 4 }); // not a choice
  assert.deepEqual(ctx.saved.settings, { mode: 0, arena: 0, track: 0, laps: 5, races: 3, items: 1 });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' }); // both ready
  assert.equal(game.hostView().winScore, 2);
  const tracks = [game.track.index];
  for (let r = 0; r < 2; r++) {
    ctx.advance(TIMING.countdownMs + 50); // lights out
    game.finishLine(1, ctx.now()); // (as if kart 2 just crossed the line on its last lap)
    ctx.advance(TIMING.finishMs + 100);
    if (game.phase === 'standings') {
      game.onInput(0, { type: 'go' });
      game.onInput(1, { type: 'go' }); // both ready for the next race
      tracks.push(game.track.index);
    }
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
  placeAlong(game, k, box.x, box.y);
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
  for (const kind of ['star', 'goldturbo', 'thunder', 'freeze', 'swap', 'hover', 'seeker']) {
    assert.ok(!leader[kind], `1st drew ${kind}`);
    assert.ok(chaser[kind] > 0, `2nd never drew ${kind}`);
  }
  assert.ok(leader.banana > (chaser.banana || 0));
  assert.ok(Object.keys(leader).concat(Object.keys(chaser)).every((k) => ITEMS.kinds.includes(k)));
  for (const kind of ITEMS.kinds) assert.ok(leader[kind] || chaser[kind], `nobody ever draws ${kind}`);
  assert.equal(ITEMS.kinds.length, 16);
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
  game.onInput(1, { type: 'go' }); // both ready
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
  game.onInput(1, { type: 'go' }); // both ready
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
  game.onInput(1, { type: 'rematch' }); // both want it
  assert.equal(game.phase, 'countdown');
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
        if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 2 * (COINS.r + KART.r) + 2 * KART.reach, `${t.name}: two coins in one grab`);
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
  placeAlong(game, k, double.x, double.y);
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

/** A race with kart 1 parked well out of the way (unless needed) and kart 0 on the road at p. */
function solo(p = 0.55, opts) {
  const { ctx, game } = racing(opts);
  const [a, b] = game.karts;
  onRoad(game, a, p);
  onRoad(game, b, (p + 0.5) % 1);
  return { ctx, game, a, b };
}

test('items: a Web holds you to half speed for 1.5 s (no coins lost); Hover floats over; a shield blocks it', () => {
  const { ctx, game, a, b } = solo(0.55);
  useNow(game, 0, 'web');
  assert.equal(game.webs.length, 1);
  const w = game.webs[0];
  b.coins = 5;
  onRoad(game, b, 0.2);
  Object.assign(b, { x: w.x, y: w.y, speed: 8 });
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].webbed, true);
  assert.equal(game.webs.length, 0, 'used up');
  assert.equal(b.coins, 5, 'no coins lost');
  for (let i = 0; i < 10; i++) { onRoad(game, b, 0.2, b.speed); ctx.advance(100); }
  assert.ok(b.speed <= (8.5 + b.coins * COINS.perCoin) * ITEMS.webSlow + 0.05, `held back: ${b.speed}`);
  ctx.advance(ITEMS.webMs);
  assert.equal(game.hostView().karts[1].webbed, false);
  // Hover floats over it; a shield takes it.
  useNow(game, 0, 'web');
  useNow(game, 1, 'hover');
  Object.assign(b, { x: game.webs[0].x, y: game.webs[0].y });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].webbed, false);
  assert.equal(game.webs.length, 1, 'still there');
  ctx.advance(ITEMS.hoverMs);
  useNow(game, 1, 'shield');
  Object.assign(b, { x: game.webs[0].x, y: game.webs[0].y });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].webbed, false, 'blocked');
  assert.equal(game.hostView().karts[1].shield, false);
});

test('items: Oil takes your steering and brakes for 1 s', () => {
  const { ctx, game, a, b } = solo(0.55);
  useNow(game, 0, 'oil');
  const o = game.oils[0];
  onRoad(game, b, 0.2, 6);
  Object.assign(b, { x: o.x, y: o.y });
  game.onInput(1, { type: 'drive', steer: 1, brake: true });
  ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].oiled, true);
  const angle = b.angle;
  const speed = b.speed;
  ctx.advance(300);
  assert.ok(Math.abs(b.angle - angle) < 1e-9, 'no steering');
  assert.ok(b.speed > speed - 1.5, 'no braking (it only coasts)');
  ctx.advance(ITEMS.oilMs);
  assert.equal(game.hostView().karts[1].oiled, false);
});

test('items: a Bouncer flies straight, bounces off barriers and stays in, spins whoever it hits, and is gone after 4 s', () => {
  const hairpins = TRACKS.findIndex((t) => t.name === 'Hairpins') + 1;
  const { ctx, game, a, b } = solo(0.2, { track: hairpins });
  b.x = -50;
  // Fired sideways at the barrier: it bounces and stays inside, the whole time.
  a.angle += Math.PI / 2;
  useNow(game, 0, 'bouncer');
  assert.equal(game.shots.length, 1);
  const limit = TRACK_WIDTH / 2 + WALL.out + 0.3;
  let bounced = false;
  const first = game.shots[0].angle;
  for (let i = 0; i < 200 && game.shots.length; i++) {
    ctx.advance(TICK);
    const s = game.shots[0];
    if (!s) break;
    if (Math.abs(Math.atan2(Math.sin(s.angle - first), Math.cos(s.angle - first))) > 0.5) bounced = true;
    assert.ok(s.x > 0 && s.x < FIELD.w && s.y > 0 && s.y < FIELD.h, 'on the field');
    assert.ok(locate(game.track, s.x, s.y).d < limit, 'inside the barriers');
  }
  assert.ok(bounced, 'it bounced');
  // Its thrower is safe at first; a kart in its path spins.
  ctx.advance(ITEMS.bouncerMs);
  assert.equal(game.shots.length, 0, 'gone after 4 s');
  onRoad(game, a, 0.2);
  onRoad(game, b, 0.2 + 3 / game.track.length);
  b.coins = 5;
  useNow(game, 0, 'bouncer');
  for (let i = 0; i < 40; i++) ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, true, 'hit');
  assert.equal(b.coins, 2);
  assert.equal(game.hostView().karts[0].spin, false, 'the thrower is safe at first');
  assert.equal(game.shots.length, 0, 'used up');
});

test('items: a Seeker chases the rival round the road and spins them; a banana in its way stops it; never a finished kart', () => {
  const { ctx, game, a, b } = solo(0.1);
  onRoad(game, b, 0.4);
  useNow(game, 0, 'seeker');
  assert.equal(game.shots[0].kind, 'seeker');
  for (let i = 0; i < 60 * 4 && game.shots.length; i++) ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, true, 'caught them');
  // A banana in its way stops it.
  ctx.advance(ITEMS.spinMs + 100);
  onRoad(game, a, 0.1);
  onRoad(game, b, 0.4);
  const p = pointAt(game.track, 0.2);
  game.bananas.push({ x: p.x, y: p.y, owner: 1, safeUntil: 0 });
  useNow(game, 0, 'seeker');
  for (let i = 0; i < 60 * 4 && game.shots.length; i++) ctx.advance(TICK);
  assert.equal(game.hostView().karts[1].spin, false, 'stopped by the banana');
  assert.equal(game.bananas.length, 0, 'which goes too');
  // A finished kart: it gives up (6 s) and never hits it.
  b.finishedAt = ctx.now();
  useNow(game, 0, 'seeker');
  ctx.advance(ITEMS.seekerMs + 100);
  assert.equal(game.shots.length, 0);
  assert.equal(game.hostView().karts[1].spin, false);
});

test('items: a Bomb lands ahead and goes off after 1.5 s, spinning everyone within 2 (the thrower too)', () => {
  const { ctx, game, a, b } = solo(0.55);
  game.onInput(0, { type: 'drive', steer: 0 });
  a.speed = 0;
  useNow(game, 0, 'bomb');
  const bomb = game.shots[0];
  assert.equal(bomb.kind, 'bomb');
  assert.ok(Math.abs(Math.hypot(bomb.x - a.x, bomb.y - a.y) - ITEMS.bombThrow) < 0.6, 'about 5 ahead');
  // b just past it, a (the thrower) just short of it, both on the road.
  const along = (d) => ({ x: bomb.x + Math.cos(a.angle) * d, y: bomb.y + Math.sin(a.angle) * d });
  for (const [k, d] of [[b, 1.5], [a, -1.2]]) {
    const at = along(d);
    place(game, k, at.x, at.y); // (with its progress, or it'd look like a shortcut)
    Object.assign(k, { speed: 0, seg: locate(game.track, at.x, at.y).i });
  }
  ctx.advance(ITEMS.bombFuseMs - 100);
  assert.equal(game.hostView().karts[1].spin, false, 'not yet');
  ctx.advance(200);
  assert.equal(game.hostView().karts[1].spin, true, 'boom');
  assert.equal(game.hostView().karts[0].spin, true, 'the thrower too, standing that close');
  assert.equal(game.shots.length, 0);
  assert.ok(game.events.exploded >= 1);
});

test('items: shots and hazards are cleared each race; 6 webs at most; a Bouncer and a Seeker destroy each other', () => {
  const { ctx, game, a, b } = solo(0.55, { races: 3 });
  for (let i = 0; i < 8; i++) {
    useNow(game, 0, 'web');
    a.x += 0.01;
  }
  assert.equal(game.webs.length, ITEMS.maxHazards);
  useNow(game, 0, 'bouncer');
  game.shots.push({ kind: 'seeker', x: game.shots[0].x, y: game.shots[0].y, angle: 0, owner: 1, bornAt: ctx.now(), until: ctx.now() + 5000, seg: game.shots[0].seg });
  ctx.advance(TICK);
  assert.equal(game.shots.length, 0, 'both gone');
  useNow(game, 0, 'oil');
  useNow(game, 0, 'bomb');
  game.newRace();
  assert.deepEqual([game.webs.length, game.oils.length, game.shots.length, game.bananas.length], [0, 0, 0, 0]);
});

test('items: firing a Bouncer while boosting never hits you; a Bomb floats past a hovering kart; a Web bites at once', () => {
  // Turbo, then Bouncer: the kart is faster than a normal Bouncer, but it never catches its own.
  const { ctx, game, a, b } = solo(0.05);
  b.x = -50;
  a.coins = 15;
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  useNow(game, 0, 'turbo');
  useNow(game, 0, 'bouncer');
  for (let i = 0; i < 60; i++) ctx.advance(TICK);
  assert.equal(game.hostView().karts[0].spin, false, 'no self-hit');
  // Hover over a Bomb's blast.
  const g = solo(0.55);
  g.game.onInput(0, { type: 'drive', steer: 0 });
  g.a.speed = 0;
  useNow(g.game, 0, 'bomb');
  useNow(g.game, 1, 'hover');
  const bomb = g.game.shots[0];
  place(g.game, g.b, bomb.x, bomb.y);
  Object.assign(g.b, { speed: 0, seg: locate(g.game.track, bomb.x, bomb.y).i });
  g.ctx.advance(ITEMS.bombFuseMs + 50);
  assert.equal(g.game.hostView().karts[1].spin, false, 'floated over the blast');
  // A Web slows you right away, not a second later.
  const w = solo(0.55);
  useNow(w.game, 0, 'web');
  const web = w.game.webs[0];
  onRoad(w.game, w.b, 0.2);
  Object.assign(w.b, { x: web.x, y: web.y, speed: 12 });
  w.ctx.advance(TICK);
  assert.ok(w.b.speed <= 8.5 * ITEMS.webSlow + 0.1, `straight down to half speed: ${w.b.speed}`);
});

test('items: a Bomb lands on your own road ahead; a Seeker ignores a rival across a barrier', () => {
  const hairpins = TRACKS.findIndex((t) => t.name === 'Hairpins') + 1;
  for (let p = 0.05; p < 1; p += 0.05) {
    const { game, a } = solo(p, { track: hairpins });
    game.onInput(0, { type: 'drive', steer: 0 });
    useNow(game, 0, 'bomb');
    const bomb = game.shots[0];
    const seg = locate(game.track, bomb.x, bomb.y).i;
    const gap = Math.abs(seg - Math.round(a.progress * SAMPLES));
    assert.ok(Math.min(gap, SAMPLES - gap) < 20, `at ${p.toFixed(2)}: the bomb landed on another stretch`);
  }
  // A rival parked just across the barrier from the Seeker's stretch: it doesn't dive at them.
  const { ctx, game, a, b } = solo(0.02, { track: hairpins });
  let best = null;
  for (let i = 0; i < SAMPLES; i++) {
    const gap = Math.min(Math.abs(i - 10), SAMPLES - Math.abs(i - 10));
    if (gap < 30) continue;
    const d = Math.hypot(game.track.line[i][0] - game.track.line[10][0], game.track.line[i][1] - game.track.line[10][1]);
    if (!best || d < best.d) best = { i, d };
  }
  onRoad(game, b, best.i / SAMPLES);
  // ...nudged toward the barrier (still on its own road), well within a Seeker's homing reach.
  const toward = game.track.line[10];
  const d = Math.hypot(toward[0] - b.x, toward[1] - b.y);
  Object.assign(b, { x: b.x + ((toward[0] - b.x) / d) * 1.2, y: b.y + ((toward[1] - b.y) / d) * 1.2, seg: best.i });
  useNow(game, 0, 'seeker');
  ctx.advance(1000);
  const s = game.shots[0];
  assert.ok(s, 'still flying');
  const gap = Math.min(Math.abs(s.seg - a.seg), SAMPLES - Math.abs(s.seg - a.seg));
  assert.ok(gap > 10, `it kept going along the road (stuck at seg ${s.seg})`);
});

test('hit size: a kart is a capsule as long and wide as its picture', async () => {
  await import('../public/games/kart-race/racers.js');
  const R = globalThis.ArkKartRacers;
  assert.equal((KART.reach + KART.r) * 2, R.KART_LEN, 'as long as the picture');
  assert.equal(KART.r * 2, 1, 'about as wide as the picture');
});

test('hit size: coins at the nose and bananas at the tail count; karts bump nose to tail at the picture length', () => {
  const { ctx, game } = racing();
  const [a, b] = game.karts;
  b.x = -50;
  onRoad(game, a, 0.62);
  const ahead = (d, side = 0) => ({ x: a.x + Math.cos(a.angle) * d - Math.sin(a.angle) * side, y: a.y + Math.sin(a.angle) * d + Math.cos(a.angle) * side });
  // A coin just off the nose (past the old 0.42 circle's reach).
  game.coins = [{ ...ahead(1.1), backAt: 0 }];
  ctx.advance(TICK);
  assert.equal(a.coins, 1, 'coin at the nose');
  // The same distance off the side: out of reach.
  onRoad(game, a, 0.62);
  game.coins = [{ ...ahead(0, 1.1), backAt: 0 }];
  ctx.advance(TICK);
  assert.equal(a.coins, 1, 'coin beside the kart, out of reach');
  // A banana just behind the tail.
  onRoad(game, a, 0.62);
  game.bananas = [{ ...ahead(-1.2), owner: 1, safeUntil: 0 }];
  ctx.advance(TICK);
  assert.ok(a.spinUntil > ctx.now(), 'banana at the tail');
  // Nose to tail, 1.6 apart (the pictures overlap): a bump. Side by side 1.1 apart: none.
  const bumps = game.events.bumps;
  onRoad(game, a, 0.62);
  Object.assign(b, { ...ahead(1.6), angle: a.angle, speed: 0, progress: a.progress });
  game.bump();
  assert.equal(game.events.bumps, bumps + 1, 'nose to tail');
  onRoad(game, a, 0.62);
  Object.assign(b, { ...ahead(0, 1.1), angle: a.angle, speed: 0 });
  game.bump();
  assert.equal(game.events.bumps, bumps + 1, 'side by side, apart');
});

test('hit size: driving straight over one ? box of a row touches only that box', () => {
  for (let t = 1; t <= TRACKS.length; t++) {
    const { game } = racing({ track: t });
    for (const p of ITEMS.rows) {
      const along = pointAt(game.track, p).angle;
      const row = game.boxes.filter((b) => Math.abs(locate(game.track, b.x, b.y).s - p) < 0.01);
      assert.equal(row.length, ITEMS.offsets.length);
      for (const box of row) {
        const k = { x: box.x, y: box.y, angle: along };
        const touched = row.filter((o) => game.gap(k, o.x, o.y) <= ITEMS.boxR);
        assert.equal(touched.length, 1, `track ${t}, row ${p}`);
      }
    }
  }
});

test('hit size: karts whose middles cross (a T-bone, an X) are pushed apart, not through each other', () => {
  const { game } = racing();
  const [a, b] = game.karts;
  const at = (d, side) => ({ x: a.x + Math.cos(a.angle) * d - Math.sin(a.angle) * side, y: a.y + Math.sin(a.angle) * d + Math.cos(a.angle) * side });
  const sideOf = () => -(b.x - a.x) * Math.sin(a.angle) + (b.y - a.y) * Math.cos(a.angle);
  const aheadOf = () => (b.x - a.x) * Math.cos(a.angle) + (b.y - a.y) * Math.sin(a.angle);
  // T-bone: b across a's front half.
  onRoad(game, a, 0.62);
  Object.assign(b, { ...at(0.3, 0), angle: a.angle + Math.PI / 2, speed: 0 });
  game.bump();
  game.bump();
  assert.ok(aheadOf() > 0.3, `T-bone: pushed further ahead, not back through (${aheadOf().toFixed(2)})`);
  // X: crossing at the middles, b a touch to one side.
  onRoad(game, a, 0.62);
  Object.assign(b, { ...at(0, 0.05), angle: a.angle + Math.PI / 2, speed: 0 });
  game.bump();
  game.bump();
  assert.ok(sideOf() > 0.05, `X: pushed out on its own side (${sideOf().toFixed(2)})`);
});

test('walls: the whole kart stays inside the barrier, nose first or reversing tail first', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  game.karts[1].x = -50;
  const wall = TRACK_WIDTH / 2 + WALL.out;
  const p = pointAt(game.track, 0.1);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle); // to the right of the road
  const tips = () => [1, -1].map((s) => locate(game.track, k.x + Math.cos(k.angle) * s * (KART.reach + KART.r), k.y + Math.sin(k.angle) * s * (KART.reach + KART.r)).d);
  const run = (angle, input) => {
    place(game, k, p.x + nx * 0.5, p.y + ny * 0.5);
    Object.assign(k, { angle, speed: 0 });
    game.onInput(0, { type: 'drive', steer: 0, ...input });
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      ctx.advance(TICK);
      worst = Math.max(worst, ...tips());
    }
    game.onInput(0, { type: 'drive', steer: 0, gas: false, brake: false });
    return worst;
  };
  const nose = run(Math.atan2(ny, nx), { gas: true });
  assert.ok(nose <= wall + 0.02, `nose first: a tip reached ${nose.toFixed(2)} (wall at ${wall})`);
  assert.ok(game.events.walls > 0, 'it did reach the wall');
  const tail = run(Math.atan2(-ny, -nx), { brake: true });
  assert.ok(tail <= wall + 0.02, `tail first: a tip reached ${tail.toFixed(2)} (wall at ${wall})`);
});

test('walls: scraping along a wall with nose and middle both touching counts one hit a tick', () => {
  const { ctx, game } = racing();
  const k = game.karts[0];
  game.karts[1].x = -50;
  const wall = TRACK_WIDTH / 2 + WALL.out;
  const p = pointAt(game.track, 0.1);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  // Angled 25° into the wall, the middle and the nose both just over it.
  const off = wall - KART.r + 0.05;
  place(game, k, p.x + nx * off, p.y + ny * off);
  Object.assign(k, { angle: p.angle + 0.45, speed: KART.maxSpeed });
  const walls = game.events.walls;
  ctx.advance(TICK);
  assert.equal(game.events.walls, walls + 1);
  assert.ok(k.speed > KART.maxSpeed * 0.6, `slid on (${k.speed.toFixed(2)})`);
});

test('ready: the race starts when both players are ready; go again un-readies; picks and settings clear ticks', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  assert.deepEqual(game.hostView().ready, [false, false]);
  game.onInput(0, { type: 'go' });
  assert.equal(game.phase, 'setup', 'one ready player: still setting up');
  assert.deepEqual(game.hostView().ready, [true, false]);
  game.onInput(0, { type: 'go' });
  assert.deepEqual(game.hostView().ready, [false, false], 'pressed again: not ready');
  // Your own pick clears your own tick only.
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'racer', id: 'rex' });
  assert.deepEqual(game.hostView().ready, [true, false]);
  game.onInput(0, { type: 'racer', id: 'zip' });
  assert.deepEqual(game.hostView().ready, [false, false], 'changed your racer: ready again when you are');
  // A setting change clears both (you agreed to the old one).
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'setting', key: 'laps', value: game.settings.laps === 3 ? 5 : 3 });
  assert.deepEqual(game.hostView().ready, [false, false]);
  // Both ready: the lights.
  game.onInput(1, { type: 'go' });
  game.onInput(0, { type: 'go' });
  assert.equal(game.phase, 'countdown');
  // Back to setup later: nobody is ready.
  ctx.advance(TIMING.countdownMs + 50);
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  game.onInput(0, { type: 'setup' });
  assert.equal(game.phase, 'setup');
  assert.deepEqual(game.hostView().ready, [false, false]);
});

test('lights: five red lights come on one by one, hold, then all go out and the race starts', () => {
  for (const [roll, hold] of [[0, LIGHTS.holdMin], [0.999, LIGHTS.holdMax]]) {
    const ctx = fakeCtx();
    const game = new KartRace(ctx, () => roll);
    game.start();
    game.onInput(0, { type: 'go' });
    game.onInput(1, { type: 'go' });
    assert.equal(LIGHTS.count, 5);
    const seen = [];
    let t = 0;
    while (game.phase === 'countdown' && t < 10000) {
      seen.push([t, game.hostView().lights]);
      ctx.advance(50);
      t += 50;
    }
    assert.equal(game.phase, 'race');
    const lit = (n) => seen.find(([, l]) => l >= n)[0];
    for (let n = 1; n <= 5; n++) assert.ok(Math.abs(lit(n) - n * LIGHTS.stepMs) <= 50, `light ${n} at ${lit(n)} ms`);
    const out = 5 * LIGHTS.stepMs + hold;
    assert.ok(Math.abs(t - out) <= 60, `lights out at ${t} ms, expected ${out}`);
    assert.ok(TIMING.countdownMs >= 5 * LIGHTS.stepMs + LIGHTS.holdMax, 'countdownMs covers the longest start');
  }
});

test('lights: the view sends no countdown number (the hub would beep its own seconds over the lights)', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  for (let t = 0; t < TIMING.countdownMs && game.phase === 'countdown'; t += 100) {
    assert.equal(game.hostView().countdown, 0);
    assert.equal(game.playerView(0).countdown, 0);
    ctx.advance(100);
  }
});

test('ready: a player whose phone dropped out counts as ready (the other can still start)', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  ctx.players[1].connected = false;
  game.onInput(0, { type: 'go' });
  assert.equal(game.phase, 'countdown');
});

/** A series (races: 1, 3, or 4 for a cup) past setup, both players ready. */
function series(races, rng = () => 0.5) {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, rng);
  game.start();
  game.onInput(0, { type: 'setting', key: 'races', value: races });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  return { ctx, game };
}

/** Run the current race: lights out, `slot` crosses the line first, the race closes. */
function winRace(ctx, game, slot) {
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.phase, 'race');
  game.finishLine(slot, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
}

test('cup: four races on four different tracks, a leaderboard between them, most wins takes the cup', () => {
  const { ctx, game } = series(4);
  assert.equal(game.hostView().races, 4);
  const tracks = [];
  for (const [r, slot] of [[1, 0], [2, 1], [3, 0], [4, 0]].entries()) {
    tracks.push(game.track.index);
    assert.equal(game.race, r + 1);
    winRace(ctx, game, slot[1]);
    if (r < 3) {
      // Standings: the leaderboard, waiting for both.
      assert.equal(game.phase, 'standings');
      const v = game.hostView();
      assert.equal(v.history.length, r + 1);
      assert.equal(v.history[r].winner, slot[1]);
      assert.equal(v.history[r].track, game.track.name);
      assert.ok(v.history[r].times[slot[1]] > 0);
      assert.ok(v.next && v.next.track, 'shows the next track');
      game.onInput(0, { type: 'go' });
      assert.equal(game.phase, 'standings', 'one ready: still waiting');
      game.onInput(1, { type: 'go' });
      assert.equal(game.phase, 'countdown');
    }
  }
  assert.equal(new Set(tracks).size, 4, 'four different tracks');
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0, '3 wins to 1');
  assert.equal(game.hostView().history.length, 4);
});

test('cup: two wins each goes to a sudden-death race on a fifth track', () => {
  const { ctx, game } = series(4);
  const tracks = [];
  for (const slot of [0, 1, 0, 1]) {
    tracks.push(game.track.index);
    winRace(ctx, game, slot);
    assert.equal(game.phase, 'standings');
    game.onInput(0, { type: 'go' });
    game.onInput(1, { type: 'go' });
  }
  assert.equal(game.race, 5);
  assert.equal(game.hostView().suddenDeath, true);
  assert.ok(!tracks.includes(game.track.index), 'a track not raced yet');
  winRace(ctx, game, 1);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test('best of 3: the leaderboard between races, and the next race waits for both', () => {
  const { ctx, game } = series(3);
  winRace(ctx, game, 1);
  assert.equal(game.phase, 'standings');
  ctx.advance(10000);
  assert.equal(game.phase, 'standings', 'no rush: it waits');
  game.onInput(1, { type: 'go' });
  game.onInput(0, { type: 'go' });
  winRace(ctx, game, 1);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test('rematch: waits for both players; ready is cleared on the end screen', () => {
  const { ctx, game } = series(1);
  winRace(ctx, game, 0);
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.hostView().ready, [false, false]);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'over', 'one wants a rematch: still waiting');
  assert.deepEqual(game.hostView().ready, [true, false]);
  game.onInput(0, { type: 'rematch' });
  assert.deepEqual(game.hostView().ready, [false, false], 'pressed again: cancelled');
  game.onInput(0, { type: 'rematch' });
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0], 'a fresh series');
});

test('jump start: pressing GAS during the lights stalls you for 1 s after lights out; holding it from before, or pressing after, does not', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'setting', key: 'track', value: 1 });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  const jumped = game.events.jumpStarts;
  ctx.advance(LIGHTS.stepMs * 2); // two lights on
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  // That was during the lights: a jump start. Player 1 waits, then presses at lights out.
  while (game.phase === 'countdown') ctx.advance(10);
  assert.equal(game.phase, 'race');
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  assert.equal(game.events.jumpStarts, jumped + 1);
  const [a, b] = game.karts;
  assert.equal(game.hostView().karts[1].jumped, true);
  assert.equal(game.hostView().karts[0].jumped, false);
  ctx.advance(JUMP.stallMs - 200);
  assert.equal(b.speed, 0, 'stalled');
  assert.ok(a.speed > 3, `the other is away (${a.speed})`);
  ctx.advance(600);
  assert.equal(game.hostView().karts[1].jumped, false);
  assert.ok(b.speed > 0, 'going after the stall');
  assert.equal(JUMP.stallMs, 1000);
});

test('jump start: GAS still held from the last race (between races) is not a jump start', () => {
  const { ctx, game } = series(3, () => 0);
  ctx.advance(TIMING.countdownMs + 50);
  game.onInput(0, { type: 'drive', steer: 0, gas: true }); // after lights out: fine
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'standings');
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  assert.equal(game.karts[0].gas, true, 'still held from the last race');
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.events.jumpStarts, 0);
  assert.equal(game.hostView().karts[0].jumped, false);
});

test('standings: the race loop stops while the leaderboard is up (no views sent while you sit there)', () => {
  const { ctx, game } = series(3);
  winRace(ctx, game, 1);
  assert.equal(game.phase, 'standings');
  const before = ctx.updates;
  ctx.advance(10000);
  assert.equal(ctx.updates, before, 'nothing to send');
  assert.equal(ctx.pendingTimers(), 0, 'no timers left running');
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.phase, 'race', 'and it runs again for the next race');
});

test('jump start: the A press that readies a controller player (GAS too) is not a jump start', () => {
  const { ctx, game } = series(3, () => 0);
  // Both just pressed Ready; the controller's A (also GAS) is still down as the lights begin.
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  ctx.advance(JUMP.graceMs - 100);
  game.onInput(1, { type: 'drive', steer: 0, gas: false });
  assert.equal(game.events.jumpStarts, 0);
  assert.ok(JUMP.graceMs < LIGHTS.stepMs, 'over before the first light');
  // A real press once the lights are on still counts.
  ctx.advance(LIGHTS.stepMs);
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  assert.equal(game.events.jumpStarts, 1);
});

test('reaction: the time from lights out to your first GAS press shows for 3 s; none after a jump start or with GAS already held', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(LIGHTS.stepMs * 2);
  game.onInput(1, { type: 'drive', steer: 0, gas: true }); // jumped
  game.onInput(1, { type: 'drive', steer: 0, gas: false });
  while (game.phase === 'countdown') ctx.advance(10);
  ctx.advance(320);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  game.onInput(1, { type: 'drive', steer: 0, gas: true });
  const v = game.hostView();
  assert.ok(Math.abs(v.karts[0].reaction - 320) <= 20, `reaction ${v.karts[0].reaction}`);
  assert.equal(v.karts[1].reaction, null, 'a jump start has no reaction time');
  // A later press doesn't change it; it hides after 3 s.
  game.onInput(0, { type: 'drive', steer: 0, gas: false });
  ctx.advance(200);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  assert.ok(Math.abs(game.hostView().karts[0].reaction - 320) <= 20);
  ctx.advance(REACTION_SHOW_MS);
  assert.equal(game.hostView().karts[0].reaction, null, 'shown for a moment only');
});

test('reaction: GAS already held when the lights go out gives no reaction time', () => {
  const { ctx, game } = series(3, () => 0);
  ctx.advance(TIMING.countdownMs + 50);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  while (game.phase === 'countdown') ctx.advance(10);
  ctx.advance(300);
  assert.equal(game.hostView().karts[0].reaction, null);
});

test('lap records: each race keeps both best laps, and the end view lists them by track', () => {
  const { ctx, game } = series(3, () => 0);
  ctx.advance(TIMING.countdownMs + 50);
  game.karts[0].bestLap = 21000;
  game.karts[1].bestLap = 19500;
  game.finishLine(1, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  const first = game.track.name;
  assert.deepEqual(game.hostView().history[0].best, [21000, 19500]);
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  game.karts[1].bestLap = 18000; // kart 1 never set a lap
  game.finishLine(1, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.hostView().lapTimes, [
    { track: first, slot: 0, ms: 21000 },
    { track: first, slot: 1, ms: 19500 },
    { track: game.track.name, slot: 1, ms: 18000 },
  ]);
});

test('jump start: GAS pressed the instant the lights go out (before the next tick) is not a jump start', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  // Step to the last tick of the countdown, then just past the lights-out time without a tick.
  while (ctx.now() + TICK < game.phaseEnds) ctx.advance(TICK / 4);
  const lightsOut = game.phaseEnds;
  ctx.advance(lightsOut - ctx.now()); // exactly lights out; the tick that starts the race may not have run
  if (game.phase === 'countdown') game.onInput(0, { type: 'drive', steer: 0, gas: true });
  assert.equal(game.events.jumpStarts, 0);
});

test('reaction: a very late first press is not shown as a reaction time', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  while (game.phase === 'countdown') ctx.advance(10);
  ctx.advance(2500);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  assert.equal(game.hostView().karts[0].reaction, null);
});

/** Count a lap for kart `slot` that took `ms` (as lapCheck would). */
function lapIn(game, ctx, slot, ms) {
  const k = game.karts[slot];
  k.lapStart = ctx.now() - game.raceStart - ms;
  onRoad(game, k, 0.005); // just over the line...
  k.progress = 0.995; // ...from just before it
  k.halfway = true;
  game.lapCheck(k, slot, ctx.now());
}

test('lap record: the track record shows during the race; beating it shows a "new record" for 3 s', () => {
  const ctx = fakeCtx();
  ctx.lapRecord = (track) => (track === 'Speedway' ? { name: 'Cat', ms: 20000 } : null);
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'setting', key: 'track', value: 1 });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.track.name, 'Speedway');
  assert.deepEqual(game.hostView().record, { name: 'Cat', ms: 20000 });
  ctx.advance(25000);
  lapIn(game, ctx, 1, 21000);
  assert.equal(game.hostView().newRecord, null, 'slower than the record');
  lapIn(game, ctx, 0, 19000);
  assert.deepEqual(game.hostView().record, { name: 'Ana', ms: 19000 });
  assert.deepEqual(game.hostView().newRecord, { slot: 0, name: 'Ana', ms: 19000 });
  assert.equal(game.events.records, 1);
  ctx.advance(3100);
  assert.equal(game.hostView().newRecord, null);
});

test('lap record: on a track with no record the first lap quietly becomes it (no banner)', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.hostView().record, null);
  ctx.advance(25000);
  lapIn(game, ctx, 1, 22000);
  assert.deepEqual(game.hostView().record, { name: 'Ben', ms: 22000 });
  assert.equal(game.hostView().newRecord, null);
  assert.equal(game.events.records, 0);
});

test('best starts: each race keeps both reaction times, and the end view lists them', () => {
  const { ctx, game } = series(1, () => 0);
  while (game.phase === 'countdown') ctx.advance(10);
  ctx.advance(300);
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(2500);
  game.onInput(1, { type: 'drive', steer: 0, gas: true }); // too slow to count
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  const r = game.hostView().reactionTimes;
  assert.equal(r.length, 1);
  assert.equal(r[0].slot, 0);
  assert.ok(Math.abs(r[0].ms - 300) <= 20);
});

test('lap record: a record set earlier in the series still stands in the next race (not the older saved one)', () => {
  const ctx = fakeCtx();
  ctx.lapRecord = () => ({ name: 'Cat', ms: 42000 }); // the saved record: laps are only saved at the end
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'setting', key: 'track', value: 1 });
  game.onInput(0, { type: 'setting', key: 'races', value: 3 });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  ctx.advance(45000);
  lapIn(game, ctx, 0, 40000);
  assert.equal(game.events.records, 1);
  game.finishLine(0, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.deepEqual(game.hostView().record, { name: 'Ana', ms: 40000 }, "race 1's record, not the older saved one");
  ctx.advance(45000);
  lapIn(game, ctx, 1, 41000);
  assert.equal(game.events.records, 1, 'slower than race 1: no new record');
});

test('lap record: a record on the last lap is still announced during the finish', () => {
  const ctx = fakeCtx();
  ctx.lapRecord = () => ({ name: 'Cat', ms: 42000 });
  const game = new KartRace(ctx, () => 0);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  ctx.advance(45000);
  game.karts[0].laps = game.settings.laps - 1;
  lapIn(game, ctx, 0, 40000);
  assert.equal(game.phase, 'finish');
  assert.deepEqual(game.hostView().newRecord, { slot: 0, name: 'Ana', ms: 40000 });
});
