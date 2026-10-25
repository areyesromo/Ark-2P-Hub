// Kitchen Rush: co-op cooking. Chop, cook, plate and serve the orders before they run out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { KitchenRush, KITCHENS, RECIPES, TIMING, COINS, MAX_ORDERS, starsFor, starTargets, ordersIn, SIZE } from '../server/games/kitchen-rush.js';
import { getGame } from '../server/games/index.js';

/** A shift in `kitchen` (0 Diner, 1 Split, 2 Rush hour), past the countdown; every update builds every view. */
function shift({ kitchen = 0, minutes = 3, rng = () => 0 } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { kitchen, minutes };
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new KitchenRush(ctx, rng);
  g.start();
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(g.phase, 'play');
  return { ctx, g };
}

/** The first tile of this kind in the kitchen: [x, y]. */
function find(g, ch) {
  for (let y = 0; y < SIZE.h; y++) for (let x = 0; x < SIZE.w; x++) if (g.layout[y][x] === ch) return [x, y];
  throw new Error('no ' + ch);
}

/** Stand chef `slot` on the floor next to tile [x, y], facing it. */
function stand(g, slot, [x, y]) {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const fx = x + dx;
    const fy = y + dy;
    if (g.layout[fy] && g.layout[fy][fx] === ' ') {
      Object.assign(g.chefs[slot], { x: fx + 0.5, y: fy + 0.5, face: [-dx, -dy] });
      return;
    }
  }
  throw new Error('nowhere to stand by ' + x + ',' + y);
}

const act = (g, slot) => g.onInput(slot, { type: 'act' });
const held = (g, slot) => g.chefs[slot].held;

/** Take a fresh ingredient from its crate. */
function take(g, slot, crate) {
  stand(g, slot, find(g, crate));
  act(g, slot);
}

test('the kitchens: 14 × 8, walled in, every station reachable from the floor; Split really is split, with a counter to pass things over', () => {
  assert.deepEqual(KITCHENS.map((k) => k.name), ['Diner', 'Split', 'Rush Hour']);
  for (const k of KITCHENS) {
    assert.equal(k.layout.length, SIZE.h, k.name);
    for (const row of k.layout) assert.equal(row.length, SIZE.w, k.name + ': ' + row);
    for (const ch of 'BMTLCSPXH') assert.ok(k.layout.some((r) => r.includes(ch)), k.name + ' has ' + ch);
    // Every station (not plain wall) has a floor tile beside it.
    k.layout.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ' ' || ch === '#') return;
      const nearFloor = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => (k.layout[y + dy] || '')[x + dx] === ' ');
      assert.ok(nearFloor, k.name + ': ' + ch + ' at ' + x + ',' + y + ' is out of reach');
    }));
    for (const [x, y] of k.spawn) assert.equal(k.layout[Math.floor(y)][Math.floor(x)], ' ');
  }
  // Split: the two chefs' floors don't meet, but a counter tile touches both.
  const split = KITCHENS[1];
  const region = (sx, sy) => {
    const seen = new Set([sx + ',' + sy]);
    const todo = [[sx, sy]];
    while (todo.length) {
      const [x, y] = todo.pop();
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const k = x + dx + ',' + (y + dy);
        if (!seen.has(k) && (split.layout[y + dy] || '')[x + dx] === ' ') { seen.add(k); todo.push([x + dx, y + dy]); }
      }
    }
    return seen;
  };
  const [a, b] = split.spawn.map(([x, y]) => region(Math.floor(x), Math.floor(y)));
  assert.ok(![...a].some((t) => b.has(t)), 'two separate halves');
  const pass = split.layout.some((row, y) => [...row].some((ch, x) => ch === '#' && a.has((x - 1) + ',' + y) && b.has((x + 1) + ',' + y)));
  assert.ok(pass, 'a counter to pass things across');
});

test('walking: you move with the stick, stop at counters, and face the way you last moved', () => {
  const { ctx, g } = shift();
  const c = g.chefs[0];
  Object.assign(c, { x: 3.5, y: 2.5 });
  g.onInput(0, { type: 'move', x: 0, y: -1 });
  ctx.advance(2000);
  assert.ok(c.y >= 1 + 0.3 - 1e-9 && c.y < 1.5, 'stopped against the top counter: ' + c.y);
  assert.deepEqual(c.face, [0, -1]);
  g.onInput(0, { type: 'move', x: 0, y: 0 });
  const y = c.y;
  ctx.advance(500);
  assert.equal(c.y, y, 'let go: stop');
  assert.deepEqual(c.face, [0, -1], 'still facing up');
  g.onInput(0, { type: 'move', x: 9, y: 0.2 }); // too long: cut to length 1
  ctx.advance(100);
  assert.deepEqual(c.face, [1, 0]);
});

test('crates hand out raw ingredients; worktops hold one thing; pick it back up', () => {
  const { g } = shift();
  take(g, 0, 'T');
  assert.deepEqual(held(g, 0), { kind: 'tomato', state: 'raw' });
  act(g, 0); // the crate doesn't take it back
  assert.equal(held(g, 0).kind, 'tomato');
  const island = [5, 3];
  assert.equal(g.layout[3][5], '#');
  stand(g, 0, island);
  act(g, 0);
  assert.equal(held(g, 0), null);
  assert.equal(g.items[g.key(island)].kind, 'tomato');
  act(g, 0);
  assert.equal(held(g, 0).kind, 'tomato');
});

test('chopping: hold CHOP at a board with a tomato or lettuce on it; let go and it waits', () => {
  const { ctx, g } = shift();
  take(g, 0, 'L');
  const board = find(g, 'C');
  stand(g, 0, board);
  act(g, 0);
  g.onInput(0, { type: 'chop', on: true });
  ctx.advance(TIMING.chopMs / 2);
  g.onInput(0, { type: 'chop', on: false });
  ctx.advance(TIMING.chopMs);
  assert.equal(g.items[g.key(board)].state, 'raw', 'not without you');
  assert.ok(Math.abs(g.items[g.key(board)].progress - 0.5) < 0.05);
  g.onInput(0, { type: 'chop', on: true });
  ctx.advance(TIMING.chopMs / 2 + 50);
  assert.equal(g.items[g.key(board)].state, 'chopped');
  // Meat doesn't go on a chopping board; a chopped one can't be chopped again.
  act(g, 0);
  assert.deepEqual(held(g, 0), { kind: 'lettuce', state: 'chopped' });
  stand(g, 0, find(g, 'X'));
  act(g, 0); // hands free (one thing at a time)
  take(g, 0, 'M');
  stand(g, 0, board);
  act(g, 0);
  assert.equal(held(g, 0).kind, 'meat');
});

test('cooking: meat on a stove cooks by itself, and burns if you leave it', () => {
  const { ctx, g } = shift();
  take(g, 0, 'M');
  const stove = find(g, 'S');
  stand(g, 0, stove);
  act(g, 0);
  ctx.advance(TIMING.cookMs + 50);
  assert.equal(g.items[g.key(stove)].state, 'cooked');
  ctx.advance(TIMING.burnMs);
  assert.equal(g.items[g.key(stove)].state, 'burnt');
  // Only meat goes on a stove.
  act(g, 0);
  stand(g, 0, find(g, 'X'));
  act(g, 0);
  take(g, 0, 'T');
  stand(g, 0, stove);
  act(g, 0);
  assert.equal(held(g, 0).kind, 'tomato');
});

test('plating up: a plate from the stack, a bun straight from its crate, cooked meat from the stove, serve it at the hatch', () => {
  const { ctx, g } = shift();
  g.orders = [{ id: 1, recipe: 'plain', born: ctx.now(), until: ctx.now() + 60000 }];
  take(g, 0, 'M');
  stand(g, 0, find(g, 'S'));
  act(g, 0);
  ctx.advance(TIMING.cookMs + 50);
  take(g, 1, 'P');
  assert.deepEqual(held(g, 1), { kind: 'plate', contents: [] });
  take(g, 1, 'B'); // holding a plate at the bun crate: a bun onto it
  assert.deepEqual(held(g, 1).contents, ['bun']);
  stand(g, 1, find(g, 'S'));
  act(g, 1);
  assert.deepEqual(held(g, 1).contents.sort(), ['bun', 'meat']);
  assert.equal(g.items[g.key(find(g, 'S'))], undefined, 'the meat came off the stove');
  stand(g, 1, find(g, 'H'));
  act(g, 1);
  assert.equal(held(g, 1), null);
  assert.equal(g.orders.length, 0);
  assert.ok(g.coins >= COINS.dish && g.coins <= COINS.dish + COINS.tip);
  assert.equal(g.served, 1);
});

test('only ready food goes on a plate: no raw tomato, no burnt meat, no doubles', () => {
  const { ctx, g } = shift();
  take(g, 0, 'P');
  const top = [5, 3];
  stand(g, 0, top);
  act(g, 0); // the plate on the counter
  take(g, 0, 'T');
  stand(g, 0, top);
  act(g, 0); // raw: no
  assert.equal(held(g, 0).kind, 'tomato');
  assert.deepEqual(g.items[g.key(top)].contents, []);
  stand(g, 0, find(g, 'C'));
  act(g, 0);
  g.onInput(0, { type: 'chop', on: true });
  ctx.advance(TIMING.chopMs + 50);
  g.onInput(0, { type: 'chop', on: false });
  act(g, 0);
  stand(g, 0, top);
  act(g, 0); // chopped tomato onto the plate on the counter
  assert.deepEqual(g.items[g.key(top)].contents, ['tomato']);
  take(g, 0, 'T');
  stand(g, 0, find(g, 'C'));
  act(g, 0);
  g.onInput(0, { type: 'chop', on: true });
  ctx.advance(TIMING.chopMs + 50);
  act(g, 0);
  stand(g, 0, top);
  act(g, 0);
  assert.deepEqual(g.items[g.key(top)].contents, ['tomato'], 'one of each');
  assert.equal(held(g, 0).kind, 'tomato');
  // Into the bin with it.
  stand(g, 0, find(g, 'X'));
  act(g, 0);
  assert.equal(held(g, 0), null);
});

test('the hatch takes only a dish someone ordered; a plate in the bin is scraped, not thrown away', () => {
  const { g } = shift();
  g.orders = [{ id: 1, recipe: 'salad', born: 0, until: 1e9 }];
  g.chefs[0].held = { kind: 'plate', contents: ['bun', 'meat'] };
  stand(g, 0, find(g, 'H'));
  act(g, 0);
  assert.deepEqual(held(g, 0).contents, ['bun', 'meat'], 'nobody ordered that');
  assert.equal(g.coins, 0);
  stand(g, 0, find(g, 'X'));
  act(g, 0);
  assert.deepEqual(held(g, 0), { kind: 'plate', contents: [] });
  g.chefs[0].held = { kind: 'plate', contents: ['tomato', 'lettuce'] };
  stand(g, 0, find(g, 'H'));
  act(g, 0);
  assert.equal(g.orders.length, 0);
});

test('orders arrive over the shift (never more than four), and one that runs out costs coins', () => {
  const { ctx, g } = shift();
  assert.equal(g.orders.length, 2, 'two to start');
  for (const o of g.orders) assert.ok(Object.keys(RECIPES).includes(o.recipe));
  ctx.advance(TIMING.orderEveryMs[0] + 50);
  assert.equal(g.orders.length, 3);
  g.coins = 50;
  const first = g.orders[0];
  ctx.advance(first.until - ctx.now() + 50);
  assert.ok(!g.orders.includes(first));
  assert.ok(g.missed >= 1);
  assert.ok(g.coins <= 50 - COINS.missed);
  // Four at most, while they're still coming in (nobody serving).
  for (let t = 0; t < 120000 && g.phase === 'play'; t += 1000) {
    ctx.advance(1000);
    assert.ok(g.orders.length <= MAX_ORDERS, String(g.orders.length));
  }
  assert.ok(g.coins >= 0, 'never below zero');
});

test('Rush Hour: orders come faster and must be served sooner', () => {
  assert.ok(TIMING.orderEveryMs[2] < TIMING.orderEveryMs[0]);
  assert.ok(TIMING.orderMs[2] < TIMING.orderMs[0]);
  const { g } = shift({ kitchen: 2 });
  assert.ok(g.orders[0].until - g.orders[0].born === TIMING.orderMs[2]);
});

test('Split: you pass things across the middle counter', () => {
  const { g } = shift({ kitchen: 1 });
  // Find a divider tile with floor on both sides.
  let mid = null;
  g.layout.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#' && row[x - 1] === ' ' && row[x + 1] === ' ' && !mid) mid = [x, y];
  }));
  assert.ok(mid);
  Object.assign(g.chefs[0], { x: mid[0] - 0.5, y: mid[1] + 0.5, face: [1, 0], held: { kind: 'bun', state: 'raw' } });
  act(g, 0);
  Object.assign(g.chefs[1], { x: mid[0] + 1.5, y: mid[1] + 0.5, face: [-1, 0], held: null });
  act(g, 1);
  assert.deepEqual(held(g, 1), { kind: 'bun', state: 'raw' });
});

test('star targets come from the orders a shift brings: three stars is in reach for a great team, in every kitchen and shift', () => {
  for (const k of [0, 1, 2]) {
    for (const minutes of [2, 3, 4]) {
      const t = starTargets(k, minutes);
      const orders = ordersIn(k, minutes);
      const best = orders * (COINS.dish + COINS.tip); // every order, every tip
      assert.ok(t[0] < t[1] && t[1] < t[2], String(t));
      assert.ok(t[2] <= orders * COINS.dish, k + '/' + minutes + ': three stars without needing every tip: ' + t[2] + ' of ' + best);
      assert.ok(t[0] >= 3 * COINS.dish, 'one star still takes a few dishes');
    }
  }
  assert.ok(starTargets(2, 3)[2] > starTargets(0, 3)[2], 'more orders, higher targets');
  const t = starTargets(0, 3);
  assert.deepEqual([0, t[0] - 1, t[0], t[1], t[2], t[2] + 50].map((c) => starsFor(c, t)), [0, 0, 1, 2, 3, 3]);
});

test('the shift ends on time: stars by coins earned, and it ends once with nothing left running', () => {
  const { ctx, g } = shift({ minutes: 2 });
  g.coins = 150;
  const overs = [];
  const update = ctx.update;
  ctx.update = () => { update(); if (g.phase === 'over') overs.push(g.hostView().stars); };
  ctx.advance(2 * 60000 + 100);
  assert.equal(g.phase, 'over');
  const v = g.hostView();
  assert.equal(v.maxStars, 3);
  assert.equal(v.stars, starsFor(g.coins, starTargets(0, 2)));
  assert.deepEqual(v.targets, starTargets(0, 2));
  assert.equal(overs.length, 1);
  assert.equal(ctx.pendingTimers(), 0);
  // A rematch: a clean kitchen, and nobody still walking from the last shift.
  g.items['5,3'] = { kind: 'bun', state: 'raw' };
  g.chefs[0].held = { kind: 'meat', state: 'raw' };
  g.controls[0] = { x: 1, y: 0, chop: true };
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'countdown');
  assert.deepEqual([g.coins, g.served, g.missed, g.orders.length, Object.keys(g.items).length], [0, 0, 0, 0, 0]);
  assert.deepEqual(g.chefs.map((c) => c.held), [null, null]);
  assert.deepEqual(g.controls[0], { x: 0, y: 0, chop: false });
  assert.equal(g.events.served, 0);
});

test('a plate won\'t go on a plate, a board or a stove; burnt meat never goes on a plate; only buns from a crate onto a plate', () => {
  const { g } = shift();
  const top = [5, 3];
  g.items[g.key(top)] = { kind: 'plate', contents: [] };
  g.chefs[0].held = { kind: 'plate', contents: ['bun'] };
  stand(g, 0, top);
  act(g, 0);
  assert.deepEqual(held(g, 0), { kind: 'plate', contents: ['bun'] }, 'no plate on a plate');
  for (const ch of ['C', 'S']) {
    stand(g, 0, find(g, ch));
    act(g, 0);
    assert.equal(held(g, 0).kind, 'plate', 'no plate on ' + ch);
  }
  take(g, 0, 'T');
  assert.deepEqual(held(g, 0).contents, ['bun'], 'a tomato crate adds nothing to a plate');
  // Burnt meat: not off the stove onto your plate, nor from your hands onto a plate on the counter.
  const stove = find(g, 'S');
  g.items[g.key(stove)] = { kind: 'meat', state: 'burnt', cook: 99999 };
  stand(g, 0, stove);
  act(g, 0);
  assert.deepEqual(held(g, 0).contents, ['bun']);
  g.chefs[1].held = { kind: 'meat', state: 'burnt' };
  stand(g, 1, top);
  act(g, 1);
  assert.deepEqual(g.items[g.key(top)].contents, []);
  assert.equal(held(g, 1).state, 'burnt');
});

test('meat keeps its cooking time when you lift it: no dodging the burn by putting it back', () => {
  const { ctx, g } = shift();
  take(g, 0, 'M');
  const stove = find(g, 'S');
  stand(g, 0, stove);
  act(g, 0);
  ctx.advance(TIMING.cookMs + TIMING.burnMs - 500); // half a second from burning
  act(g, 0);
  assert.equal(held(g, 0).state, 'cooked');
  act(g, 0); // back on the stove
  ctx.advance(600);
  assert.equal(g.items[g.key(stove)].state, 'burnt');
  // Raw meat lifted half-cooked carries on from where it was, too.
  stand(g, 0, find(g, 'X'));
  g.items[g.key(stove)] = undefined;
  delete g.items[g.key(stove)];
  take(g, 0, 'M');
  stand(g, 0, stove);
  act(g, 0);
  ctx.advance(TIMING.cookMs / 2);
  act(g, 0);
  act(g, 0);
  ctx.advance(TIMING.cookMs / 2 + 100);
  assert.equal(g.items[g.key(stove)].state, 'cooked');
});

test('one board chops at one chef\'s speed, however many are at it', () => {
  const { ctx, g } = shift();
  take(g, 0, 'L');
  const board = find(g, 'C');
  stand(g, 0, board);
  act(g, 0);
  stand(g, 1, board);
  g.onInput(0, { type: 'chop', on: true });
  g.onInput(1, { type: 'chop', on: true });
  ctx.advance(TIMING.chopMs * 0.75);
  assert.equal(g.items[g.key(board)].state, 'raw', 'not twice as fast');
  ctx.advance(TIMING.chopMs * 0.3);
  assert.equal(g.items[g.key(board)].state, 'chopped');
});

test('sliding: pushing diagonally into a counter slides you along it, and you never end up inside one', () => {
  const { ctx, g } = shift();
  const c = g.chefs[0];
  Object.assign(c, { x: 3.5, y: 1.5 });
  g.onInput(0, { type: 'move', x: 0.7, y: -0.7 });
  ctx.advance(500);
  assert.ok(c.x > 4.5, 'slid along: ' + c.x);
  assert.ok(Math.abs(c.y - 1.3) < 0.01, 'flush against the top counter: ' + c.y);
  // A long random walk in each kitchen: never inside a counter.
  for (const k of [0, 1, 2]) {
    let n = 7;
    const r = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
    const h = shift({ kitchen: k });
    for (let i = 0; i < 400; i++) {
      h.g.onInput(0, { type: 'move', x: r() * 2 - 1, y: r() * 2 - 1 });
      h.g.onInput(1, { type: 'move', x: r() * 2 - 1, y: r() * 2 - 1 });
      h.ctx.advance(100);
      for (const ch of h.g.chefs) {
        for (const [dx, dy] of [[-0.29, -0.29], [0.29, -0.29], [-0.29, 0.29], [0.29, 0.29]]) {
          assert.equal(h.g.layout[Math.floor(ch.y + dy)][Math.floor(ch.x + dx)], ' ', KITCHENS[k].name + ' at ' + ch.x + ',' + ch.y);
        }
      }
      if (h.g.phase !== 'play') break;
    }
  }
});

test('ACTION faces the way the stick points now (a controller can turn and press in the same moment)', () => {
  const { g } = shift();
  const c = g.chefs[1];
  Object.assign(c, { x: 4.5, y: 1.5, face: [0, 1], held: null });
  g.onInput(1, { type: 'move', x: 0, y: -1 });
  act(g, 1);
  assert.deepEqual(c.face, [0, -1]);
  assert.equal(held(g, 1).kind, 'lettuce', 'took from the crate above, not the floor below');
});

test('a controller sends its stick and CHOP together, held state kept until it changes', () => {
  const { ctx, g } = shift();
  take(g, 1, 'T');
  const board = find(g, 'C');
  stand(g, 1, board);
  act(g, 1);
  g.onInput(1, { type: 'move', x: 0, y: 0, chop: true });
  ctx.advance(TIMING.chopMs + 50);
  assert.equal(g.items[g.key(board)].state, 'chopped');
  g.onInput(1, { type: 'move', x: 0, y: 0 }); // (no chop field: unchanged)
  assert.equal(g.controls[1].chop, true);
  g.onInput(1, { type: 'move', x: 0, y: 0, chop: false });
  assert.equal(g.controls[1].chop, false);
});

test('bad input is ignored; nothing moves or happens outside the shift', () => {
  const { ctx, g } = shift();
  const c = g.chefs[0];
  const before = JSON.stringify(c);
  for (const input of [{ type: 'move', x: 'a', y: 1 }, { type: 'move', x: NaN, y: 0 }, { type: 'move', x: 1 }, { type: 'chop', on: 'yes' }, { type: 'cook' }]) g.onInput(0, input);
  assert.deepEqual(g.controls[0], { x: 0, y: 0, chop: false });
  ctx.advance(500);
  assert.equal(JSON.stringify(c), before);
  g.chefs[1].held = null;
  const items = JSON.stringify(g.items);
  g.onInput(7, { type: 'act' });
  g.onInput(-1, { type: 'move', x: 1, y: 0 });
  assert.equal(JSON.stringify(g.items), items);
  assert.deepEqual(g.controls.map((k) => k.x), [0, 0]);
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'play');
});

test('the views: everything the TV draws, and each phone gets its own chef first', () => {
  const { g } = shift({ kitchen: 1 });
  const v = g.hostView();
  assert.equal(v.layout.length, SIZE.h);
  assert.equal(v.chefs.length, 2);
  assert.ok(Array.isArray(v.orders) && typeof v.coins === 'number' && v.timeLeftMs > 0);
  assert.equal(g.playerView(1).you, 1);
  assert.equal(v.kitchen, 'Split');
});

test('in the lobby: a co-op game (casual), with the kitchen and the shift length to pick, played with phones or controllers', () => {
  const def = getGame('kitchen-rush');
  assert.equal(def.category, 'casual');
  assert.ok(!def.phoneOnly);
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"kitchen"') && setup.includes('"minutes"'));
  assert.ok(setup.includes('Diner') && setup.includes('Split') && setup.includes('Rush Hour'));
});
