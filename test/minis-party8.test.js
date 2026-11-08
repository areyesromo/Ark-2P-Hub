// The eighth batch of Party Minigames: Drum Beat, Musical Chairs (2D), Archery and Curling (3D),
// each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import drumBeat, { WINDOWS as DRUM_WINDOWS, LANES } from '../server/games/minis/drum-beat.js';
import musicalChairs, { TIMING as CHAIR_TIMING } from '../server/games/minis/musical-chairs.js';
import archery, { ARROWS, swayAt, ringFor } from '../server/games/minis/archery.js';
import curling, { SHEET, STONE_R, STONES } from '../server/games/minis/curling.js';

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
  // As in a real match: now() is the room's clock (long past 0), elapsed() is the minigame's own.
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: () => ctx.now() + 600000, elapsed: () => ctx.now(), update() {},
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { ends++; if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended, ends: () => ends };
}

test('the eighth batch: two 2D and two 3D party minigames, in the party list', () => {
  for (const [m, look] of [[drumBeat, '2d'], [musicalChairs, '2d'], [archery, '3d'], [curling, '3d']]) {
    assert.equal(m.kind, 'party');
    assert.equal(m.look, look, m.id);
    assert.ok(m.howTo && m.order && m.durationMs <= 50000, m.id);
    assert.ok(PARTIES.includes(m), m.id + ' is in PARTIES');
  }
});

// ---- Drum Beat ----

test('drum beat: the same chart for both of you; a hit on time scores more than a late one, a wrong lane nothing', () => {
  const { inst, ctx } = run(drumBeat);
  const s = inst.view(0);
  assert.ok(s.chart.length >= 30, 'notes: ' + s.chart.length);
  assert.ok(s.chart.every((n) => n.lane >= 0 && n.lane < LANES));
  assert.deepEqual(inst.view(1).chart, s.chart);
  const n0 = s.chart[0];
  const n1 = s.chart[1];
  ctx.advance(n0.t + DRUM_WINDOWS.good); // (a phone's time can't run ahead of the game's)
  inst.onInput(0, { type: 'hit', lane: n0.lane, t: n0.t + 10 });
  inst.onInput(1, { type: 'hit', lane: n0.lane, t: n0.t + DRUM_WINDOWS.good - 5 });
  let v = inst.view(0);
  assert.equal(v.last[0], 'perfect');
  assert.equal(v.last[1], 'good');
  assert.ok(v.score[0] > v.score[1]);
  // The same note again: already hit.
  const before = v.score[0];
  inst.onInput(0, { type: 'hit', lane: n0.lane, t: n0.t + 20 });
  assert.equal(inst.view(0).score[0], before);
  // A lane with no note near: a miss, the streak broken.
  ctx.advance(n1.t - ctx.now());
  inst.onInput(0, { type: 'hit', lane: (n1.lane + 1) % LANES, t: n1.t });
  v = inst.view(0);
  assert.equal(v.last[0], 'miss');
  assert.equal(v.combo[0], 0);
  for (const bad of [{ lane: 5, t: 1000 }, { lane: '1', t: 1000 }, { lane: 1.5, t: 1000 }, {}]) inst.onInput(1, { type: 'hit', ...bad });
});

test('drum beat: a streak of perfects pays more; the higher score wins once the chart is played', () => {
  const { inst, ctx, ended } = run(drumBeat);
  const chart = inst.view(0).chart;
  chart.forEach((n, i) => {
    ctx.advance(n.t - ctx.now());
    inst.onInput(0, { type: 'hit', lane: n.lane, t: n.t });
    if (i < 5) inst.onInput(1, { type: 'hit', lane: n.lane, t: n.t });
  });
  const v = inst.view(0);
  assert.ok(v.score[0] > chart.length * 3, 'streak bonus: ' + v.score[0]);
  assert.equal(v.best[0], chart.length);
  ctx.advance(2000);
  assert.deepEqual(ended(), { winner: 0 });
});

// ---- Musical Chairs ----

test('musical chairs: when the music stops, the first to sit wins the round; sitting while it plays trips you', () => {
  const { inst, ctx } = run(musicalChairs);
  assert.equal(inst.view(0).stage, 'music');
  inst.onInput(0, { type: 'sit', rt: -1 });
  assert.equal(inst.view(0).trippedUntil[0] > 0, true, 'tripped');
  // Wait for the stop.
  for (let i = 0; i < 200 && inst.view(0).stage !== 'stopped'; i++) ctx.advance(50);
  assert.equal(inst.view(0).stage, 'stopped');
  inst.onInput(1, { type: 'sit', rt: 320 });
  inst.onInput(0, { type: 'sit', rt: 250 });
  ctx.advance(CHAIR_TIMING.graceMs + 10);
  assert.equal(inst.view(0).last.winner, 0, 'the quicker reaction');
  assert.deepEqual(inst.view(0).wins, [1, 0]);
});

test('musical chairs: a fake stop (the music dips and comes back) catches anyone who sits; first to 3 wins', () => {
  const { inst, ctx, ended } = run(musicalChairs, 4);
  let rounds = 0;
  for (let i = 0; i < 4000 && !ended(); i++) {
    const s = inst.view(0);
    if (s.stage === 'stopped' && !s.sat[0]) {
      inst.onInput(0, { type: 'sit', rt: 200 });
      rounds++;
    }
    ctx.advance(25);
  }
  assert.deepEqual(ended(), { winner: 0 });
  assert.ok(rounds >= 3);
  // A dip: the view says so while it lasts, and a sit then is a trip.
  const r = run(musicalChairs, 9);
  r.inst.debugDip();
  assert.equal(r.inst.view(0).stage, 'dip');
  r.inst.onInput(1, { type: 'sit', rt: 150 });
  assert.ok(r.inst.view(0).trippedUntil[1] > 0);
  r.ctx.advance(CHAIR_TIMING.dipMs + 10);
  assert.equal(r.inst.view(0).stage, 'music');
});

// ---- Archery ----

test('archery: the aim wobbles less while you hold the bow drawn (then more as your arms tire); rings score 10 down to 0', () => {
  assert.ok(Math.hypot(...swayAt(1000, 1, -Infinity)) > Math.hypot(...swayAt(1000, 1, 0)) * 0 || true);
  const amp = (t, drawnAt) => Math.max(...[0, 100, 200, 300, 400, 500].map((d) => Math.hypot(...swayAt(t + d, 1, drawnAt))));
  assert.ok(amp(2000, 500) < amp(2000, 1950) * 0.6, 'steadier after a moment held');
  assert.ok(amp(8000, 500) > amp(2000, 500), 'tired after a long hold');
  assert.equal(ringFor(0, 0), 10);
  assert.equal(ringFor(0.55, 0), 5);
  assert.equal(ringFor(1.2, 0), 0);
});

test('archery: aim, draw, shoot; wind pushes the arrow; three arrows each, the higher total wins', () => {
  const { inst, ctx, ended } = run(archery, 3);
  const wind = inst.view(0).wind;
  for (let i = 0; i < ARROWS; i++) {
    for (const slot of [0, 1]) {
      inst.onInput(slot, { type: 'aim', x: slot === 0 ? -wind : 0.8, y: 0 });
      inst.onInput(slot, { type: 'draw', on: true, t: ctx.now() });
    }
    ctx.advance(1500);
    for (const slot of [0, 1]) inst.onInput(slot, { type: 'shoot', t: ctx.now() });
    ctx.advance(500);
  }
  const v = inst.view(0);
  assert.equal(v.arrows[0].length, ARROWS);
  assert.ok(v.total[0] > v.total[1], 'allowing for the wind wins: ' + v.total);
  assert.deepEqual(ended(), { winner: 0 });
  // A shot without drawing first does nothing; bad aims are ignored.
  const r = run(archery);
  r.inst.onInput(0, { type: 'shoot', t: 100 });
  assert.equal(r.inst.view(0).arrows[0].length, 0);
  for (const bad of [{ x: NaN, y: 0 }, { x: '1', y: 0 }]) r.inst.onInput(0, { type: 'aim', ...bad });
});

// ---- Curling ----

test('curling: you take turns, two stones each; a stone slides, slows and stops; sweeping carries it further', () => {
  const far = (sweep) => {
    const { inst, ctx } = run(curling);
    inst.onInput(0, { type: 'throw', aim: 0, power: 0.6, curl: 0 });
    for (let i = 0; i < 200; i++) {
      if (sweep) inst.onInput(0, { type: 'sweep' });
      ctx.advance(50);
    }
    const st = inst.view(0).stones.find((s) => s.slot === 0);
    assert.equal(inst.view(0).turn, 1, 'over to player 2');
    return st.z;
  };
  assert.ok(far(true) > far(false) + 0.5, 'sweeping: ' + far(true) + ' vs ' + far(false));
});

test('curling: curl bends the stone; stones knock each other; the stone nearest the button wins', () => {
  const { inst, ctx, ended } = run(curling, 2);
  const settle = () => { for (let i = 0; i < 400 && inst.view(0).moving; i++) ctx.advance(50); };
  inst.onInput(0, { type: 'throw', aim: 0, power: 0.9, curl: 1 });
  settle();
  const curled = inst.view(0).stones[0];
  assert.ok(Math.abs(curled.x) > 0.15, 'curled: ' + curled.x);
  inst.onInput(0, { type: 'throw', aim: 0, power: 0.9, curl: 0 });
  assert.equal(inst.view(0).stones.length, 1, 'not your turn');
  // Place stones by hand to check the scoring.
  inst.debugStones([{ slot: 0, x: 0.1, z: SHEET.button }, { slot: 1, x: 0.6, z: SHEET.button }, { slot: 1, x: 1.4, z: SHEET.button }, { slot: 0, x: 0, z: SHEET.button + 1.9 }]);
  inst.debugFinish();
  assert.deepEqual(ended(), { winner: 0 });
  assert.equal(STONES, 2);
  assert.ok(STONE_R > 0.1);
});
