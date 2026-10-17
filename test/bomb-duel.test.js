import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BombDuel, W, H, SPAWNS, RULES, TIMING, isPillar, makeCrates, spiral } from '../server/games/bomb-duel.js';
import { fakeCtx } from './helpers.js';

const key = (x, y) => y * W + x;

/** A game in the play phase on an empty arena (no crates), unless crates are given. */
function playing(crates = []) {
  const ctx = fakeCtx();
  const game = new BombDuel(ctx, () => 0.99); // rng: no drops, no crates
  game.start();
  game.onInput(0, { type: 'go' });
  game.crates = new Set(crates.map(([x, y]) => key(x, y)));
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.phase, 'play');
  return { ctx, game };
}

const hold = (ctx, game, slot, dir, ms) => {
  game.onInput(slot, { type: 'move', dir });
  ctx.advance(ms);
  game.onInput(slot, { type: 'move', dir: null });
};
const settle = (ctx) => ctx.advance(1000); // reach the next cell centre and stop

test('the arena: pillars in a grid, crates leave both spawn corners clear', () => {
  assert.ok(isPillar(0, 5) && isPillar(W - 1, 5) && isPillar(2, 2) && isPillar(4, 6));
  assert.ok(!isPillar(1, 1) && !isPillar(3, 2) && !isPillar(1, 2));
  const crates = makeCrates(100);
  for (const [sx, sy] of SPAWNS) {
    for (const [x, y] of [[sx, sy], [sx + 1, sy], [sx - 1, sy], [sx, sy + 1], [sx, sy - 1]]) assert.ok(!crates.has(key(x, y)), `${x},${y} clear`);
  }
  for (const c of crates) assert.ok(!isPillar(c % W, Math.floor(c / W)));
  assert.ok(makeCrates(40).size < makeCrates(85).size);
  const order = spiral();
  assert.deepEqual(order[0], [1, 1]);
  assert.equal(new Set(order.map(([x, y]) => key(x, y))).size, order.length);
  assert.equal(order.length, (W - 2) * (H - 2) - ((W - 3) / 2) * ((H - 3) / 2), 'every open cell once');
});

test('players walk cell to cell, stop at walls and crates, and reverse any time', () => {
  const { ctx, game } = playing([[4, 1]]);
  const p = game.players[0];
  hold(ctx, game, 0, 'right', 300);
  settle(ctx);
  assert.equal(p.x, 3, 'stopped in front of the crate at 4,1');
  assert.equal(p.y, 1);
  hold(ctx, game, 0, 'up', 500);
  assert.equal(p.y, 1, 'the border is solid');
  hold(ctx, game, 0, 'down', 100);
  settle(ctx);
  assert.deepEqual([p.x, p.y], [3, 2], '3,2 is open (pillars sit on even x and y)');
});

test('movement details', () => {
  const { ctx, game } = playing();
  const p = game.players[0];
  // (2,2) is a pillar: from (1,1) going down reaches (1,2), (1,3)...
  game.onInput(0, { type: 'move', dir: 'down' });
  ctx.advance(1000 / RULES.speed + 10);
  assert.ok(p.y > 1 && p.y < 3);
  game.onInput(0, { type: 'move', dir: 'up' }); // reverse mid-way
  ctx.advance(2000);
  assert.equal(p.y, 1);
  game.onInput(0, { type: 'move', dir: null });
  // Let go between cells: slide on to the next centre and stop there.
  game.onInput(0, { type: 'move', dir: 'right' });
  ctx.advance(150);
  game.onInput(0, { type: 'move', dir: null });
  ctx.advance(1000);
  assert.deepEqual([p.x, p.y], [2, 1]);
  // Turning only happens at a cell centre: (2,2) below is a pillar.
  game.onInput(0, { type: 'move', dir: 'down' });
  ctx.advance(500);
  assert.deepEqual([p.x, p.y], [2, 1]);
});

test('a bomb blasts in a cross after its fuse, stops at pillars and the first crate, and kills', () => {
  const { ctx, game } = playing([[5, 1], [1, 4]]);
  const p0 = game.players[0];
  game.onInput(0, { type: 'bomb' });
  game.onInput(0, { type: 'bomb' }); // only one bomb to start with
  assert.equal(game.bombs.length, 1);
  const boomAt = game.bombs[0].at;
  hold(ctx, game, 0, 'right', 450); // walk off the bomb (you can leave your own)
  ctx.advance(300);
  assert.equal(p0.x, 3, 'out of range 2 at x=3');
  hold(ctx, game, 0, 'left', 50);
  ctx.advance(300);
  assert.equal(p0.x, 2);
  hold(ctx, game, 0, 'left', 300); // ...but you can't walk back onto the bomb
  assert.equal(p0.x, 2);
  ctx.advance(boomAt - ctx.now() + 50); // just after the blast
  assert.equal(game.bombs.length, 0);
  assert.equal(p0.alive, false, 'x=2 is inside the blast');
  const fire = game.hostView().fire;
  assert.ok(fire.includes(key(1, 1)) && fire.includes(key(3, 1)) && fire.includes(key(1, 3)));
  assert.ok(!fire.includes(key(4, 1)), 'range 2');
});

test('blasts smash the first crate they hit; chains set off other bombs; crates can hide power-ups', () => {
  const { ctx, game } = playing([[3, 1], [1, 3]]);
  game.rng = () => 0; // every smashed crate drops a power-up (the first kind)
  game.players[0].maxBombs = 2;
  game.onInput(0, { type: 'bomb' });
  // A second bomb two cells down (walk there first): the first blast sets it off.
  game.players[0].y = 2;
  game.players[0].x = 1;
  game.onInput(0, { type: 'bomb' });
  game.players[0].x = W - 2; // move player 1 away from danger
  game.players[0].y = H - 2;
  game.players[1].x = W - 2;
  game.players[1].y = 1;
  ctx.advance(RULES.fuseMs + 50);
  assert.equal(game.bombs.length, 0, 'both went off at once');
  assert.ok(!game.crates.has(key(3, 1)) && !game.crates.has(key(1, 3)));
  assert.equal(game.powerups.get(key(3, 1)), 'bomb');
  // Picking one up.
  const p1 = game.players[1];
  p1.x = 3;
  p1.y = 1;
  ctx.advance(RULES.fireMs + 50);
  assert.equal(p1.maxBombs, 2);
  assert.ok(!game.powerups.has(key(3, 1)));
});

test('a trade is a drawn round; a clean kill scores; first to the wins needed takes it', () => {
  const ctx = fakeCtx();
  const game = new BombDuel(ctx, () => 0.99);
  game.start();
  game.onInput(0, { type: 'setting', key: 'wins', value: 2 });
  game.onInput(0, { type: 'go' });
  for (let round = 1; round <= 3; round++) {
    game.crates = new Set();
    ctx.advance(TIMING.countdownMs + 50);
    const [a, b] = game.players;
    if (round === 1) {
      // Both stand next to one bomb.
      b.x = 2;
      b.y = 1;
      game.onInput(0, { type: 'bomb' });
    } else {
      // Player 2 bombs player 1 and walks away.
      b.x = 1;
      b.y = 2;
      game.onInput(1, { type: 'bomb' });
      b.y = 5;
    }
    ctx.advance(RULES.fuseMs + TIMING.settleMs + 100);
    assert.equal(game.phase, 'roundEnd');
    if (round === 1) assert.equal(game.result.draw, true);
    else assert.equal(game.result.winner, 1);
    assert.equal(a.alive, false);
    ctx.advance(TIMING.roundEndMs + 50);
  }
  assert.deepEqual(game.scores, [0, 2]);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});

test('sudden death: after 90 s walls close in from the edges and crush whoever is there', () => {
  const { ctx, game } = playing();
  ctx.advance(TIMING.suddenDeathMs - 1000);
  assert.equal(game.walls.size, 0);
  assert.equal(game.hostView().suddenDeath, false);
  ctx.advance(1000 + TIMING.wallEveryMs * 2);
  assert.ok(game.walls.has(key(1, 1)), 'the first wall drops on the top-left corner');
  assert.equal(game.players[0].alive, false, 'player 1 was standing there');
  assert.equal(game.hostView().suddenDeath, true);
  ctx.advance(TIMING.settleMs + 100);
  assert.equal(game.result.winner, 1);
});

test('setup: wins needed and crates, remembered by the room; bad input is ignored', () => {
  const ctx = fakeCtx();
  const game = new BombDuel(ctx);
  game.start();
  assert.deepEqual(game.settings, { wins: 3, crates: 65 });
  game.onInput(1, { type: 'setting', key: 'crates', value: 85 });
  game.onInput(1, { type: 'setting', key: 'crates', value: 100 });
  game.onInput(1, { type: 'bomb' }); // nothing to do in setup
  assert.deepEqual(ctx.saved.settings, { wins: 3, crates: 85 });
  game.onInput(0, { type: 'go' });
  game.onInput(0, { type: 'move', dir: 'sideways' });
  assert.equal(game.players[0].want, null);
  assert.ok(game.crates.size > 50);
});
