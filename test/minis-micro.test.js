// The 8 micro-games of Micro Mayhem, each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { MICROS } from '../server/games/minis/index.js';
import tapIt, { targetAt, TARGET_R } from '../server/games/minis/tap-it.js';
import stopIt, { needleAt } from '../server/games/minis/stop-it.js';
import shakeIt from '../server/games/minis/shake-it.js';
import oddOne from '../server/games/minis/odd-one.js';
import countEm from '../server/games/minis/count-em.js';
import swipeIt from '../server/games/minis/swipe-it.js';
import dontTouch from '../server/games/minis/dont-touch.js';
import quickMath from '../server/games/minis/quick-math.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Start a minigame on a fake clock; ended() is what it reported (first call only). */
function run(def, seed = 1) {
  const ctx = fakeCtx();
  let ended = null;
  let calls = 0;
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: ctx.now, elapsed: () => ctx.now(), update() {},
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { calls++; if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended, calls: () => calls };
}

test('there are 8 micros with unique ids, all kind micro', () => {
  assert.equal(MICROS.length, 8);
  assert.equal(new Set(MICROS.map((m) => m.id)).size, 8);
  for (const m of MICROS) {
    assert.equal(m.kind, 'micro');
    assert.ok(m.order && m.howTo && m.durationMs > 0, m.id);
  }
});

test('tap-it: a tap on the target passes, a miss does nothing, time-up fails', () => {
  const { inst, ctx, ended } = run(tapIt);
  const { seed } = inst.view(0);
  ctx.advance(800);
  const p = targetAt(800, seed);
  inst.onInput(0, { type: 'tap', x: p.x + TARGET_R * 0.5, y: p.y, t: 800 });
  inst.onInput(1, { type: 'tap', x: p.x > 0.5 ? p.x - 0.5 : p.x + 0.5, y: p.y, t: 800 });
  assert.equal(ended(), null);
  inst.onTimeUp();
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('stop-it: the needle in the zone passes, out of it fails', () => {
  const { inst, ctx, ended } = run(stopIt);
  const { zone, periodMs } = inst.view(0);
  ctx.advance(3000); // phone times are only believed up to the server's own clock
  const mid = (zone.from + zone.to) / 2;
  let tIn = 0;
  while (Math.abs(needleAt(tIn, periodMs) - mid) > 0.02) tIn++;
  let tOut = 0;
  while (needleAt(tOut, periodMs) >= zone.from - 0.05 && needleAt(tOut, periodMs) <= zone.to + 0.05) tOut++;
  assert.equal(needleAt(0, 1000), 0);
  assert.equal(needleAt(500, 1000), 1);
  inst.onInput(0, { type: 'stop', t: tIn });
  inst.onInput(1, { type: 'stop', t: tOut });
  inst.onInput(1, { type: 'stop', t: tIn }); // a second stop doesn't count
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('shake-it: 15 shakes pass; extra shakes are harmless', () => {
  const { inst, ended, calls } = run(shakeIt);
  for (let i = 0; i < 20; i++) inst.onInput(0, { type: 'shake' });
  assert.equal(inst.view(0).got[0], 15);
  for (let i = 0; i < 14; i++) inst.onInput(1, { type: 'shake' });
  assert.equal(ended(), null);
  inst.onTimeUp();
  assert.deepEqual(ended(), { pass: [true, false] });
  assert.equal(calls(), 1);
});

test('odd-one: the first pick counts', () => {
  const { inst, ended } = run(oddOne, 3);
  const { cells } = inst.view(0);
  const odd = cells.findIndex((c) => cells.filter((x) => x === c).length === 1);
  assert.ok(odd >= 0);
  assert.equal(cells.length, 9);
  inst.onInput(0, { type: 'pick', i: odd });
  inst.onInput(1, { type: 'pick', i: (odd + 1) % 9 });
  inst.onInput(1, { type: 'pick', i: odd });
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('count-em: the right number passes', () => {
  const { inst, ended } = run(countEm, 5);
  const { sheep, choices } = inst.view(0);
  assert.ok(sheep.length >= 3 && sheep.length <= 9);
  assert.equal(choices.length, 4);
  assert.ok(choices.includes(sheep.length));
  inst.onInput(0, { type: 'pick', n: choices.find((n) => n !== sheep.length) });
  inst.onInput(1, { type: 'pick', n: sheep.length });
  assert.deepEqual(ended(), { pass: [false, true] });
});

test('swipe-it: all three right passes, a wrong one fails', () => {
  const { inst, ended } = run(swipeIt, 9);
  const { arrows } = inst.view(0);
  assert.equal(arrows.length, 3);
  for (const dir of arrows) inst.onInput(0, { type: 'swipe', dir });
  inst.onInput(1, { type: 'swipe', dir: arrows[0] });
  inst.onInput(1, { type: 'swipe', dir: ['up', 'down', 'left', 'right'].find((d) => d !== arrows[1]) });
  assert.deepEqual(inst.view(0).done, [3, 1]);
  assert.deepEqual(ended(), { pass: [true, false] });
});

test("dont-touch: any input fails; the one who held still passes", () => {
  const { inst, ended } = run(dontTouch);
  inst.onInput(1, { type: 'touch' });
  assert.equal(ended(), null);
  inst.onTimeUp();
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('quick-math: the right answer passes', () => {
  const { inst, ended } = run(quickMath, 11);
  const { q, choices } = inst.view(0);
  const [a, op, b] = q.split(' ');
  const ans = op === '+' ? +a + +b : op === '−' ? a - b : a * b;
  assert.ok(ans >= 0);
  assert.equal(new Set(choices).size, 4);
  inst.onInput(0, { type: 'pick', n: ans });
  inst.onInput(1, { type: 'pick', n: 'x' }); // junk: ignored
  inst.onInput(1, { type: 'pick', n: choices.find((n) => n !== ans) });
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('every seed deals a fair puzzle (4 distinct choices incl. the answer, one odd cell)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const c = run(countEm, seed).inst.view(0);
    assert.equal(new Set(c.choices).size, 4, `count-em seed ${seed}`);
    assert.ok(c.choices.includes(c.sheep.length) && c.choices.every((n) => n >= 1));
    const m = run(quickMath, seed).inst.view(0);
    assert.equal(new Set(m.choices).size, 4, `quick-math seed ${seed}`);
    const o = run(oddOne, seed).inst.view(0);
    assert.equal(o.cells.filter((x) => x !== o.cells[0]).length === 1 || o.cells.filter((x) => x === o.cells[0]).length === 1, true);
    const s = run(stopIt, seed).inst.view(0);
    assert.ok(s.zone.from >= 0.1 && s.zone.to <= 0.9);
  }
});
