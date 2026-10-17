// Party Board: the map, the one-minigame runner, and the board game itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { MAPS } from '../server/games/board/maps.js';
import { OneMini, TIMING as MINI } from '../server/games/minis/runner.js';
import { PartyBoard, TIMING } from '../server/games/party-board.js';
import { listGames } from '../server/games/index.js';

/** A party minigame won by whoever says so ('draw' for a draw). */
const claim = {
  id: 'claim', kind: 'party', look: '2d', name: 'Claim', order: 'CLAIM!', howTo: 'say', durationMs: 20000,
  create(api) {
    return { start() {}, onInput: (slot, input) => api.end({ winner: input.type === 'draw' ? null : slot }), view: () => ({}) };
  },
};

test('map island: a loop of 24-32 spaces with the right counts', () => {
  const s = MAPS.island.spaces;
  assert.ok(s.length >= 24 && s.length <= 32);
  const n = (t) => s.filter((x) => x.type === t).length;
  assert.equal(s[0].type, 'start');
  assert.equal(n('shop'), 2);
  assert.equal(n('event'), 3);
  assert.equal(n('bonus'), 2);
  const stars = s.filter((x) => x.starCandidate);
  assert.ok(stars.length >= 4 && stars.length <= 6);
  assert.ok(stars.every((x) => x.type === 'blue'));
  assert.ok(n('blue') >= 1.5 * n('red') && n('red') >= 3);
  for (const x of s) assert.ok(x.x >= 0 && x.x <= 1 && x.y >= 0 && x.y <= 1);
  assert.equal(new Set(s.map((x) => x.x + ',' + x.y)).size, s.length);
});

test('OneMini plays one party minigame and reports its result', () => {
  const ctx = fakeCtx();
  const done = [];
  const m = new OneMini(ctx, [claim], Math.random, (r) => done.push(r));
  m.start();
  m.onInput(0, { type: 'ready' });
  m.onInput(1, { type: 'ready' });
  m.onInput(1, { type: 'win' });
  assert.equal(done.length, 0, 'the result card shows first');
  ctx.advance(MINI.resultPartyMs);
  assert.deepEqual(done, [{ winner: 1 }]);
  ctx.advance(60000);
  assert.equal(done.length, 1);
});

// ---- the board game ----

/**
 * A board game on a fake clock with a scripted rng (a queue; 0.5 when empty)
 * and the stub minigame. The star starts on the first candidate (space 2).
 */
function board(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const q = [0];
  const g = new PartyBoard(ctx, () => (q.length ? q.shift() : 0.5), MAPS.island, [claim]);
  g.start();
  const h = {
    g, ctx, q,
    v: () => g.hostView(),
    p: (slot) => g.hostView().players[slot],
    choose: (slot, value) => g.onInput(slot, { type: 'choose', value }),
    /** Run the clock until someone is asked something or the phase changes. */
    settle() {
      const phase = g.hostView().phase;
      for (let i = 0; i < 2000; i++) {
        const v = g.hostView();
        if (v.prompt || v.phase !== phase) return v;
        ctx.advance(50);
      }
      throw new Error('never settled');
    },
    /** Roll exactly n (1-10) for `slot` and play the turn out. */
    roll(slot, n) {
      q.push((n - 1) / 10 + 0.01);
      h.choose(slot, 'roll');
      return h.settle();
    },
    /** Both players ready; then the minigame goes to `winner` (null: a draw). */
    minigame(winner) {
      assert.equal(g.hostView().phase, 'minigame');
      g.onInput(0, { type: 'ready' });
      g.onInput(1, { type: 'ready' });
      g.onInput(winner === null ? 0 : winner, { type: winner === null ? 'draw' : 'win' });
      ctx.advance(MINI.resultPartyMs);
      const v = g.hostView();
      return v.phase === 'board' && !v.prompt ? h.settle() : v; // the end (bonus / over) stays put
    },
  };
  return h;
}

test('board: rolling walks one space per step', () => {
  const { v, choose, q, ctx } = board();
  assert.equal(v().prompt.kind, 'roll');
  assert.equal(v().prompt.slot, 0);
  q.push(0.31); // a 4
  choose(0, 'roll');
  assert.deepEqual(v().dice.values, [4]);
  ctx.advance(TIMING.rollMs);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    ctx.advance(TIMING.stepMs);
    seen.push(v().players[0].space);
  }
  assert.deepEqual(seen, [1, 2, 3, 4]);
});

test('board: blue +3, red -3, never below 0; start with 10 coins', () => {
  const h = board();
  assert.equal(h.p(0).coins, 10);
  h.roll(0, 1); // space 1: blue
  assert.equal(h.p(0).coins, 13);
  h.roll(1, 3); // space 3: red
  assert.equal(h.p(1).coins, 7);
  h.minigame(null);
  h.g.players[1].coins = 1;
  h.roll(0, 2); // 1 -> 3: red
  assert.equal(h.p(0).coins, 16 - 3);
  h.roll(1, 6); // 3 -> 9: red
  assert.equal(h.p(1).coins, 0);
});

test('board: after both turns a minigame; winner +10, a draw +3 each; then the next round', () => {
  const h = board();
  h.roll(0, 1);
  const v = h.roll(1, 1);
  assert.equal(v.phase, 'minigame');
  assert.ok(v.mini && v.mini.phase === 'intro');
  h.minigame(1);
  assert.equal(h.p(1).coins, 13 + 10);
  assert.equal(h.p(1).minigames, 1);
  assert.equal(h.v().round, 2);
  assert.equal(h.v().prompt.slot, 0);
  h.roll(0, 4); // 1 -> 5 blue
  h.roll(1, 4);
  h.minigame(null);
  assert.equal(h.p(0).coins, 13 + 3 + 3);
});

test('board: the end: bonus stars, then most stars wins; scores are stars', () => {
  const h = board({ turns: 10, style: 'mix', bonus: 1 });
  for (let r = 0; r < 10; r++) {
    h.g.players[0].space = h.g.players[1].space = 0; // keep to the blue space 1
    h.roll(0, 1);
    h.roll(1, 1);
    h.minigame(0);
  }
  let v = h.v();
  assert.equal(v.phase, 'bonus');
  assert.deepEqual(v.bonusStars.map((b) => [b.kind, b.slots]), [['minigame', [0]], ['coin', [0]]]);
  h.ctx.advance(TIMING.bonusMs);
  v = h.v();
  assert.equal(v.phase, 'over');
  assert.equal(v.winner, 0);
  assert.deepEqual(v.scores, [v.players[0].stars, v.players[1].stars]);
});

test('board: bonus off; equal stars and coins is a draw; coins break star ties', () => {
  const h = board({ turns: 10, style: 'mix', bonus: 0 });
  for (let r = 0; r < 10; r++) {
    h.g.players[0].space = h.g.players[1].space = 0;
    h.roll(0, 1);
    h.roll(1, 1);
    h.minigame(null);
  }
  let v = h.v();
  assert.equal(v.phase, 'over');
  assert.equal(v.draw, true);
  assert.equal(v.winner, null);
  const k = board({ turns: 10, style: 'mix', bonus: 0 });
  for (let r = 0; r < 10; r++) {
    k.g.players[0].space = k.g.players[1].space = 0;
    k.roll(0, 1);
    k.roll(1, 1);
    k.minigame(r === 9 ? 1 : null);
  }
  v = k.v();
  assert.equal(v.winner, 1, 'no stars either side: more coins wins');
});

test('board: turns setting; listed in the lobby as competitive', () => {
  assert.equal(board({ turns: 15, style: 'mix', bonus: 1 }).v().turns, 15);
  const def = listGames().find((x) => x.id === 'party-board');
  assert.ok(def);
  assert.equal(def.category, 'competitive');
});

test('board: a rematch mid-walk leaves no stale steps behind', () => {
  const h = board();
  h.q.push(0.91);
  h.choose(0, 'roll');
  h.ctx.advance(TIMING.rollMs + TIMING.stepMs);
  h.g.start();
  h.ctx.advance(TIMING.stepMs * 20);
  assert.equal(h.p(0).space, 0);
  assert.equal(h.v().prompt.kind, 'roll');
});
