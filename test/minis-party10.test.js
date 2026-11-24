// Bubble Pop, Bridge Builder, Pancake Flip and Cup Stack, driven directly through their api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { seeded } from './helpers-bots.js';
import { PARTIES } from '../server/games/minis/index.js';
import bubblePop, { COLS, ROWS, GOLD, GREY, COOLDOWN_MS, clump, worth } from '../server/games/minis/bubble-pop.js';

function run(def, seed = 1) {
  const ctx = fakeCtx();
  let ended = null;
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: () => ctx.now() + 600000, elapsed: () => ctx.now(), update() {},
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended };
}

test('bubble-pop: a 2D party minigame in the party list', () => {
  assert.equal(bubblePop.kind, 'party');
  assert.equal(bubblePop.look, '2d');
  assert.ok(PARTIES.includes(bubblePop));
  assert.ok(bubblePop.durationMs <= 80000 && bubblePop.howTo && bubblePop.order);
});

test('bubble-pop: a clump is touching bubbles of one colour, gold joining either; grey clumps only themselves', () => {
  const k = new Array(COLS * ROWS).fill(GREY);
  k[0] = 0; k[1] = GOLD; k[2] = 0; k[2 + COLS] = 0; k[3] = 1;
  assert.deepEqual(clump(k, 0).sort((a, b) => a - b), [0, 1, 2, 2 + COLS]);
  assert.deepEqual(clump(k, 3), [3], 'alone');
  assert.deepEqual(clump(k, 1), [], 'tapping gold itself does nothing');
  assert.equal(worth(k, clump(k, 0), 0), 4 + 1, 'four bubbles, one gold counted twice');
  assert.equal(worth(k, clump(k, 0), 1), -1, 'theirs costs a point');
  assert.equal(clump(k, 5 * COLS + 3).every((c) => k[c] === GREY), true);
  assert.equal(worth(k, clump(k, 5 * COLS + 3), 0), 0);
});

test('bubble-pop: a pop scores, the bubbles above fall, new ones drop in; a lone bubble, a stale tap or a quick second tap does nothing', () => {
  const { inst, ctx } = run(bubblePop);
  let v = inst.view();
  const kinds = () => inst.view().grid.map((b) => b[1]);
  // Find a clump of player 1's colour to pop.
  let cell = -1;
  for (let c = 0; c < COLS * ROWS && cell < 0; c++) if (kinds()[c] === 0 && clump(kinds(), c).length >= 2) cell = c;
  assert.ok(cell >= 0);
  const cells = clump(kinds(), cell);
  const w = worth(kinds(), cells, 0);
  inst.onInput(0, { type: 'pop', cell, id: v.grid[cell][0] + 9999 }); // a bubble that isn't there any more
  assert.equal(inst.view().points[0], 0);
  inst.onInput(0, { type: 'pop', cell, id: v.grid[cell][0] });
  v = inst.view();
  assert.equal(v.points[0], w);
  assert.equal(v.grid.length, COLS * ROWS, 'the grid is full again');
  assert.equal(v.pops[0].cells.length, cells.length);
  const ids = new Set(v.grid.map((b) => b[0]));
  assert.equal(ids.size, COLS * ROWS);
  for (const bad of [-1, COLS * ROWS, 2.5, 'x']) inst.onInput(1, { type: 'pop', cell: bad });
  let again = -1;
  for (let c = 0; c < COLS * ROWS && again < 0; c++) if (kinds()[c] === 0 && clump(kinds(), c).length >= 2) again = c;
  if (again >= 0) {
    inst.onInput(0, { type: 'pop', cell: again });
    assert.equal(inst.view().points[0], w, 'too soon');
    ctx.advance(COOLDOWN_MS);
    inst.onInput(0, { type: 'pop', cell: again });
    assert.ok(inst.view().points[0] > w);
  }
});

test('bubble-pop: time up, more points wins; level is a draw', () => {
  const { inst, ended } = run(bubblePop);
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

import bridgeBuilder, { SPOTS, LIMIT, TURN_MS, CART_MS, BETWEEN_MS, lean, cartLoser } from '../server/games/minis/bridge-builder.js';

test('bridge-builder: a 2D party minigame in the party list', () => {
  assert.equal(bridgeBuilder.kind, 'party');
  assert.ok(PARTIES.includes(bridgeBuilder));
  assert.ok(bridgeBuilder.durationMs <= 80000 && bridgeBuilder.howTo && bridgeBuilder.order);
});

test('bridge-builder: the lean is weight times distance; full, the heavier side loses (level: nobody)', () => {
  const placed = new Array(SPOTS.length).fill(0);
  placed[0] = 2; // -4: -8
  placed[7] = 1; // +4: +4
  assert.equal(lean(placed), -4);
  assert.equal(cartLoser(-4), 0);
  assert.equal(cartLoser(3), 1);
  assert.equal(cartLoser(0), null);
});

test('bridge-builder: turns take a spot each; tip it and you lose the round; a full bridge goes to the cart', () => {
  const { inst, ctx } = run(bridgeBuilder, 3);
  let v = inst.view();
  const first = v.turn;
  inst.onInput(1 - first, { type: 'place', spot: 3 }); // not their turn
  for (const spot of [-1, 8, 1.5, 'x']) inst.onInput(first, { type: 'place', spot });
  assert.equal(inst.view().n, 0);
  inst.onInput(first, { type: 'place', spot: 3 });
  v = inst.view();
  assert.equal(v.n, 1);
  assert.equal(v.turn, 1 - first);
  inst.onInput(v.turn, { type: 'place', spot: 3 }); // taken
  assert.equal(inst.view().n, 1);
  // Out of time: the clock places it (somewhere that doesn't tip it).
  ctx.advance(TURN_MS);
  assert.equal(inst.view().n, 2);
  assert.ok(Math.abs(inst.view().lean) <= LIMIT);
});

test('bridge-builder: tipping loses; the first to two rounds wins', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { inst, ctx, ended } = run(bridgeBuilder, seed);
    let v = inst.view();
    // Load one end till it tips (crates of 3 at 4 out tip it at once; lighter ones a crate or two later).
    for (let k = 0; k < 4 && v.phase === 'place'; k++) {
      const spot = v.placed[7] ? (v.placed[6] ? 5 : 6) : 7;
      inst.onInput(v.turn, { type: 'place', spot });
      v = inst.view();
    }
    if (v.phase !== 'roundEnd' || v.result.how !== 'tip') continue;
    assert.equal(v.result.loser, v.last.by, 'whoever tipped it');
    assert.deepEqual(v.wins[1 - v.last.by], 1);
    ctx.advance(BETWEEN_MS);
    assert.equal(inst.view().round, 2);
    assert.equal(ended(), null);
    return;
  }
  assert.fail('no seed tipped');
});

test('bridge-builder: a full bridge: the cart rolls, then the heavier side loses', () => {
  const { inst, ctx } = run(bridgeBuilder, 5);
  for (let k = 0; k < SPOTS.length; k++) {
    const v = inst.view();
    if (v.phase !== 'place') break;
    // Each places where it least tips (inner spots first, alternating sides).
    const order = [3, 4, 2, 5, 1, 6, 0, 7].filter((i) => !v.placed[i]);
    const spot = order.find((i) => Math.abs(v.lean + v.crates[v.n] * SPOTS[i]) <= LIMIT) ?? order[0];
    inst.onInput(v.turn, { type: 'place', spot });
  }
  const v = inst.view();
  if (v.phase === 'cart') {
    ctx.advance(CART_MS);
    const r = inst.view().result;
    assert.equal(r.how, 'cart');
    assert.equal(r.loser, cartLoser(r.lean));
  } else {
    assert.equal(v.result.how, 'tip');
  }
});

import pancakeFlip, { COOK_MS, RAW, GOLDEN, AIR_MS, RISE_MS, NEXT_MS, WOBBLES, tiltAt, spinFor } from '../server/games/minis/pancake-flip.js';

test('pancake-flip: a 2D party minigame in the party list', () => {
  assert.equal(pancakeFlip.kind, 'party');
  assert.ok(PARTIES.includes(pancakeFlip));
  assert.ok(pancakeFlip.durationMs <= 80000 && pancakeFlip.howTo && pancakeFlip.order);
});

test('pancake-flip: the spin is flat every half turn', () => {
  assert.equal(tiltAt(0, 540), 0);
  assert.equal(tiltAt(1000 / 3, 540), 0, 'half a turn');
  assert.equal(tiltAt(1000 / 6, 540), 90, 'on its edge');
  assert.ok(spinFor(5) > spinFor(0), 'faster with a taller stack');
});

/** Flip `slot`'s pancake at `done` of the cook, then catch it `ms` after the flip. */
function flipCatch(inst, ctx, slot, done, ms) {
  const p = inst.view().pans[slot];
  ctx.advance(Math.max(0, p.cookAt + COOK_MS * done - ctx.now()));
  inst.onInput(slot, { type: 'flip' });
  if (inst.view().pans[slot].stage !== 'air') return;
  ctx.advance(ms);
  inst.onInput(slot, { type: 'catch' });
}

test('pancake-flip: golden flip and a flat catch stacks it; too soon it splats; too late it burns', () => {
  const { inst, ctx } = run(pancakeFlip);
  const flat = (1000 * 180) / spinFor(0) * 2; // the second flat moment (the first is still rising)
  assert.ok(flat > RISE_MS);
  flipCatch(inst, ctx, 0, (GOLDEN[0] + GOLDEN[1]) / 2, flat);
  let p = inst.view().pans[0];
  assert.deepEqual(p.stack, [true], 'one golden pancake');
  assert.equal(p.last.kind, 'flat');
  ctx.advance(NEXT_MS);
  flipCatch(inst, ctx, 0, RAW / 2, 0);
  assert.equal(inst.view().pans[0].last.kind, 'raw');
  ctx.advance(NEXT_MS + COOK_MS);
  assert.equal(inst.view().pans[0].last.kind, 'burnt');
  assert.equal(inst.view().pans[0].stack.length, 1);
});

test('pancake-flip: a catch while it is still rising does nothing; no catch drops it; crooked ones wobble it over', () => {
  const { inst, ctx } = run(pancakeFlip);
  const p0 = inst.view().pans[1];
  ctx.advance(p0.cookAt + COOK_MS * 0.6 - ctx.now());
  inst.onInput(1, { type: 'flip' });
  ctx.advance(RISE_MS / 2);
  inst.onInput(1, { type: 'catch' });
  assert.equal(inst.view().pans[1].stage, 'air', 'too early to catch');
  ctx.advance(AIR_MS);
  assert.equal(inst.view().pans[1].last.kind, 'drop');
  // Crooked catches: 35 degrees off flat.
  let crooked = 0;
  for (let i = 0; i < 12 && crooked < WOBBLES + 2; i++) {
    ctx.advance(NEXT_MS);
    const spin = spinFor(inst.view().pans[1].stack.length);
    const ms = (1000 * 180) / spin * 2 + (1000 * 35) / spin;
    flipCatch(inst, ctx, 1, 0.6, ms);
    if (['crooked', 'topple'].includes(inst.view().pans[1].last.kind)) crooked++;
    if (inst.view().pans[1].last.kind === 'topple') break;
  }
  const p = inst.view().pans[1];
  assert.equal(p.last.kind, 'topple', 'the third wobble topples half the stack');
  assert.equal(p.stack.length, Math.floor(WOBBLES / 2));
  assert.equal(p.wobble, 0);
});

test('pancake-flip: time up, the tallest stack wins; the same height, more golden ones', () => {
  const { inst, ctx, ended } = run(pancakeFlip);
  flipCatch(inst, ctx, 0, 0.6, (1000 * 360) / spinFor(0));
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 0 });
});

import hotAirRace, { LIFT, SINK, BANDS, bandOf, GROUND_SPEED, SHIFT_MS } from '../server/games/minis/hot-air-race.js';

test('hot-air-race: a 2D party minigame in the party list', () => {
  assert.equal(hotAirRace.kind, 'party');
  assert.ok(PARTIES.includes(hotAirRace));
  assert.ok(hotAirRace.durationMs <= 80000 && hotAirRace.howTo && hotAirRace.order);
});

test('hot-air-race: burning lifts, letting go sinks; the wind depends on the height; the bands change', () => {
  const { inst, ctx } = run(hotAirRace, 4);
  ctx.advance(100);
  let v = inst.view();
  assert.equal(v.winds.length, BANDS);
  assert.equal(Math.max(...v.winds), 4, 'one band has the fastest wind');
  assert.equal(v.balloons[0].y, 0);
  const crawl = v.balloons[0].x;
  assert.ok(Math.abs(crawl - GROUND_SPEED * 0.1) < 0.05, 'on the ground: crawling');
  inst.onInput(0, { type: 'burn', on: true });
  inst.onInput(0, { type: 'burn', on: 'yes' }); // (only true burns)
  inst.onInput(0, { type: 'burn', on: true });
  ctx.advance(1000);
  v = inst.view();
  assert.ok(Math.abs(v.balloons[0].y - LIFT) < 0.06, 'rose');
  inst.onInput(0, { type: 'burn', on: false });
  ctx.advance(500);
  assert.ok(inst.view().balloons[0].y < v.balloons[0].y - SINK * 0.4, 'sinks');
  assert.equal(bandOf(0.99), BANDS - 1);
  assert.equal(bandOf(0.05), 0);
  const shifts = inst.view().shifts;
  ctx.advance(SHIFT_MS);
  assert.equal(inst.view().shifts, shifts + 1);
});

test('hot-air-race: the first to the flag wins; at time up, the one further on', () => {
  const { inst, ctx, ended } = run(hotAirRace, 2);
  inst.onInput(1, { type: 'burn', on: true });
  ctx.advance(60000);
  assert.deepEqual(ended(), { winner: 1 });
  const t = run(hotAirRace, 3);
  t.inst.onInput(0, { type: 'burn', on: true });
  t.ctx.advance(3000);
  t.inst.onTimeUp();
  assert.deepEqual(t.ended(), { winner: 0 });
});

import cupStack, { STACKS, TOTAL, FUMBLE_MS, segments } from '../server/games/minis/cup-stack.js';

test('cup-stack: a 2D party minigame in the party list; three pyramids up and down', () => {
  assert.equal(cupStack.kind, 'party');
  assert.ok(PARTIES.includes(cupStack));
  assert.ok(cupStack.durationMs <= 80000 && cupStack.howTo && cupStack.order);
  assert.equal(TOTAL, STACKS.reduce((a, n) => a + 2 * n, 0));
  assert.deepEqual(segments()[1], { size: 6, from: 6, peak: 12, to: 18 });
});

test('cup-stack: the right hand stacks a cup; the wrong one fumbles and locks you out a moment', () => {
  const { inst, ctx } = run(cupStack);
  const v = () => inst.view();
  const seq = v().seq;
  assert.match(seq, /^[LR]{38}$/);
  const other = (h) => (h === 'L' ? 'R' : 'L');
  inst.onInput(0, { type: 'tap', hand: seq[0] });
  assert.deepEqual(v().step, [1, 0]);
  inst.onInput(0, { type: 'tap', hand: other(seq[1]) });
  assert.equal(v().fumbles[0], 1);
  assert.equal(v().last[0].kind, 'fumble');
  inst.onInput(0, { type: 'tap', hand: seq[1] });
  assert.equal(v().step[0], 1, 'still fumbling');
  ctx.advance(FUMBLE_MS);
  inst.onInput(0, { type: 'tap', hand: seq[1] });
  inst.onInput(0, { type: 'tap', hand: seq[2] });
  assert.equal(v().step[0], 3);
  assert.equal(v().last[0].kind, 'built');
  for (const bad of [{ type: 'tap', hand: 'X' }, { type: 'tap' }, { type: 'nope', hand: 'L' }]) inst.onInput(0, bad);
  inst.onInput(2, { type: 'tap', hand: seq[0] });
  assert.deepEqual(v().step, [3, 0]);
});

test('cup-stack: the first to finish all three wins; at time up the one further along', () => {
  const a = run(cupStack);
  const seq = a.inst.view().seq;
  for (const h of seq) a.inst.onInput(1, { type: 'tap', hand: h });
  assert.deepEqual(a.ended(), { winner: 1 });
  const b = run(cupStack, 2);
  const s2 = b.inst.view().seq;
  b.inst.onInput(0, { type: 'tap', hand: s2[0] });
  b.inst.onTimeUp();
  assert.deepEqual(b.ended(), { winner: 0 });
  const c = run(cupStack, 3);
  c.inst.onTimeUp();
  assert.deepEqual(c.ended(), { winner: null });
});
