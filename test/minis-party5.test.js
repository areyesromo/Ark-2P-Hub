// The fifth batch of Party Minigames (2D, touch & feel): Safe Cracker, Reflex Grid, Mirror Me,
// each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import safeCracker, { DIAL, WRONG_MS, FIRST_AWAY, TRAVEL } from '../server/games/minis/safe-cracker.js';
import reflexGrid, { CELLS } from '../server/games/minis/reflex-grid.js';
import { poolFor } from '../server/games/party-minis.js';
import mirrorMe, { DOTS, ROUNDS, SHOW_MS, DRAW_MS, REVEAL_MS, adjacent } from '../server/games/minis/mirror-me.js';

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

test('the fifth batch: party minigames in 2D, in the party list', () => {
  for (const m of [safeCracker, reflexGrid, mirrorMe]) {
    assert.equal(m.kind, 'party');
    assert.equal(m.look, '2d');
    assert.ok(m.howTo && m.order && m.durationMs <= 45000, m.id);
    assert.ok(PARTIES.includes(m), m.id + ' is in PARTIES');
  }
});

// ---- Safe Cracker ----

/** Turns `slot`'s dial to `n` the short way, one step at a time like a controller. */
function turnTo(inst, slot, n) {
  for (let i = 0; i < DIAL && inst.view(slot).dial !== n; i++) {
    const d = (n - inst.view(slot).dial + DIAL) % DIAL;
    inst.onInput(slot, { type: 'turn', by: d <= DIAL / 2 ? 1 : -1 });
  }
}

/** Turns needed, the short way round, from one number to the next. */
const dist = (a, b) => Math.min((a - b + DIAL) % DIAL, (b - a + DIAL) % DIAL);

test('safe cracker: equally hard: the same distance to the first number and the same total turning', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { inst } = run(safeCracker, seed);
    const [a, b] = [inst.debugCombo(0), inst.debugCombo(1)];
    assert.equal(dist(inst.view(0).dial, a[0]), FIRST_AWAY, 'from the start to the first number');
    assert.equal(dist(inst.view(1).dial, b[0]), FIRST_AWAY);
    const travel = (c) => dist(c[0], c[1]) + dist(c[1], c[2]);
    assert.equal(travel(a), TRAVEL);
    assert.equal(travel(b), TRAVEL);
  }
});

test('safe cracker: your rival\'s numbers tell you nothing about yours (each safe spaced its own way)', () => {
  let differ = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { inst } = run(safeCracker, seed);
    const gap = (c) => dist(c[0], c[1]);
    if (gap(inst.debugCombo(0)) !== gap(inst.debugCombo(1))) differ++;
  }
  assert.ok(differ >= 15, `${differ} of 20 differ`);
});

test('safe cracker: the dial clicks only on your next number; TRY there opens one lock', () => {
  const { inst } = run(safeCracker, 3);
  const combo = inst.debugCombo(0);
  turnTo(inst, 0, (combo[0] + 1) % DIAL);
  assert.equal(inst.view(0).click, false);
  turnTo(inst, 0, combo[0]);
  assert.equal(inst.view(0).click, true, 'clicks on the number');
  inst.onInput(0, { type: 'try' });
  assert.equal(inst.view(0).opened, 1);
  assert.equal(inst.view(0).click, false, 'the next number is a different one');
});

test('safe cracker: a wrong TRY locks you out for a moment, and the screens hear when it ends', () => {
  const { inst, ctx, updates } = run(safeCracker, 3);
  const combo = inst.debugCombo(0);
  turnTo(inst, 0, (combo[0] + 5) % DIAL);
  inst.onInput(0, { type: 'try' });
  assert.equal(inst.view(0).locked, true);
  turnTo(inst, 0, combo[0]);
  assert.notEqual(inst.view(0).dial, combo[0], 'the dial is stuck while locked');
  const before = updates();
  ctx.advance(WRONG_MS);
  assert.ok(updates() > before, 'an update when the jam ends');
  assert.equal(inst.view(0).locked, false);
  turnTo(inst, 0, combo[0]);
  inst.onInput(0, { type: 'try' });
  assert.equal(inst.view(0).opened, 1);
});

test('safe cracker: opening all three wins; the TV never sees a combination', () => {
  const { inst, ended } = run(safeCracker, 3);
  const combo = inst.debugCombo(1);
  for (const n of combo) {
    turnTo(inst, 1, n);
    inst.onInput(1, { type: 'try' });
  }
  assert.deepEqual(ended(), { winner: 1 });
  const tv = JSON.stringify(run(safeCracker, 3).inst.view(null));
  assert.ok(!/combo/.test(tv));
});

test('safe cracker: at time up more locks opened wins; bad input is ignored', () => {
  const { inst, ended } = run(safeCracker, 3);
  const start = inst.view(0).dial;
  for (const bad of [{ type: 'turn', by: 0 }, { type: 'turn', by: 99 }, { type: 'turn', by: 1.5 }, { type: 'turn' }, { type: 'spin' }]) inst.onInput(0, bad);
  assert.equal(inst.view(0).dial, start);
  for (let i = 0; i <= start; i++) inst.onInput(0, { type: 'turn', by: -1 });
  assert.equal(inst.view(0).dial, DIAL - 1, 'the dial wraps round');
  const combo = inst.debugCombo(0);
  turnTo(inst, 0, combo[0]);
  inst.onInput(0, { type: 'try' });
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 0 });
});

// ---- Reflex Grid ----

test('reflex grid: the same lights for both; hitting a lit square +1, a dark one -1', () => {
  const { inst, ctx } = run(reflexGrid, 5);
  let lit = null;
  for (let t = 0; t < 5000 && !lit; t += 50) {
    ctx.advance(50);
    lit = inst.view(0).lights[0];
  }
  assert.ok(lit);
  assert.deepEqual(inst.view(1).lights, inst.view(0).lights, 'one set of lights');
  inst.onInput(0, { type: 'tap', cell: lit.cell });
  inst.onInput(1, { type: 'tap', cell: lit.cell });
  assert.deepEqual(inst.view(0).points, [1, 1], 'both can score the same light');
  inst.onInput(0, { type: 'tap', cell: lit.cell });
  assert.equal(inst.view(0).points[0], 1, 'a second tap on a light you got is ignored');
  const dark = [...Array(CELLS).keys()].find((c) => !inst.view(0).lights.some((l) => l.cell === c));
  inst.onInput(1, { type: 'tap', cell: dark });
  assert.equal(inst.view(0).points[1], 0);
});

test('reflex grid: lights fade, faster as it goes', () => {
  const { inst, ctx } = run(reflexGrid, 5);
  const lifeOf = (from, to) => {
    const life = [];
    for (let t = from; t < to; t += 50) {
      ctx.advance(50);
      inst.view(0).lights.forEach((l) => life.push(l.life));
    }
    return Math.max(...life);
  };
  const early = lifeOf(0, 5000);
  ctx.advance(15000);
  const late = lifeOf(20000, 28000);
  assert.ok(late < early, `${late} < ${early}`);
});

test('reflex grid: most points wins; bad taps are ignored', () => {
  const { inst, ended } = run(reflexGrid, 5);
  for (const bad of [{ type: 'tap' }, { type: 'tap', cell: 9 }, { type: 'tap', cell: -1 }, { type: 'tap', cell: 1.5 }]) inst.onInput(0, bad);
  assert.deepEqual(inst.view(0).points, [0, 0]);
  inst.onInput(1, { type: 'tap', cell: 0 }); // nothing lit yet: -1
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 0 });
});

// ---- Mirror Me ----

/** The shape's lines during the show stage. */
const shapeOf = (inst) => inst.view(null).shape;

test('mirror me: a shape of joined neighbouring dots, shown, then hidden while you draw', () => {
  const { inst, ctx } = run(mirrorMe, 2);
  const v = inst.view(null);
  assert.equal(v.stage, 'show');
  assert.equal(v.round, 1);
  assert.equal(v.shape.length, 3, 'three lines in round 1');
  v.shape.forEach(([a, b]) => assert.ok(adjacent(a, b), `${a}-${b} are neighbours`));
  assert.deepEqual(inst.view(0).shape, v.shape, 'the phones see it too');
  ctx.advance(SHOW_MS);
  assert.equal(inst.view(null).stage, 'draw');
  assert.equal(inst.view(0).shape, null, 'hidden while drawing');
  assert.equal(inst.view(null).shape, null);
});

test('mirror me: you only see your own lines while drawing; the TV only the counts', () => {
  const { inst, ctx } = run(mirrorMe, 2);
  const [first] = shapeOf(inst);
  ctx.advance(SHOW_MS);
  inst.onInput(0, { type: 'line', a: first[0], b: first[1] });
  assert.deepEqual(inst.view(0).mine, [first]);
  assert.deepEqual(inst.view(1).mine, []);
  assert.ok(!('lines' in inst.view(1)) || inst.view(1).lines === null, 'not the rival\'s lines');
  assert.deepEqual(inst.view(null).counts, [1, 0]);
  assert.equal(inst.view(null).lines, null);
});

test('mirror me: right lines +1, wrong ones -1 (not below 0 a round); the reveal shows both', () => {
  const { inst, ctx } = run(mirrorMe, 2);
  const shape = shapeOf(inst);
  ctx.advance(SHOW_MS);
  shape.forEach(([a, b]) => inst.onInput(0, { type: 'line', a: b, b: a })); // either way round
  const wrong = [...Array(DOTS).keys()].flatMap((a) => [...Array(DOTS).keys()].filter((b) => b > a && adjacent(a, b)).map((b) => [a, b]))
    .filter(([a, b]) => !shape.some(([x, y]) => x === a && y === b));
  inst.onInput(1, { type: 'line', a: wrong[0][0], b: wrong[0][1] });
  inst.onInput(0, { type: 'done' });
  inst.onInput(1, { type: 'done' });
  const v = inst.view(null);
  assert.equal(v.stage, 'reveal', 'both done: reveal at once');
  assert.deepEqual(v.roundPoints, [3, 0]);
  assert.deepEqual(v.lines[0].length, 3);
  assert.deepEqual(v.shape, shape, 'the shape is shown again');
  ctx.advance(REVEAL_MS);
  assert.equal(inst.view(null).round, 2);
  assert.equal(inst.view(null).shape.length, 4, 'one line longer');
});

test('mirror me: lines must join neighbours, once each; undo takes the last one off', () => {
  const { inst, ctx } = run(mirrorMe, 2);
  ctx.advance(SHOW_MS);
  for (const bad of [{ type: 'line', a: 0, b: 15 }, { type: 'line', a: 0, b: 0 }, { type: 'line', a: -1, b: 0 }, { type: 'line', a: 0 }, { type: 'line', a: 0, b: 1.5 }]) inst.onInput(0, bad);
  assert.deepEqual(inst.view(0).mine, []);
  inst.onInput(0, { type: 'line', a: 0, b: 1 });
  inst.onInput(0, { type: 'line', a: 1, b: 0 });
  assert.equal(inst.view(0).mine.length, 1, 'no duplicates');
  inst.onInput(0, { type: 'line', a: 1, b: 5 });
  inst.onInput(0, { type: 'undo' });
  assert.deepEqual(inst.view(0).mine, [[0, 1]]);
});

test('mirror me: three rounds, then the most points wins (drawing ends with the clock)', () => {
  const { inst, ctx, ended } = run(mirrorMe, 2);
  for (let r = 0; r < ROUNDS; r++) {
    const shape = shapeOf(inst);
    ctx.advance(SHOW_MS);
    shape.forEach(([a, b]) => inst.onInput(1, { type: 'line', a, b }));
    ctx.advance(DRAW_MS); // nobody presses done: time runs out
    assert.equal(inst.view(null).stage, 'reveal');
    ctx.advance(REVEAL_MS);
  }
  assert.deepEqual(ended(), { winner: 1 });
  assert.ok(ROUNDS * (SHOW_MS + DRAW_MS + REVEAL_MS) <= mirrorMe.durationMs, 'fits in its time');
});

test('reflex grid: a tap counts from when it was made on the phone (not when it arrived)', () => {
  const { inst, ctx } = run(reflexGrid, 5);
  let lit = null;
  let litAt = 0;
  for (let t = 0; t < 5000 && !lit; t += 50) {
    ctx.advance(50);
    lit = inst.view(0).lights[0];
    litAt = ctx.now();
  }
  ctx.advance(lit.left + 100); // the light has gone out by the time the tap arrives
  inst.onInput(0, { type: 'tap', cell: lit.cell, t: litAt + 50 });
  assert.equal(inst.view(0).points[0], 1);
});

test('reflex grid: a square is never lit twice at once', () => {
  const { inst, ctx } = run(reflexGrid, 9);
  for (let t = 0; t < 30000; t += 50) {
    ctx.advance(50);
    const cells = inst.view(0).lights.map((l) => l.cell);
    assert.equal(new Set(cells).size, cells.length, 'at ' + t);
  }
});

test('mirror me is phones only (a controller player would draw in plain sight on the TV)', () => {
  assert.equal(mirrorMe.phoneOnly, true);
  assert.ok(!poolFor(PARTIES, 'mix', [{ local: false }, { local: true }]).includes(mirrorMe));
});
