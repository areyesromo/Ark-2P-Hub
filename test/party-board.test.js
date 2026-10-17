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
  h.g.star = 25; // out of the way: this test is not about buying stars
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

// ---- star, shop, items, events, slot, time-outs ----
// The star starts on space 2; shops are 6 and 18; events 4, 14, 24; bonus 10, 22.
const D = (n) => (n - 1) / 10 + 0.01; // rng value that rolls n
const EV = { shower: 0.01, swap: 0.21, steal: 0.41, lucky: 0.61, star: 0.81 };

test('star: passing it with 20 coins offers it; yes buys and moves it, no walks on', () => {
  const h = board();
  h.g.players[0].coins = 20;
  h.q.push(D(3));
  h.choose(0, 'roll');
  let v = h.settle();
  assert.equal(v.prompt.kind, 'star');
  assert.deepEqual(v.prompt.options, ['yes', 'no']);
  h.q.push(0); // the star moves to the first other candidate
  h.choose(0, 'yes');
  v = h.settle();
  assert.equal(h.p(0).stars, 1);
  assert.equal(v.board.star, 7);
  assert.equal(h.p(0).space, 3);
  assert.equal(h.p(0).coins, 0, 'paid 20, then the red space (never below 0)');
  const k = board();
  k.g.players[0].coins = 20;
  k.q.push(D(3));
  k.choose(0, 'roll');
  k.settle();
  k.choose(0, 'no');
  k.settle();
  assert.equal(k.p(0).stars, 0);
  assert.equal(k.v().board.star, 2);
});

test('star: passing with 19 coins asks nothing', () => {
  const h = board();
  h.g.players[0].coins = 19;
  const v = h.roll(0, 3);
  assert.equal(v.prompt.slot, 1);
  assert.equal(h.p(0).space, 3);
});

test('shop: offers what you can afford, only with a free slot; buying takes coins', () => {
  const h = board();
  h.g.players[0].coins = 9;
  h.q.push(D(7));
  h.choose(0, 'roll');
  let v = h.settle();
  assert.equal(v.prompt.kind, 'shop');
  assert.deepEqual(v.prompt.options, ['mushroom', 'coin-thief', 'none']);
  h.choose(0, 'coin-thief');
  v = h.settle();
  assert.deepEqual(h.p(0).items, ['coin-thief']);
  assert.equal(h.p(0).coins, 1 + 3, 'paid 8, then blue space 7');
  const k = board();
  k.g.players[0].coins = 50;
  k.g.players[0].items = ['mushroom', 'mushroom', 'warp'];
  k.g.star = 25; // not passing it
  k.g.turnStart();
  k.choose(0, 'none');
  k.settle();
  k.q.push(D(7));
  k.choose(0, 'roll');
  v = k.settle();
  assert.equal(v.prompt.slot, 1, 'three items: the shop does not ask');
});

test('items: mushroom +3, double dice, warp, coin thief, star thief', () => {
  let h = board();
  h.g.players[0].items = ['mushroom'];
  h.g.turnStart();
  assert.deepEqual(h.v().prompt.options, ['mushroom', 'none']);
  h.choose(0, 'mushroom');
  h.settle();
  h.roll(0, 2);
  assert.equal(h.p(0).space, 5);
  assert.deepEqual(h.p(0).items, []);

  h = board();
  h.g.players[0].items = ['double'];
  h.g.turnStart();
  h.choose(0, 'double');
  h.settle();
  h.q.push(D(1), D(1));
  h.choose(0, 'roll');
  h.settle();
  assert.equal(h.p(0).space, 2);

  h = board();
  h.g.players[1].space = 5;
  h.g.players[0].items = ['warp'];
  h.g.turnStart();
  h.choose(0, 'warp');
  h.settle();
  assert.deepEqual([h.p(0).space, h.p(1).space], [5, 0]);

  h = board();
  h.g.players[1].coins = 7;
  h.g.players[0].items = ['coin-thief'];
  h.g.turnStart();
  h.choose(0, 'coin-thief');
  h.settle();
  assert.deepEqual([h.p(0).coins, h.p(1).coins], [17, 0]);

  h = board();
  h.g.players[1].stars = 1;
  h.g.players[0].items = ['star-thief'];
  h.g.turnStart();
  h.choose(0, 'star-thief');
  h.settle();
  assert.deepEqual([h.p(0).stars, h.p(1).stars], [1, 0]);
});

test('items: the star thief is not offered (or taken) when the rival has no stars', () => {
  const h = board();
  h.g.players[0].items = ['star-thief'];
  h.g.turnStart();
  assert.equal(h.v().prompt.kind, 'roll');
  h.choose(0, 'star-thief');
  assert.equal(h.v().prompt.kind, 'roll');
  assert.deepEqual(h.p(0).items, ['star-thief']);
});

test('events: shower, swap, steal (only what they have), lucky, the star moves', () => {
  const at = (ev, prep) => {
    const h = board();
    if (prep) prep(h.g);
    h.q.push(D(4), EV[ev]);
    if (ev === 'star') h.q.push(0);
    h.choose(0, 'roll');
    h.settle();
    return h;
  };
  let h = at('shower');
  assert.deepEqual([h.p(0).coins, h.p(1).coins], [15, 15]);
  h = at('swap', (g) => { g.players[1].space = 9; });
  assert.deepEqual([h.p(0).space, h.p(1).space], [9, 4]);
  h = at('steal', (g) => { g.players[1].coins = 2; });
  assert.deepEqual([h.p(0).coins, h.p(1).coins], [12, 0]);
  h = at('lucky');
  assert.equal(h.p(0).coins, 20);
  h = at('star');
  assert.equal(h.v().board.star, 7);
});

test('slot machine: three of a kind +15, a pair +5, else +1', () => {
  const spin = (a, b, c) => {
    const h = board();
    h.g.players[0].coins = 4; // too little to be stopped by the shop on the way
    h.q.push(D(10));
    h.choose(0, 'roll');
    let v = h.settle();
    assert.equal(v.prompt.kind, 'slot');
    for (const r of [a, b, c]) {
      h.q.push(r);
      h.choose(0, 'stop');
    }
    v = h.settle();
    return h.p(0).coins;
  };
  assert.equal(spin(0.01, 0.01, 0.01), 4 + 15);
  assert.equal(spin(0.01, 0.01, 0.5), 4 + 5);
  assert.equal(spin(0.01, 0.3, 0.5), 4 + 1);
});

test('time-outs: roll rolls, item none, star no, shop none, slot stops', () => {
  let h = board();
  h.g.players[0].items = ['mushroom'];
  h.g.turnStart();
  h.ctx.advance(TIMING.promptMs);
  assert.equal(h.v().prompt.kind, 'roll', 'item: none');
  h.ctx.advance(TIMING.promptMs);
  assert.ok(h.v().dice, 'roll: rolled');
  h = board();
  h.g.players[0].coins = 20;
  h.q.push(D(3));
  h.choose(0, 'roll');
  h.settle();
  h.ctx.advance(TIMING.promptMs);
  h.settle();
  assert.equal(h.p(0).stars, 0, 'star: no');
  h = board();
  h.g.players[0].coins = 9;
  h.q.push(D(7));
  h.choose(0, 'roll');
  h.settle();
  h.ctx.advance(TIMING.promptMs);
  h.settle();
  assert.deepEqual(h.p(0).items, [], 'shop: none');
  h = board();
  h.g.players[0].coins = 4;
  h.q.push(D(10));
  h.choose(0, 'roll');
  h.settle();
  h.ctx.advance(TIMING.promptMs);
  const v = h.settle();
  assert.ok(h.p(0).coins > 4, 'slot: all reels stopped and paid');
  assert.equal(v.prompt.slot, 1);
});

test('inputs: the other player, unknown values or no prompt are ignored', () => {
  const h = board();
  h.choose(1, 'roll');
  assert.equal(h.v().dice, null);
  h.choose(0, 'banana');
  assert.equal(h.v().dice, null);
  h.g.onInput(0, null);
  h.g.onInput(0, { type: 'choose' });
  h.choose(0, 'roll');
  h.choose(0, 'roll'); // the prompt is gone
  assert.equal(h.v().dice.values.length, 1);
});
