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
