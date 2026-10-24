// The 5 Party Minigames, each driven directly through its api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PARTIES } from '../server/games/minis/index.js';
import balloon from '../server/games/minis/balloon.js';
import hotPotato from '../server/games/minis/hot-potato.js';
import quickDraw from '../server/games/minis/quick-draw.js';
import memoryPath from '../server/games/minis/memory-path.js';
import sweetSpot, { wheelValue } from '../server/games/minis/sweet-spot.js';

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

test('there are 23 party minigames', () => {
  assert.equal(PARTIES.length, 23);
  assert.equal(new Set(PARTIES.map((m) => m.id)).size, 23);
  for (const m of PARTIES) assert.equal(m.kind, 'party');
});

test('balloon: 40 pumps pops it; mashing faster than 40 ms counts once', () => {
  const { inst, ctx, ended } = run(balloon);
  for (let i = 0; i < 10; i++) {
    inst.onInput(1, { type: 'pump' });
    inst.onInput(1, { type: 'pump' }); // same instant: ignored
    ctx.advance(10);
  }
  assert.equal(inst.view(0).pumps[1], 3); // at 0, 40 and 80 ms
  for (let i = 0; i < 40; i++) {
    inst.onInput(0, { type: 'pump' });
    ctx.advance(50);
  }
  assert.deepEqual(ended(), { winner: 0 });
});

test('balloon: a tie at time-up is a draw', () => {
  const { inst, ended } = run(balloon);
  inst.onInput(0, { type: 'pump' });
  inst.onInput(1, { type: 'pump' });
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: null });
});

test('hot-potato: only the holder passes; whoever holds it at the bang loses', () => {
  const { inst, ctx, ended } = run(hotPotato, 4);
  const holder = inst.view(0).holder;
  inst.onInput(1 - holder, { type: 'pass' });
  assert.equal(inst.view(0).holder, holder);
  inst.onInput(holder, { type: 'pass' });
  assert.equal(inst.view(0).flying, true);
  ctx.advance(600);
  assert.equal(inst.view(0).holder, 1 - holder);
  assert.ok(inst.fuseMs >= 8000 && inst.fuseMs <= 20000);
  ctx.advance(20000);
  assert.deepEqual(ended(), { winner: holder });
});

test('hot-potato: a pass still in the air at the bang blows up on the catcher', () => {
  const { inst, ctx, ended } = run(hotPotato, 8);
  const holder = inst.view(0).holder;
  ctx.advance(inst.fuseMs - 100);
  inst.onInput(holder, { type: 'pass' });
  ctx.advance(100);
  assert.deepEqual(ended(), { winner: holder });
});

test('quick-draw: early fire loses the duel; faster shot wins; two duels win it', () => {
  const { inst, ctx, ended } = run(quickDraw, 2);
  inst.onInput(0, { type: 'fire', t: 0 }); // before the bang
  assert.equal(inst.view(0).last.early, 0);
  assert.deepEqual(inst.view(0).duelWins, [0, 1]);
  ctx.advance(1500); // next duel
  while (inst.view(0).stage !== 'bang') ctx.advance(10);
  ctx.advance(400);
  inst.onInput(1, { type: 'fire', rt: 350 });
  inst.onInput(0, { type: 'fire', rt: 250 }); // arrived later, but was faster
  assert.deepEqual(inst.view(0).duelWins, [1, 1]);
  assert.deepEqual(inst.view(0).last.ms, [250, 350]);
  ctx.advance(1500);
  while (inst.view(0).stage !== 'bang') ctx.advance(10);
  ctx.advance(200);
  inst.onInput(1, { type: 'fire' });
  ctx.advance(300);
  assert.deepEqual(ended(), { winner: 1 });
});

test('quick-draw: nobody shooting is a draw', () => {
  const { ctx, ended } = run(quickDraw, 5);
  ctx.advance(40000);
  assert.deepEqual(ended(), { winner: null });
});

/** Enter the current sequence for `slot`, wrong at step `wrongAt` (or never). */
function enter(inst, seq, slot, wrongAt = -1) {
  seq.forEach((cell, k) => inst.onInput(slot, { type: 'cell', i: k === wrongAt ? (cell + 1) % 9 : cell }));
}

test('memory-path: right sequences grow it; one mistake hands the other the win', () => {
  const { inst, ctx, ended } = run(memoryPath, 6);
  let v = inst.view(0);
  assert.equal(v.stage, 'show');
  assert.equal(v.length, 3);
  const seq = v.seq.slice();
  ctx.advance(3 * 600 + 400);
  v = inst.view(0);
  assert.equal(v.stage, 'input');
  assert.equal(v.seq, undefined);
  enter(inst, seq, 0);
  enter(inst, seq, 1);
  v = inst.view(0);
  assert.equal(v.length, 4);
  const seq2 = v.seq.slice();
  assert.deepEqual(seq2.slice(0, 3), seq);
  ctx.advance(4 * 600 + 400);
  enter(inst, seq2, 1, 2);
  assert.equal(ended(), null);
  enter(inst, seq2, 0);
  assert.deepEqual(ended(), { winner: 0 });
});

test('memory-path: both wrong in the same round is a draw; too slow is a mistake', () => {
  const a = run(memoryPath, 7);
  const seq = a.inst.view(0).seq.slice();
  a.ctx.advance(3 * 600 + 400);
  enter(a.inst, seq, 0, 0);
  enter(a.inst, seq, 1, 1);
  assert.deepEqual(a.ended(), { winner: null });
  const b = run(memoryPath, 7);
  const seqB = b.inst.view(0).seq.slice();
  b.ctx.advance(3 * 600 + 400);
  enter(b.inst, seqB, 1);
  b.ctx.advance(10000);
  assert.deepEqual(b.ended(), { winner: 1 });
});

test('sweet-spot: the wheel and the higher total of three stops', () => {
  assert.equal(wheelValue(0, 0), 1);
  assert.equal(wheelValue(110, 0), 2);
  assert.equal(wheelValue(1100, 0), 1);
  const { inst, ctx, ended } = run(sweetSpot, 3);
  /** Stop `slot`'s wheel on `want` at the next chance. */
  const stopOn = (slot, want) => {
    const v = inst.view(0);
    let t = Math.max(ctx.now(), v.spinStart[slot]);
    while (wheelValue(t - v.spinStart[slot], v.offset[slot]) !== want) t++;
    ctx.advance(t - ctx.now());
    inst.onInput(slot, { type: 'stop', t });
  };
  for (let k = 0; k < 3; k++) {
    stopOn(0, 10);
    stopOn(1, 9);
  }
  assert.deepEqual(inst.view(0).spins, [[10, 10, 10], [9, 9, 9]]);
  assert.deepEqual(ended(), { winner: 0 });
});

test('sweet-spot: unstopped spins score 0 at time-up', () => {
  const { inst, ctx, ended } = run(sweetSpot, 3);
  ctx.advance(500);
  inst.onInput(1, { type: 'stop', t: 500 });
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 1 });
});

test('quick-draw: a shot fired before the phone saw BANG is early, even if it arrives after', () => {
  const { inst, ctx } = run(quickDraw, 2);
  while (inst.view(0).stage !== 'bang') ctx.advance(10);
  ctx.advance(50);
  inst.onInput(0, { type: 'fire', rt: -1 });
  assert.equal(inst.view(0).last.early, 0);
  assert.deepEqual(inst.view(0).duelWins, [0, 1]);
});

test('quick-draw: an impossible reaction time falls back to the server clock', () => {
  const { inst, ctx } = run(quickDraw, 2);
  while (inst.view(0).stage !== 'bang') ctx.advance(10);
  ctx.advance(200);
  inst.onInput(0, { type: 'fire', rt: 5000 });
  inst.onInput(1, { type: 'fire', rt: 'x' });
  const [a, b] = inst.view(0).last.ms;
  assert.equal(a, b);
  assert.ok(a >= 200 && a < 210, `server time since the bang, got ${a}`); // the loop above can pass the bang by <10 ms
});

test('memory-path: at time-up the one further along wins', () => {
  const { inst, ctx, ended } = run(memoryPath, 6);
  const seq = inst.view(0).seq.slice();
  ctx.advance(3 * 600 + 400);
  inst.onInput(0, { type: 'cell', i: seq[0] });
  inst.onInput(0, { type: 'cell', i: seq[1] });
  inst.onInput(1, { type: 'cell', i: seq[0] });
  inst.onTimeUp();
  assert.deepEqual(ended(), { winner: 0 });
});
