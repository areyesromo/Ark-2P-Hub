// The fourth batch of Party Minigames (2D, run & dodge): Hurdle Dash, Laser Dodge, Pop the Most,
// each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import hurdleDash, { LENGTH, JUMP_MS as HURDLE_JUMP_MS, MIN_GAP, LAND_MS } from '../server/games/minis/hurdle-dash.js';
import laserDodge, { LIVES, JUMP_MS as LASER_JUMP_MS } from '../server/games/minis/laser-dodge.js';
import popTheMost, { POINTS, COOLDOWN_MS, GRAB_R, ASPECT, CURSOR_SPEED } from '../server/games/minis/pop-the-most.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function run(def, seed = 1) {
  const ctx = fakeCtx();
  let ended = null;
  let ends = 0;
  let updates = 0;
  // As in a real match: now() is the room's clock (long past 0), elapsed() is the minigame's own.
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: () => ctx.now() + 600000, elapsed: () => ctx.now(), update() { updates++; },
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { ends++; if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended, ends: () => ends, updates: () => updates };
}

test('the fourth batch: party minigames in 2D, in the party list', () => {
  for (const m of [hurdleDash, laserDodge, popTheMost]) {
    assert.equal(m.kind, 'party');
    assert.equal(m.look, '2d');
    assert.ok(m.howTo && m.order && m.durationMs <= 45000, m.id);
    assert.ok(PARTIES.includes(m), m.id + ' is in PARTIES');
  }
});

// ---- Hurdle Dash ----

/** Distance from runner `slot` to the next hurdle ahead (Infinity when none). */
function nextHurdle(v, slot) {
  const pos = v.runners[slot].pos;
  const ahead = v.hurdles.filter((h) => h > pos);
  return ahead.length ? ahead[0] - pos : Infinity;
}

test('hurdle dash: both runners get the same hurdles, spaced out along the track', () => {
  const { inst } = run(hurdleDash, 3);
  const { hurdles } = inst.view(0);
  assert.ok(hurdles.length >= 6);
  hurdles.forEach((h, i) => {
    assert.ok(h > 0 && h < LENGTH);
    if (i) assert.ok(h - hurdles[i - 1] >= MIN_GAP);
  });
  assert.deepEqual(inst.view(1).hurdles, hurdles, 'one course for both');
});

test('hurdle dash: a timed jump clears the hurdle, no jump stumbles and slows you', () => {
  const { inst, ctx } = run(hurdleDash, 3);
  // Jump with player 1 just before the first hurdle; player 2 never jumps.
  for (let t = 0; t < 10000; t += 50) {
    if (nextHurdle(inst.view(0), 0) < inst.view(0).runners[0].speed * 0.2) {
      inst.onInput(0, { type: 'jump' });
      break;
    }
    ctx.advance(50);
  }
  const first = inst.view(0).hurdles[0];
  for (let t = 0; t < 10000 && Math.min(...inst.view(0).runners.map((r) => r.pos)) < first + 0.5; t += 50) ctx.advance(50);
  const [a, b] = inst.view(0).runners;
  assert.equal(a.clipped, 0, 'cleared');
  assert.equal(b.clipped, 1, 'clipped the hurdle');
  assert.ok(a.speed > b.speed, 'the stumble costs speed');
});

test('hurdle dash: a jump in the air is ignored', () => {
  const { inst, ctx } = run(hurdleDash, 3);
  inst.onInput(0, { type: 'jump' });
  ctx.advance(HURDLE_JUMP_MS / 2);
  const air = inst.view(0).runners[0].air;
  inst.onInput(0, { type: 'jump' });
  ctx.advance(50);
  assert.ok(inst.view(0).runners[0].air > air, 'still the same jump');
  ctx.advance(HURDLE_JUMP_MS);
  assert.equal(inst.view(0).runners[0].air, 0, 'landed');
});

test('hurdle dash: the runner who jumps well finishes first and wins', () => {
  const { inst, ctx, ended } = run(hurdleDash, 7);
  for (let t = 0; t < 30000 && !ended(); t += 50) {
    const v = inst.view(0);
    if (!v.runners[0].air && nextHurdle(v, 0) < v.runners[0].speed * 0.2) inst.onInput(0, { type: 'jump' });
    ctx.advance(50);
  }
  assert.deepEqual(ended(), { winner: 0 });
  assert.ok(inst.view(0).runners[0].pos >= LENGTH);
});

test('hurdle dash: at time up the runner further along wins; bad input is ignored', () => {
  const { inst, ctx, ended } = run(hurdleDash, 7);
  for (const bad of [null, {}, { type: 'jump', x: 1 }, { type: 'fly' }]) inst.onInput(0, bad || {});
  inst.onInput(5, { type: 'jump' });
  ctx.advance(3000);
  inst.onInput(1, { type: 'jump' }); // only player 2 jumps the early hurdles below
  for (let t = 0; t < 4000; t += 50) {
    const v = inst.view(0);
    if (!v.runners[1].air && nextHurdle(v, 1) < v.runners[1].speed * 0.2) inst.onInput(1, { type: 'jump' });
    ctx.advance(50);
  }
  const [a, b] = inst.view(0).runners;
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: a.pos === b.pos ? null : a.pos > b.pos ? 0 : 1 });
});

// ---- Laser Dodge ----

/** Plays a laser-dodge round with each player's own reaction; returns the instance. */
function laserBot(inst, ctx, ended, react, ms = 40000) {
  for (let t = 0; t < ms && !ended(); t += 25) {
    const v = inst.view(0);
    for (const slot of [0, 1]) {
      const beam = v.beams.find((b) => b.inMs > 0 && b.inMs <= 150);
      react[slot](slot, beam, v);
    }
    ctx.advance(25);
  }
}
const dodge = (inst) => (slot, beam) => {
  if (!beam) return inst.onInput(slot, { type: 'duck', on: false });
  if (beam.kind === 'low') inst.onInput(slot, { type: 'jump' });
  else inst.onInput(slot, { type: 'duck', on: true });
};

test('laser dodge: one set of beams for both, low and high, warned in advance', () => {
  const { inst, ctx } = run(laserDodge, 2);
  const kinds = new Set();
  for (let t = 0; t < 20000; t += 100) {
    inst.view(0).beams.forEach((b) => kinds.add(b.kind));
    assert.deepEqual(inst.view(1).beams, inst.view(0).beams);
    ctx.advance(100);
  }
  assert.deepEqual([...kinds].sort(), ['high', 'low']);
});

test('laser dodge: jump the low beams and duck the high ones; standing still gets hit', () => {
  const { inst, ctx, ended } = run(laserDodge, 2);
  laserBot(inst, ctx, ended, [dodge(inst), () => {}], 15000);
  const [a, b] = inst.view(0).players;
  assert.equal(a.lives, LIVES, 'never hit');
  assert.ok(b.lives < LIVES, 'hit');
});

test('laser dodge: the wrong move is a hit (jumping into a high beam, ducking under nothing)', () => {
  const { inst, ctx, ended } = run(laserDodge, 2);
  const wrong = (slot, beam) => {
    if (beam && beam.kind === 'high') inst.onInput(slot, { type: 'jump' });
    if (beam && beam.kind === 'low') inst.onInput(slot, { type: 'duck', on: true });
    if (!beam) inst.onInput(slot, { type: 'duck', on: false });
  };
  laserBot(inst, ctx, ended, [wrong, dodge(inst)], 8000);
  assert.ok(inst.view(0).players[0].lives < LIVES);
  assert.equal(inst.view(0).players[1].lives, LIVES);
});

test('laser dodge: one beam takes one life at most; out of lives, the other wins', () => {
  const { inst, ctx, ended } = run(laserDodge, 2);
  let lastLives = LIVES;
  let lastBeam = null;
  for (let t = 0; t < 40000 && !ended(); t += 25) {
    const v = inst.view(0);
    const active = v.beams.find((b) => b.inMs <= 0);
    if (active && v.players[1].lives < lastLives) {
      assert.notEqual(active.id, lastBeam, 'one life per beam');
      lastBeam = active.id;
      lastLives = v.players[1].lives;
    }
    const beam = v.beams.find((b) => b.inMs > 0 && b.inMs <= 150);
    dodge(inst)(0, beam);
    ctx.advance(25);
  }
  assert.deepEqual(ended(), { winner: 0 });
  assert.equal(inst.view(0).players[1].lives, 0);
});

test('laser dodge: at time up more lives wins, a tie is a draw; bad input ignored', () => {
  const { inst, ctx, ended } = run(laserDodge, 2);
  for (const bad of [{}, { type: 'duck', on: 'yes' }, { type: 'jump', slot: 1 }, { type: 'zap' }]) inst.onInput(0, bad);
  inst.onInput(2, { type: 'jump' });
  laserBot(inst, ctx, ended, [dodge(inst), dodge(inst)], 6000);
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

test('laser dodge: no jumping while ducking', () => {
  const { inst, ctx } = run(laserDodge, 2);
  inst.onInput(0, { type: 'duck', on: true });
  inst.onInput(0, { type: 'jump' });
  ctx.advance(LASER_JUMP_MS / 2);
  assert.equal(inst.view(0).players[0].air, false);
  assert.equal(inst.view(0).players[0].duck, true);
});

// ---- Pop the Most ----

test('pop the most: your colour +1, gold +3, spiky -2, theirs 0; the balloon pops', () => {
  const { inst, ctx } = run(popTheMost, 4);
  for (const [kind, who] of [['own', 0], ['gold', 'gold'], ['spike', 'spike'], ['theirs', 1]]) {
    ctx.advance(COOLDOWN_MS);
    const { x, y } = inst.view(0).cursors[0];
    const id = inst.debugBalloon({ x, y, who });
    const before = inst.view(0).points[0];
    inst.onInput(0, { type: 'pop' });
    assert.equal(inst.view(0).points[0] - before, POINTS[kind], kind);
    assert.ok(!inst.view(0).balloons.some((b) => b.id === id), kind + ' popped');
  }
});

test('pop the most: only a balloon under the crosshair pops, and not twice in a row', () => {
  const { inst, ctx } = run(popTheMost, 4);
  const { x, y } = inst.view(0).cursors[0];
  inst.debugBalloon({ x: x + GRAB_R * 3, y, who: 0 });
  inst.onInput(0, { type: 'pop' });
  assert.equal(inst.view(0).points[0], 0, 'too far away');
  ctx.advance(COOLDOWN_MS);
  inst.debugBalloon({ x, y, who: 0 });
  inst.debugBalloon({ x, y, who: 0 });
  inst.onInput(0, { type: 'pop' });
  inst.onInput(0, { type: 'pop' });
  assert.equal(inst.view(0).points[0], 1, 'the second press is too soon');
});

test('pop the most: the crosshair moves with the stick and stays on the field', () => {
  const { inst, ctx } = run(popTheMost, 4);
  inst.onInput(0, { type: 'move', x: 5, y: 0 }); // longer than 1: cut to full speed
  ctx.advance(5000);
  const c = inst.view(0).cursors[0];
  assert.ok(c.x <= 1 && c.x > 0.9, 'at the right edge');
  for (const bad of [{ type: 'move', x: 'a', y: 0 }, { type: 'move', x: NaN, y: 1 }, { type: 'move' }]) inst.onInput(0, bad);
  ctx.advance(500);
  assert.equal(inst.view(0).cursors[0].x, c.x);
});

test('pop the most: balloons float up and away; most points wins', () => {
  const { inst, ctx, ended } = run(popTheMost, 4);
  ctx.advance(3000);
  const seen = inst.view(0).balloons;
  assert.ok(seen.length > 0, 'balloons come up');
  const b = seen[0];
  ctx.advance(500);
  const later = inst.view(0).balloons.find((o) => o.id === b.id);
  assert.ok(!later || later.y < b.y, 'it rose');
  ctx.advance(20000);
  assert.ok(!inst.view(0).balloons.some((o) => o.id === b.id), 'gone off the top');
  const { x, y } = inst.view(0).cursors[1];
  inst.debugBalloon({ x, y, who: 1 });
  inst.onInput(1, { type: 'pop' });
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 1 });
});

test('hurdle dash: a short pause after landing before the next jump (no tapping through)', () => {
  const { inst, ctx } = run(hurdleDash, 3);
  inst.onInput(0, { type: 'jump' });
  ctx.advance(HURDLE_JUMP_MS + 50);
  assert.equal(inst.view(0).runners[0].air, 0, 'landed');
  inst.onInput(0, { type: 'jump' });
  ctx.advance(50);
  assert.equal(inst.view(0).runners[0].air, 0, 'too soon after landing');
  ctx.advance(LAND_MS);
  inst.onInput(0, { type: 'jump' });
  ctx.advance(50);
  assert.ok(inst.view(0).runners[0].air > 0, 'up again');
});

test('hurdle dash: a jump only clears a hurdle mid-air, not on the way down', () => {
  const { inst, ctx } = run(hurdleDash, 3);
  // Jump so the runner reaches the first hurdle right at the end of the jump.
  for (let t = 0; t < 10000; t += 50) {
    const v = inst.view(0);
    if (nextHurdle(v, 0) < v.runners[0].speed * (HURDLE_JUMP_MS - 30) / 1000) {
      inst.onInput(0, { type: 'jump' });
      break;
    }
    ctx.advance(50);
  }
  const first = inst.view(0).hurdles[0];
  for (let t = 0; t < 10000 && inst.view(0).runners[0].pos < first + 0.5; t += 50) ctx.advance(50);
  assert.equal(inst.view(0).runners[0].clipped, 1, 'too late in the jump: clipped');
});

test('laser dodge: sends an update only when something on screen changes', () => {
  const { inst, ctx, updates } = run(laserDodge, 2);
  ctx.advance(5000);
  assert.ok(updates() > 0);
  assert.ok(updates() < 5000 / 25 / 2, `${updates()} updates in 5 s`);
});

test('laser dodge: both out on the same beam is a draw', () => {
  const { inst, ctx, ended, ends } = run(laserDodge, 2);
  for (let t = 0; t < 40000 && !ended(); t += 25) ctx.advance(25);
  assert.deepEqual(ended(), { winner: null });
  assert.deepEqual(inst.view(0).players.map((p) => p.lives), [0, 0]);
  inst.onTimeUp();
  assert.equal(ends(), 2, 'the runner ignores the second end; the minigame stops ticking after the first');
});

test('pop the most: the hit zone is round on the TV (the field is twice as wide as tall)', () => {
  const { inst, ctx } = run(popTheMost, 4);
  const { x, y } = inst.view(0).cursors[0];
  const across = (GRAB_R / ASPECT) * 0.8; // inside, sideways
  const down = GRAB_R * 0.8; // inside, up/down
  inst.debugBalloon({ x: x + across, y, who: 0 });
  inst.onInput(0, { type: 'pop' });
  assert.equal(inst.view(0).points[0], 1, 'sideways, inside the ring');
  ctx.advance(COOLDOWN_MS);
  inst.debugBalloon({ x, y: y + down, who: 0 });
  inst.onInput(0, { type: 'pop' });
  assert.equal(inst.view(0).points[0], 2, 'below, inside the ring');
  ctx.advance(COOLDOWN_MS);
  inst.debugBalloon({ x: x + (GRAB_R / ASPECT) * 1.3, y, who: 0 });
  inst.onInput(0, { type: 'pop' });
  assert.equal(inst.view(0).points[0], 2, 'sideways, outside the ring');
});

test('pop the most: the crosshair moves as fast across as up and down', () => {
  const { inst, ctx } = run(popTheMost, 4);
  const start = inst.view(0).cursors[0];
  inst.onInput(0, { type: 'move', x: 1, y: 1 });
  ctx.advance(500);
  const c = inst.view(0).cursors[0];
  const dx = (c.x - start.x) * ASPECT; // in field heights
  const dy = c.y - start.y;
  assert.ok(Math.abs(dx - dy) < 0.02, `${dx} vs ${dy}`);
  assert.ok(dy > 0.3 * CURSOR_SPEED * 0.5);
});

test('pop the most: a points tie is a draw', () => {
  const { inst, ended } = run(popTheMost, 4);
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});
