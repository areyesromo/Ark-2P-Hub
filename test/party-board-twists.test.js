// Party Board map twists: Sky Bridges' drawbridge and Market Square's changing prices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { MAPS } from '../server/games/board/maps.js';
import { PartyBoard, ITEMS } from '../server/games/party-board.js';
import { getGame } from '../server/games/index.js';

/** A party minigame won by whoever says so. */
const claim = {
  id: 'claim', kind: 'party', look: '2d', name: 'Claim', order: 'CLAIM!', howTo: 'say', durationMs: 20000,
  create(api) {
    return { start() {}, onInput: (slot) => api.end({ winner: slot }), view: () => ({}) };
  },
};

/** A board on `map` with a scripted rng (a queue; 0.5 when empty). */
function board(map, rng) {
  const ctx = fakeCtx();
  // As the room does: every update builds every view.
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  const q = [];
  g = new PartyBoard(ctx, rng || (() => (q.length ? q.shift() : 0.5)), map, [claim]);
  g.start();
  const h = {
    g, ctx, q,
    v: () => g.hostView(),
    settle() {
      for (let i = 0; i < 2000; i++) {
        if (g.hostView().prompt) return g.hostView();
        ctx.advance(50);
      }
      throw new Error('never settled');
    },
    /** Roll exactly n for whoever's turn it is, and walk until something asks. */
    roll(n) {
      q.push((n - 1) / 10 + 0.01);
      g.onInput(g.turn, { type: 'choose', value: 'roll' });
      return h.settle();
    },
  };
  return h;
}

// ---- 🌉 Sky Bridges ----

test('sky bridges: the drawbridge is down in rounds 1-2 (the fork asks), up in rounds 3-4 (the long way, no question)', () => {
  const d = MAPS.skybridges.drawbridge;
  const down = board(MAPS.skybridges);
  down.g.players[0].space = d.fork - 1;
  const v = down.roll(2);
  assert.equal(v.prompt.kind, 'path');
  assert.equal(v.board.drawbridge.up, false);

  const up = board(MAPS.skybridges);
  up.g.round = 3;
  up.g.players[0].space = d.fork - 1;
  up.g.players[0].coins = 0; // nothing to buy on the way past the shop
  const said = [];
  const say = up.g.say.bind(up.g);
  up.g.say = (m) => { said.push(m); say(m); };
  const w = up.roll(3);
  assert.equal(w.board.drawbridge.up, true);
  assert.notEqual(w.prompt && w.prompt.kind, 'path');
  const other = MAPS.skybridges.spaces[d.fork].next.find((n) => n !== d.to);
  assert.equal(up.g.players[0].space, MAPS.skybridges.spaces[other].next[0], 'went round, not across');
  assert.ok(said.some((m) => /bridge/i.test(m)), 'told why');
});

test('sky bridges: the bridge goes up and down every two rounds, as the rounds really pass', () => {
  const h = board(MAPS.skybridges);
  const ups = [];
  for (let r = 0; r < 6; r++) {
    ups.push(h.v().board.drawbridge.up);
    h.g.miniDone({ winner: null }); // the next round
  }
  assert.deepEqual(ups, [false, false, true, true, false, false]);
  const { fork, to, span } = MAPS.skybridges.drawbridge;
  assert.deepEqual({ ...h.v().board.drawbridge, up: undefined }, { fork, to, span, up: undefined });
});

test('sky bridges: already on the short cut when the bridge goes up, you are turned back to the fork and go the long way', () => {
  const d = MAPS.skybridges.drawbridge;
  const spaces = MAPS.skybridges.spaces;
  const h = board(MAPS.skybridges);
  h.g.round = 3;
  const p = h.g.players[0];
  p.coins = 0;
  p.space = d.span[0] - 1; // two hops before the far side of the span
  const hops = [];
  const hop = h.g.hop.bind(h.g);
  h.g.hop = (to, left) => { hops.push(to); hop(to, left); };
  h.roll(4);
  assert.ok(!hops.includes(d.span[1]), 'never crossed the raised span: ' + hops);
  const long = spaces[d.fork].next.find((n) => n !== d.to);
  assert.deepEqual(hops, [d.span[0], d.fork, long, spaces[long].next[0]]);
});

test('sky bridges: with the bridge down, the short cut crosses it', () => {
  const d = MAPS.skybridges.drawbridge;
  const h = board(MAPS.skybridges);
  h.g.players[0].coins = 0;
  h.g.players[0].space = d.span[0];
  h.roll(1);
  assert.equal(h.g.players[0].space, d.span[1]);
});

test('sky bridges and market square: a rematch puts the bridge down and rolls a fresh market', () => {
  const sky = board(MAPS.skybridges);
  for (let r = 0; r < 2; r++) sky.g.miniDone({ winner: null });
  assert.equal(sky.v().board.drawbridge.up, true);
  sky.g.start();
  assert.equal(sky.v().board.drawbridge.up, false);

  const mk = board(MAPS.market);
  let rolled = 0;
  const roll = mk.g.rollMarket.bind(mk.g);
  mk.g.rollMarket = () => { rolled++; roll(); };
  mk.g.start();
  assert.equal(rolled, 1, 'the market was rolled again');
  assert.ok(mk.v().board.market);
});

// ---- 🛒 Market Square ----

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('market square: prices change every round, half to double, and the star price moves too', () => {
  const m = MAPS.market.market;
  const h = board(MAPS.market, seeded(4));
  const seen = [];
  for (let r = 0; r < 8; r++) {
    const v = h.v();
    const { factor, star } = v.board.market;
    assert.ok(m.factors.includes(factor), String(factor));
    assert.ok(m.stars.includes(star), String(star));
    assert.equal(v.board.starPrice, star);
    for (const id of Object.keys(ITEMS)) assert.equal(v.items[id].price, Math.round(ITEMS[id].price * factor), id);
    seen.push(factor);
    h.g.miniDone({ winner: null }); // the next round
  }
  assert.ok(new Set(seen).size >= 3, 'prices really move: ' + seen);
  assert.ok(m.factors.includes(0.5) && m.factors.includes(2));
  assert.equal(Math.min(...m.stars), 15);
  assert.equal(Math.max(...m.stars), 35);
});

test('market square: buying the star pays today\'s market price, not the map\'s', () => {
  const h = board(MAPS.market, seeded(9));
  const p = h.g.players[0];
  p.coins = 100;
  h.g.star = 4;
  p.space = 3; // a step before the star
  const v = h.roll(1);
  assert.equal(v.prompt.kind, 'star');
  assert.notEqual(v.board.starPrice, MAPS.market.starPrice, 'this seed rolls a market star price');
  h.g.onInput(0, { type: 'choose', value: 'yes' });
  assert.equal(p.coins, 100 - v.board.starPrice);
});

test('other maps have no drawbridge or market', () => {
  const v = board(MAPS.island).v();
  assert.equal(v.board.drawbridge, null);
  assert.equal(v.board.market, null);
});

test('both new maps can be picked in the setup', () => {
  const setup = JSON.stringify(getGame('party-board').create(fakeCtx()).hostView());
  for (const id of ['skybridges', 'market']) assert.ok(setup.includes('"' + id + '"'), id);
  assert.ok(setup.includes('Sky Bridges') && setup.includes('Market Square'));
});
