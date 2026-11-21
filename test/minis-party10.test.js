// Bubble Pop, Bridge Builder and Pancake Flip, driven directly through their api.
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
