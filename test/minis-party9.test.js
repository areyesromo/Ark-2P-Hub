// Treasure Dig, driven directly through its api: the beeper's words, the rounds, and the chest kept
// hidden from every screen till it's dug up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import treasureDig, { SIZE, DIG_MS, ROUNDS_TO_WIN, distance, heat } from '../server/games/minis/treasure-dig.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function run(seed = 1) {
  const ctx = fakeCtx();
  let ended = null;
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: () => ctx.now() + 600000, elapsed: () => ctx.now(), update() {},
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { if (!ended) ended = r; },
  };
  const inst = treasureDig.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended };
}

/** Where a player's chest is, worked out the way a player would: from the beeper's words alone. */
function find(inst, ctx, slot) {
  for (let c = 0; c < SIZE * SIZE; c++) {
    const before = inst.view(slot).round;
    const v = inst.view(slot);
    if (v.found !== null || v.round !== before) return;
    const fits = v.digs[slot].every((d) => heat(distance(d.cell, c)) === d.heat);
    if (!fits || v.digs[slot].some((d) => d.cell === c)) continue;
    inst.onInput(slot, { type: 'dig', cell: c });
    ctx.advance(DIG_MS);
    if (inst.view(slot).found === slot) return;
  }
}

test('treasure-dig: a 2D party minigame in the party list', () => {
  assert.equal(treasureDig.kind, 'party');
  assert.equal(treasureDig.look, '2d');
  assert.ok(PARTIES.includes(treasureDig));
  assert.ok(treasureDig.durationMs <= 80000 && treasureDig.howTo && treasureDig.order);
});

test('treasure-dig: the beeper counts squares as a king moves', () => {
  assert.equal(distance(0, 0), 0);
  assert.equal(distance(0, SIZE + 1), 1); // the diagonal
  assert.equal(distance(0, 2), 2);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(heat), ['chest', 'hot', 'warm', 'cool', 'cold', 'cold']);
});

test('treasure-dig: no screen sees where a chest is till it is dug up', () => {
  const { inst } = run(3);
  for (const slot of [null, 0, 1]) assert.deepEqual(inst.view(slot).chests, [null, null]);
  assert.ok(!JSON.stringify(inst.view(null)).includes('"chest"'));
});

test('treasure-dig: a dig takes a moment (no digging again till it is done), the same square only once, bad input ignored', () => {
  const { inst, ctx } = run();
  inst.onInput(0, { type: 'dig', cell: 0 });
  inst.onInput(0, { type: 'dig', cell: 1 }); // still digging
  assert.equal(inst.view(0).digs[0].length, 1);
  ctx.advance(DIG_MS);
  inst.onInput(0, { type: 'dig', cell: 0 }); // already dug
  for (const bad of [-1, SIZE * SIZE, 1.5, '3', null]) inst.onInput(0, { type: 'dig', cell: bad });
  inst.onInput(2, { type: 'dig', cell: 5 });
  assert.equal(inst.view(0).digs[0].length, 1);
  inst.onInput(0, { type: 'dig', cell: 1 });
  assert.equal(inst.view(0).digs[0].length, 2);
});

test('treasure-dig: the first to find their chest takes the round; first to three wins', () => {
  const { inst, ctx, ended } = run(5);
  for (let r = 1; r <= ROUNDS_TO_WIN; r++) {
    assert.equal(inst.view(0).round, r);
    find(inst, ctx, 1);
    assert.equal(inst.view(0).found, 1);
    const c = inst.view(0).chests[1];
    assert.ok(Number.isInteger(c), 'the found chest shows');
    assert.equal(inst.view(0).chests[0], null, "the other player's stays hidden");
    inst.onInput(0, { type: 'dig', cell: 0 }); // nobody digs while it's on show
    assert.equal(inst.view(0).digs[0].length, 0);
    ctx.advance(2000);
  }
  assert.deepEqual(ended(), { winner: 1 });
  assert.deepEqual(inst.view(0).wins, [0, ROUNDS_TO_WIN]);
});

test('treasure-dig: time up, more rounds wins; level is a draw', () => {
  const a = run(7);
  find(a.inst, a.ctx, 0);
  a.ctx.advance(2000);
  a.inst.onTimeUp();
  assert.deepEqual(a.ended(), { winner: 0 });
  const b = run(7);
  b.inst.onTimeUp();
  assert.deepEqual(b.ended(), { winner: null });
});
