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

// ---- review fixes ----

test('minigames: no repeats until each has been played (one playlist per match)', () => {
  const ctx = fakeCtx();
  const pool = ['a', 'b', 'c'].map((id) => ({ ...claim, id }));
  const q = [0];
  let x = 3;
  const g = new PartyBoard(ctx, () => (q.length ? q.shift() : ((x = (x * 9301 + 49297) % 233280) / 233280)), MAPS.island, pool);
  g.start();
  const seen = [];
  for (let r = 0; r < 3; r++) {
    for (const s of [0, 1]) {
      g.players[s].space = 0;
      g.star = 25;
      g.onInput(s, { type: 'choose', value: 'roll' });
      for (let i = 0; i < 400 && g.hostView().phase === 'board' && !(g.hostView().prompt && g.hostView().prompt.slot !== s); i++) ctx.advance(50);
      if (g.hostView().prompt && g.hostView().prompt.slot === s) g.onInput(s, { type: 'choose', value: g.hostView().prompt.options.slice(-1)[0] });
      for (let i = 0; i < 400 && g.hostView().phase === 'board' && !(g.hostView().prompt && (g.hostView().prompt.slot !== s || g.hostView().prompt.kind === 'roll')); i++) ctx.advance(50);
    }
    assert.equal(g.hostView().phase, 'minigame');
    seen.push(g.hostView().mini.mini.id);
    g.onInput(0, { type: 'ready' });
    g.onInput(1, { type: 'ready' });
    g.onInput(0, { type: 'draw' });
    ctx.advance(MINI.resultPartyMs);
  }
  assert.deepEqual(seen.slice().sort(), ['a', 'b', 'c']);
});

test('star: landing on it and saying no still pays the blue +3', () => {
  const h = board();
  h.g.players[0].coins = 20;
  h.q.push(D(2));
  h.choose(0, 'roll');
  const v = h.settle();
  assert.equal(v.prompt.kind, 'star');
  h.choose(0, 'no');
  h.settle();
  assert.equal(h.p(0).coins, 23);
});

test('views during a minigame leave the board out (it updates up to 20 times a second)', () => {
  const h = board();
  h.roll(0, 1);
  const v = h.roll(1, 1);
  assert.equal(v.phase, 'minigame');
  assert.equal(v.board, undefined);
  assert.equal(v.items, undefined);
  assert.ok(v.players && v.mini);
  assert.ok(h.g.playerView(0).board === undefined);
});

// ---- forks and warps ----
// 0 → 1 (fork) → A: 2 3 4 5 | B: 6 7(warp → 0) 8 9 → 10 → 11 → 0
const FORKY = {
  name: 'Forky', tier: 'easy', starPrice: 20, shopMarkup: 1,
  spaces: [
    { type: 'start', next: [1] }, { type: 'blue', next: [2, 6] },
    { type: 'blue', next: [3], starCandidate: true }, { type: 'shop', next: [4] }, { type: 'event', next: [5] }, { type: 'blue', next: [10], starCandidate: true },
    { type: 'red', next: [7] }, { type: 'warp', warp: 0, next: [8] }, { type: 'bonus', next: [9] }, { type: 'event', next: [10] },
    { type: 'blue', next: [11], starCandidate: true }, { type: 'blue', next: [0], starCandidate: true },
  ].map((sp, i) => ({ x: 0.05 + i * 0.07, y: 0.5, ...sp })),
};

function forky() {
  const ctx = fakeCtx();
  const q = [0]; // the star on space 2
  const g = new PartyBoard(ctx, () => (q.length ? q.shift() : 0.5), FORKY, [claim]);
  g.start();
  const settle = () => {
    const phase = g.hostView().phase;
    for (let i = 0; i < 2000; i++) {
      const v = g.hostView();
      if (v.prompt || v.phase !== phase) return v;
      ctx.advance(50);
    }
    throw new Error('never settled');
  };
  const choose = (slot, value) => g.onInput(slot, { type: 'choose', value });
  const roll = (n) => { q.push(D(n)); choose(0, 'roll'); return settle(); };
  return { g, ctx, q, settle, choose, roll, p: (s) => g.hostView().players[s] };
}

test('fork: the walk stops and asks, with a preview of each path', () => {
  const f = forky();
  const v = f.roll(3);
  assert.equal(v.prompt.kind, 'path');
  assert.deepEqual(v.prompt.options, ['0', '1']);
  assert.equal(f.p(0).space, 1);
  assert.deepEqual(v.prompt.extra.previews, [['star', 'shop', 'event', 'blue'], ['red', 'warp', 'bonus', 'event']]);
});

test('fork: path 2 then a warp: landing on it sends you to its target, no effect there', () => {
  const f = forky();
  f.roll(3);
  f.choose(0, '1');
  const v = f.settle();
  assert.equal(f.p(0).space, 0);
  assert.equal(f.p(0).coins, 10, 'no start-space coins at the warp target');
  assert.equal(v.prompt.slot, 1, 'the turn ended');
});

test('fork: an idle player takes the first path after 15 s', () => {
  const f = forky();
  f.roll(2);
  f.ctx.advance(TIMING.promptMs);
  f.settle();
  assert.equal(f.p(0).space, 2);
});

test('fork: passing a warp does nothing; the star pass-by still asks after a fork', () => {
  let f = forky();
  f.roll(4);
  f.choose(0, '1');
  let v = f.settle();
  assert.equal(f.p(0).space, 8);
  assert.equal(v.prompt.kind, 'slot');
  f = forky();
  f.g.players[0].coins = 20;
  f.roll(3);
  f.choose(0, '0');
  v = f.settle();
  assert.equal(v.prompt.kind, 'star');
  assert.equal(f.p(0).space, 2);
});

// ---- maps, prices, settings ----

test('expert prices: the star costs 30, the shop 50% more', () => {
  const ctx = fakeCtx();
  const q = [0];
  const g = new PartyBoard(ctx, () => (q.length ? q.shift() : 0.5), { ...FORKY, starPrice: 30, shopMarkup: 1.5 }, [claim]);
  g.start();
  assert.equal(g.hostView().items.mushroom.price, 8);
  assert.equal(g.hostView().board.starPrice, 30);
  g.players[0].coins = 9;
  assert.deepEqual(g.shopItems(0), ['mushroom']);
  g.players[0].coins = 25;
  q.push(D(3));
  g.onInput(0, { type: 'choose', value: 'roll' });
  for (let i = 0; i < 100 && !(g.hostView().prompt && g.hostView().prompt.kind !== 'roll'); i++) ctx.advance(50);
  g.onInput(0, { type: 'choose', value: '0' });
  for (let i = 0; i < 100 && !(g.hostView().prompt && g.hostView().prompt.kind !== 'path'); i++) ctx.advance(50);
  assert.notEqual(g.hostView().prompt.kind, 'star', '25 coins: no star offer at 30');
  g.players[0].coins = 30;
  g.players[0].space = 1;
  g.turn = 0;
  let asked = null;
  g.ask = (kind) => { asked = kind; };
  g.players[0].space = 2; // standing on the star with 30
  g.passBy(() => {});
  assert.equal(asked, 'star', '30 coins: offered');
});

test('the map setting picks the map; random picks one of the five', () => {
  const pick = (settings, rng) => {
    const ctx = fakeCtx();
    ctx.settings = settings;
    const g = new PartyBoard(ctx, rng, undefined, [claim]);
    g.start();
    return g.hostView().board;
  };
  assert.equal(pick({ map: 'pipes' }, () => 0.5).name, MAPS.pipes.name);
  assert.equal(pick({ map: 'volcano' }, () => 0.5).tier, 'expert');
  const q = [0.99];
  assert.equal(pick({ map: 'random' }, () => (q.length ? q.shift() : 0.5)).name, MAPS.volcano.name);
});

// ---- Harsh mode ----

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const HAZARDS = ['thunder', 'skull', 'tornado'];

test('harsh off: no hazards; harsh on: 15% of blue/red, never on the start, stars, forks or warp targets', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    const off = fakeCtx();
    off.settings = { map: id, harsh: 0 };
    const g0 = new PartyBoard(off, seeded(1), undefined, [claim]);
    g0.start();
    assert.equal(g0.hostView().board.spaces.filter((s) => HAZARDS.includes(s.type)).length, 0, id);
    const plain = map.spaces.filter((s) => s.type === 'blue' || s.type === 'red').length;
    const want = Math.max(2, Math.round(plain * 0.15));
    const targets = new Set(map.spaces.filter((s) => s.type === 'warp').map((s) => s.warp));
    for (let seed = 1; seed <= 100; seed++) {
      const ctx = fakeCtx();
      ctx.settings = { map: id, harsh: 1 };
      const g = new PartyBoard(ctx, seeded(seed), undefined, [claim]);
      g.start();
      const spaces = g.hostView().board.spaces;
      const hz = spaces.map((s, i) => [s, i]).filter(([s]) => HAZARDS.includes(s.type));
      assert.equal(hz.length, want, `${id} seed ${seed}`);
      for (const [s, i] of hz) {
        assert.ok(i !== 0 && !s.starCandidate && s.next.length === 1 && !targets.has(i), `${id} seed ${seed}: hazard on ${i}`);
        assert.ok(['blue', 'red'].includes(map.spaces[i].type));
      }
    }
    assert.ok(map.spaces.every((s) => !HAZARDS.includes(s.type)), 'the shared map is never changed');
  }
});

/** The island with space 1 turned into `type`; player 0 rolls a 1 onto it. */
function hazardAt(type, prep) {
  const map = { ...MAPS.island, spaces: MAPS.island.spaces.map((s, i) => (i === 1 ? { ...s, type } : s)) };
  const ctx = fakeCtx();
  const q = [0];
  const g = new PartyBoard(ctx, () => (q.length ? q.shift() : 0.5), map, [claim]);
  g.start();
  if (prep) prep(g, q);
  q.push(0.01);
  g.onInput(0, { type: 'choose', value: 'roll' });
  for (let i = 0; i < 200 && !(g.hostView().prompt && g.hostView().prompt.slot === 1); i++) ctx.advance(50);
  return g.hostView().players[0];
}

test('thunder: lose half your coins (rounded down lost)', () => {
  assert.equal(hazardAt('thunder', (g) => { g.players[0].coins = 11; }).coins, 6);
});

test('skull: lose a star; with none, 10 coins; never below 0', () => {
  assert.deepEqual([hazardAt('skull', (g) => { g.players[0].stars = 1; }).stars], [0]);
  assert.equal(hazardAt('skull', (g) => { g.players[0].coins = 15; }).coins, 5);
  assert.equal(hazardAt('skull', (g) => { g.players[0].coins = 3; }).coins, 0);
});

test('tornado: blown to a random space (not the start, not here), no effect there', () => {
  const p = hazardAt('tornado', (g, q) => q.push(0.01)); // the die, then the tornado's pick
  assert.ok(p.space !== 0 && p.space !== 1, `landed on ${p.space}`);
  assert.equal(p.coins, 10);
});

// ---- the 3D board view ----

test('board view: 3D on every map when chosen (2D by default); the view names the map theme', () => {
  const boardOf = (settings) => {
    const ctx = fakeCtx();
    ctx.settings = settings;
    const g = new PartyBoard(ctx, () => 0.5, undefined, [claim]);
    g.start();
    return g.hostView().board;
  };
  assert.equal(boardOf({ map: 'island' }).view, '2d');
  assert.equal(boardOf({ map: 'island', view: '2d' }).view, '2d');
  for (const id of ['island', 'lagoons', 'pipes', 'haunted', 'volcano']) {
    const b = boardOf({ map: id, view: '3d' });
    assert.equal(b.view, '3d', id);
    assert.equal(b.theme, id);
  }
});

// ---- the end-of-match recap ----

const tally = (p) => [p.spent, p.lost, p.bought, p.stolen, p.warps];

test('recap counters: stars bought and coins spent (star, shop); coins lost (red, thieves, hazards); stars stolen; warps', () => {
  // [spent, lost, bought, stolen, warps]
  let h = board();
  assert.deepEqual(tally(h.p(0)), [0, 0, 0, 0, 0]);
  h.g.players[0].coins = 23;
  h.q.push(D(3));
  h.choose(0, 'roll');
  h.settle();
  h.choose(0, 'yes');
  h.settle();
  assert.deepEqual(tally(h.p(0)), [20, 3, 1, 0, 0], 'the star: 20 spent, then red −3');

  h = board();
  h.g.players[0].coins = 9;
  h.q.push(D(7));
  h.choose(0, 'roll');
  h.settle();
  h.choose(0, 'coin-thief');
  h.settle();
  assert.deepEqual(tally(h.p(0)), [8, 0, 0, 0, 0], 'the shop');

  h = board();
  h.g.players[1].coins = 7;
  h.g.players[1].stars = 1;
  h.g.players[0].items = ['coin-thief', 'star-thief'];
  h.g.turnStart();
  h.choose(0, 'coin-thief');
  h.settle();
  assert.deepEqual([h.p(1).lost, h.p(0).lost], [7, 0], 'the coin thief: the rival loses');
  h.g.turnStart();
  h.choose(0, 'star-thief');
  h.settle();
  assert.equal(h.p(0).stolen, 1);

  assert.equal(hazardAt('thunder', (g) => { g.players[0].coins = 11; }).lost, 5);

  const f = forky();
  f.roll(3);
  f.choose(0, '1');
  f.settle();
  assert.equal(f.p(0).warps, 1, 'landing on a warp space');
});

test('recap: only in the end view, with each player\'s numbers and bonus stars; a rematch resets the counters', () => {
  const h = board({ turns: 10, style: 'mix', bonus: 1 });
  h.g.players[1].coins = 0;
  for (let r = 0; r < 10; r++) {
    assert.equal(h.v().recap, undefined);
    h.g.players[0].space = h.g.players[1].space = 0;
    h.roll(0, 1);
    h.roll(1, 1);
    h.minigame(0);
  }
  assert.equal(h.v().recap, undefined, 'not during the bonus reveal');
  h.ctx.advance(TIMING.bonusMs);
  const v = h.v();
  assert.equal(v.phase, 'over');
  assert.equal(v.recap.length, 2);
  const [a, b] = v.recap;
  assert.deepEqual(Object.keys(a).sort(), ['bonus', 'bought', 'coins', 'earned', 'lost', 'minigames', 'spent', 'stars', 'stolen', 'warps']);
  assert.equal(a.minigames, 10);
  assert.equal(a.stars, v.players[0].stars);
  assert.equal(b.coins, v.players[1].coins);
  assert.deepEqual(a.bonus, ['minigame', 'coin']);
  assert.deepEqual(b.bonus, []);
  assert.deepEqual(h.g.playerView(1).recap, v.recap, 'phones get it too');
  h.g.players[0].lost = 9;
  h.g.onInput(0, { type: 'rematch' });
  assert.equal(h.v().recap, undefined);
  assert.deepEqual(tally(h.p(0)), [0, 0, 0, 0, 0]);
});

test('tile art: steampunk art (3D models) by default, light or classic when chosen; offered in the setup', async () => {
  const tilesOf = (settings) => {
    const ctx = fakeCtx();
    ctx.settings = settings;
    const g = new PartyBoard(ctx, () => 0.5, undefined, [claim]);
    g.start();
    return g.hostView().board.tiles;
  };
  assert.equal(tilesOf({}), 'art');
  assert.equal(tilesOf({ tiles: 'classic' }), 'classic');
  assert.equal(tilesOf({ tiles: 'light' }), 'light');
  const { getGame } = await import('../server/games/index.js');
  const row = getGame('party-board').create(fakeCtx()).rows.find((r) => r.key === 'tiles');
  assert.deepEqual(Object.keys(row.labels), ['art', 'light', 'classic']);
});
