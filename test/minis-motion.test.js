// Party minigames played by moving the phone (with a swipe or a button as well): Sword Duel and
// Pour It, driven directly through their api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import swordDuel, { WIN, TIMING } from '../server/games/minis/sword-duel.js';
import pourIt, { TICK_MS, SETTLE_MS, FLOW } from '../server/games/minis/pour-it.js';
import { poolFor } from '../server/games/party-minis.js';
import { PARTIES } from '../server/games/minis/index.js';

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
  const api = {
    players: ctx.players, rng: seeded(seed), speed: 1, now: ctx.now, elapsed: () => ctx.now(), update() {},
    setTimeout: ctx.setTimeout, clearTimeout: ctx.clearTimeout,
    end(r) { if (!ended) ended = r; },
  };
  const inst = def.create(api);
  inst.start();
  return { inst, ctx, ended: () => ended };
}

test('the motion minigames are phone-only (never picked with a controller seated)', () => {
  for (const m of [swordDuel, pourIt]) {
    assert.equal(m.phoneOnly, true);
    assert.ok(!poolFor(PARTIES, 'mix', [{ local: false }, { local: true }]).includes(m));
    assert.ok(poolFor(PARTIES, 'mix', [{ local: false }, { local: false }]).includes(m));
  }
});

// ---- Sword Duel ----

const waitFor = (inst, ctx, stage) => {
  for (let i = 0; i < 1000 && inst.view(0).stage !== stage; i++) ctx.advance(20);
  assert.equal(inst.view(0).stage, stage);
};

test('sword-duel: the first right slash takes the point; first to 3 wins', () => {
  const { inst, ctx, ended } = run(swordDuel, 4);
  for (let k = 0; k < WIN; k++) {
    waitFor(inst, ctx, 'go');
    const dir = inst.view(0).dir;
    inst.onInput(0, { type: 'slash', dir });
    inst.onInput(1, { type: 'slash', dir }); // too late
    if (k < WIN - 1) assert.deepEqual(inst.view(0).points, [k + 1, 0]);
    ctx.advance(TIMING.pauseMs);
  }
  assert.deepEqual(ended(), { winner: 0 });
});

test('sword-duel: slashing before the arrow gives the point away; the wrong way puts you out', () => {
  const { inst, ctx } = run(swordDuel, 5);
  assert.equal(inst.view(0).stage, 'wait');
  assert.equal(inst.view(0).dir, null, 'the arrow stays secret while you wait');
  inst.onInput(1, { type: 'slash', dir: 'up' });
  assert.deepEqual(inst.view(0).points, [1, 0]);
  assert.equal(inst.view(0).last.why, 'foul');
  ctx.advance(TIMING.pauseMs);
  waitFor(inst, ctx, 'go');
  const dir = inst.view(0).dir;
  const wrong = ['up', 'down', 'left', 'right'].find((d) => d !== dir);
  inst.onInput(0, { type: 'slash', dir: wrong });
  inst.onInput(0, { type: 'slash', dir }); // out of this point: ignored
  assert.equal(inst.view(0).stage, 'go');
  inst.onInput(1, { type: 'slash', dir });
  assert.deepEqual(inst.view(0).points, [1, 1]);
  inst.onInput(0, { type: 'slash', dir: 'sideways' }); // junk
});

test('sword-duel: nobody slashes in time: no point; at time-up most points wins', () => {
  const { inst, ctx, ended } = run(swordDuel, 6);
  waitFor(inst, ctx, 'go');
  ctx.advance(TIMING.showMs + 10);
  assert.equal(inst.view(0).last.why, 'slow');
  assert.deepEqual(inst.view(0).points, [0, 0]);
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

// ---- Pour It ----

test('pour-it: tilting fills the glass; level it and after a moment it is done; nearer the line wins', () => {
  const { inst, ctx, ended } = run(pourIt, 3);
  const line = inst.view(0).line;
  assert.ok(line >= 0.55 && line <= 0.85);
  // Player 1 pours at full tilt for just the right time; player 2 stops early.
  const rightMs = Math.round(((line / FLOW) * 1000) / TICK_MS) * TICK_MS;
  inst.onInput(0, { type: 'pour', v: 1 });
  inst.onInput(1, { type: 'pour', v: 1 });
  ctx.advance(rightMs / 2);
  inst.onInput(1, { type: 'pour', v: 0 });
  ctx.advance(rightMs / 2);
  inst.onInput(0, { type: 'pour', v: 0 });
  assert.ok(Math.abs(inst.view(0).glasses[0].fill - line) < 0.05, 'player 1 near the line');
  ctx.advance(SETTLE_MS + 200);
  const g = inst.view(0).glasses;
  assert.ok(g[0].done && g[1].done);
  assert.deepEqual(ended(), { winner: 0 });
});

test('pour-it: overfilling spills and loses; a done glass takes no more; junk ignored', () => {
  const { inst, ctx, ended } = run(pourIt, 3);
  inst.onInput(0, { type: 'pour', v: 1 });
  inst.onInput(1, { type: 'pour', v: 'lots' });
  inst.onInput(1, { type: 'pour', v: 0.2 });
  ctx.advance(Math.ceil(1000 / FLOW) + 300);
  const g = inst.view(0).glasses;
  assert.equal(g[0].spilled, true);
  assert.equal(g[0].done, true);
  inst.onInput(0, { type: 'pour', v: 1 });
  assert.equal(inst.view(0).glasses[0].pouring, false);
  inst.onInput(1, { type: 'pour', v: 0 });
  ctx.advance(SETTLE_MS + 200);
  assert.deepEqual(ended(), { winner: 1 });
});
