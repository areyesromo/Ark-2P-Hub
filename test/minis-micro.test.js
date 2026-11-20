// The 15 micro-games of Micro Mayhem, each driven directly through its api.
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
import pickColour from '../server/games/minis/pick-colour.js';
import biggerNumber from '../server/games/minis/bigger-number.js';
import lightsOut from '../server/games/minis/lights-out.js';
import snap, { cardAt } from '../server/games/minis/snap.js';
import pumpIt from '../server/games/minis/pump-it.js';
import catchIt, { clawAt, BASKET } from '../server/games/minis/catch-it.js';
import dodgeBall, { laneAt } from '../server/games/minis/dodge-ball.js';

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

test('there are 15 micros with unique ids, all kind micro', () => {
  assert.equal(MICROS.length, 15);
  assert.equal(new Set(MICROS.map((m) => m.id)).size, 15);
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

test('shake-it: fewer shakes needed as the speed goes up (never below 6)', () => {
  const fast = (speed) => {
    const ctx = fakeCtx();
    const api = { players: ctx.players, rng: seeded(1), speed, now: ctx.now, elapsed: () => 0, update() {}, setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout, end() {} };
    return shakeIt.create(api).view(0).need;
  };
  assert.equal(fast(1), 15);
  assert.equal(fast(0.45), 7);
  assert.equal(fast(0.2), 6);
});

test('tap-it: a miss locks that player out for 300 ms (no free mashing)', () => {
  const { inst, ctx, ended } = run(tapIt);
  const { seed } = inst.view(0);
  ctx.advance(1000);
  let p = targetAt(1000, seed);
  inst.onInput(0, { type: 'tap', x: p.x > 0.5 ? p.x - 0.5 : p.x + 0.5, y: p.y, t: 1000 });
  ctx.advance(100);
  p = targetAt(1100, seed);
  inst.onInput(0, { type: 'tap', x: p.x, y: p.y, t: 1100 }); // locked out
  assert.equal(inst.view(0).res[0], null);
  ctx.advance(250);
  p = targetAt(1350, seed);
  inst.onInput(0, { type: 'tap', x: p.x, y: p.y, t: 1350 });
  assert.equal(inst.view(0).res[0], true);
  assert.equal(ended(), null);
});

test('pick-colour: the ink passes, the word (its trap) fails; the word is never its own ink', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { inst, ended } = run(pickColour, seed);
    const v = inst.view(0);
    assert.notEqual(v.word, v.ink);
    assert.ok(v.choices.includes(v.ink) && v.choices.includes(v.word) && new Set(v.choices).size === 4);
    inst.onInput(0, { type: 'pick', c: v.ink });
    inst.onInput(1, { type: 'pick', c: v.word });
    assert.deepEqual(ended(), { pass: [true, false] });
  }
});

test('bigger-number: three right in a row passes, one wrong fails', () => {
  const { inst, ended } = run(biggerNumber);
  const { pairs } = inst.view(0);
  assert.equal(pairs.length, 3);
  for (const [a, b] of pairs) {
    assert.notEqual(a, b);
    inst.onInput(0, { type: 'pick', side: a > b ? 0 : 1 });
  }
  assert.equal(ended(), null);
  const [a, b] = pairs[0];
  inst.onInput(1, { type: 'pick', side: a > b ? 1 : 0 });
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('lights-out: a tap just after the last light passes; before it (a jump) or too late fails', () => {
  const { inst, ctx, ended } = run(lightsOut);
  const { off, windowMs } = inst.view(0);
  assert.equal(off.length, 5);
  assert.ok(off.every((t, i) => i === 0 || t > off[i - 1]));
  ctx.advance(off[4] + windowMs + 100);
  inst.onInput(0, { type: 'tap', t: off[4] + 200 });
  inst.onInput(1, { type: 'tap', t: off[3] + 50 });
  assert.deepEqual(ended(), { pass: [true, false] });
  const late = run(lightsOut);
  const w = late.inst.view(0);
  late.ctx.advance(w.off[4] + w.windowMs + 300);
  late.inst.onInput(0, { type: 'tap', t: w.off[4] + w.windowMs + 200 });
  late.inst.onTimeUp();
  assert.deepEqual(late.ended(), { pass: [false, false] });
});

test('snap: one matching pair, the first good snap wins; a snap on the wrong card loses', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { inst, ctx, ended } = run(snap, seed);
    const { cards, stepMs } = inst.view(0);
    const pairs = cards.map((c, i) => (i > 0 && c.rank === cards[i - 1].rank ? i : -1)).filter((i) => i >= 0);
    assert.equal(pairs.length, 1, 'exactly one match');
    const match = pairs[0];
    assert.ok(match >= 2);
    ctx.advance(6000);
    assert.equal(cardAt(match * stepMs + 10, stepMs, cards.length), match);
    inst.onInput(1, { type: 'snap', t: (match - 1) * stepMs + 10 }); // too early: lost
    assert.equal(inst.view(0).res[1], false);
    inst.onInput(0, { type: 'snap', t: match * stepMs + 300 });
    assert.deepEqual(ended(), { pass: [true, false] });
  }
  // The first good snap takes it: the other is out.
  const r = run(snap, 3);
  const { cards, stepMs } = r.inst.view(0);
  const match = cards.findIndex((c, i) => i > 0 && c.rank === cards[i - 1].rank);
  r.ctx.advance(6000);
  r.inst.onInput(1, { type: 'snap', t: match * stepMs + 200 });
  assert.deepEqual(r.ended(), { pass: [false, true] });
});

test('pump-it: in the green at the end passes, short of it fails, past it bursts at once', () => {
  const { inst, ended } = run(pumpIt);
  const { zone } = inst.view(0);
  for (let i = 0; i < zone.from; i++) inst.onInput(0, { type: 'pump' });
  for (let i = 0; i < zone.to + 1; i++) inst.onInput(1, { type: 'pump' });
  assert.equal(inst.view(0).burst[1], true);
  assert.equal(inst.view(0).res[1], false);
  inst.onTimeUp();
  assert.deepEqual(ended(), { pass: [true, false] });
  const short = run(pumpIt);
  short.inst.onInput(0, { type: 'pump' });
  short.inst.onTimeUp();
  assert.deepEqual(short.ended(), { pass: [false, false] });
});

test('catch-it: let go over the basket passes, elsewhere fails', () => {
  const { inst, ctx, ended } = run(catchIt);
  const { periodMs, phase, basket } = inst.view(0);
  ctx.advance(4000);
  let tIn = 0;
  while (Math.abs(clawAt(tIn, periodMs, phase) - basket) > BASKET / 2) tIn++;
  let tOut = 0;
  while (Math.abs(clawAt(tOut, periodMs, phase) - basket) <= BASKET + 0.05) tOut++;
  inst.onInput(0, { type: 'drop', t: tIn });
  inst.onInput(1, { type: 'drop', t: tOut });
  assert.deepEqual(ended(), { pass: [true, false] });
});

test('dodge-ball: out of a ball\'s lane when it arrives you stay in; in it, you\'re out', () => {
  const { inst, ctx, ended } = run(dodgeBall);
  const { balls } = inst.view(0);
  assert.equal(balls[0].lane, 1, 'the first comes down the middle, where you start');
  assert.equal(laneAt([], 0), 1);
  // Player 1 steps out of each ball's lane just before it arrives; player 2 never moves.
  let lane = 1;
  for (const b of balls) {
    ctx.advance(b.hit - 300 - ctx.now());
    if (lane === b.lane) {
      const dir = lane === 2 ? 'up' : 'down';
      inst.onInput(0, { type: 'move', dir, t: ctx.now() });
      lane += dir === 'up' ? -1 : 1;
    }
    ctx.advance(600);
  }
  assert.equal(inst.view(0).res[1], false, 'the middle ball hit the one who stood still');
  inst.onTimeUp();
  assert.deepEqual(ended(), { pass: [true, false] });
});
