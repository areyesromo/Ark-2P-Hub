import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsteroidDuel, FIELD, SHIP, BULLET, ROCK, TIMING, WIN_SCORE } from '../server/games/asteroid-duel.js';
import { fakeCtx } from './helpers.js';

function setup(rng = () => 0.3, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  let game = null;
  // As the room does: every update builds every view.
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (game) [game.hostView(), game.playerView(0), game.playerView(1)];
    update();
  };
  game = new AsteroidDuel(ctx, rng);
  game.start();
  return { ctx, game };
}

/** Straight into play, no rocks (unless given), ships where asked. */
function arena(game, { ships = [], rocks = [] } = {}) {
  game.phase = 'play';
  game.phaseEnds = null;
  game.roundEnds = game.ctx.now() + TIMING.roundMs;
  game.rocks = rocks.map((r, i) => ({ id: 1000 + i, vx: 0, vy: 0, ...r }));
  game.nextRockAt = Infinity;
  ships.forEach((s, i) => Object.assign(game.ships[i], s));
}

const play = (ctx) => ctx.advance(TIMING.countdownMs + 20);

test('counts down, then two ships face each other from mirrored spots, with mirrored rocks', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  play(ctx);
  assert.equal(game.phase, 'play');
  const [a, b] = game.ships;
  assert.ok(Math.abs(a.x - (FIELD.w - b.x)) < 1e-9 && Math.abs(a.y - (FIELD.h - b.y)) < 1e-9);
  assert.ok(Math.abs(Math.abs(a.angle - b.angle) - Math.PI) < 1e-9);
  const key = (r) => `${r.size},${r.x.toFixed(6)},${r.y.toFixed(6)}`;
  const mirror = (r) => key({ size: r.size, x: FIELD.w - r.x, y: FIELD.h - r.y });
  const rocks = game.rocks.map(key).sort();
  assert.deepEqual(game.rocks.map(mirror).sort(), rocks);
  assert.ok(rocks.length >= 2);
});

test('views are pushed about 30 times a second', () => {
  const { ctx } = setup();
  const before = ctx.updates;
  ctx.advance(1000);
  const pushed = ctx.updates - before;
  assert.ok(pushed >= 28 && pushed <= 33, `pushed ${pushed}`);
});

test('a light push only turns the ship; a full push thrusts that way; speed is capped', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: 4, y: 4.5, angle: 0, vx: 0, vy: 0 }, { x: 12, y: 4.5 }] });
  game.onInput(0, { type: 'move', x: 0, y: 0.3 }); // gently down the screen
  ctx.advance(600);
  const s = game.ships[0];
  assert.ok(Math.abs(s.angle - Math.PI / 2) < 0.05, 'faces down: ' + s.angle);
  assert.ok(Math.hypot(s.vx, s.vy) < 0.01, 'no thrust');
  game.onInput(0, { type: 'move', x: 0, y: 1 });
  ctx.advance(3000);
  assert.ok(s.vy > 0 && Math.hypot(s.vx, s.vy) <= SHIP.maxSpeed + 1e-9);
});

test('the edges wrap round', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: FIELD.w - 0.05, y: 2, angle: 0, vx: 3, vy: 0 }, { x: 8, y: 7 }] });
  ctx.advance(100);
  assert.ok(game.ships[0].x < 1, String(game.ships[0].x));
});

test('fire shoots from the nose; a short reload and a limit on shots in the air', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: 4, y: 4.5, angle: 0 }, { x: 12, y: 1 }] });
  game.onInput(0, { type: 'fire' });
  game.onInput(0, { type: 'fire' }); // reloading
  assert.equal(game.bullets.length, 1);
  assert.ok(game.bullets[0].vx > 0 && game.bullets[0].x > 4);
  for (let i = 0; i < BULLET.max + 2; i++) {
    ctx.advance(BULLET.reloadMs);
    game.onInput(0, { type: 'fire' });
  }
  assert.ok(game.bullets.filter((b) => b.owner === 0).length <= BULLET.max);
  ctx.advance(BULLET.lifeMs + 50);
  assert.equal(game.bullets.length, 0, 'shots fade out');
});

test('a hit costs a life; you come back at your spot with a shield that shots pass through', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: 4, y: 4.5, angle: 0 }, { x: 5.2, y: 4.5, angle: Math.PI }] });
  game.onInput(0, { type: 'fire' });
  ctx.advance(100);
  const t = game.ships[1];
  assert.equal(t.lives, SHIP.lives - 1);
  assert.equal(t.alive, false);
  ctx.advance(TIMING.respawnMs);
  assert.equal(t.alive, true);
  assert.ok(game.hostView().ships[1].shield, 'shielded');
  // Shielded: a shot passes through.
  Object.assign(game.ships[0], { x: t.x - 1.2, y: t.y, angle: 0, reloadUntil: 0 });
  game.onInput(0, { type: 'fire' });
  ctx.advance(150);
  assert.equal(t.lives, SHIP.lives - 1);
});

test('your own shots can\'t hit you', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: 4, y: 4.5, angle: 0, vx: 0, vy: 0 }, { x: 12, y: 1 }] });
  game.onInput(0, { type: 'fire' });
  game.ships[0].vx = 20; // racing after it
  ctx.advance(200);
  assert.equal(game.ships[0].lives, SHIP.lives);
});

test('a shot splits a big rock in two smaller ones; the smallest just break', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: 2, y: 4.5, angle: 0 }, { x: 14, y: 1 }], rocks: [{ x: 4, y: 4.5, size: 3 }] });
  game.onInput(0, { type: 'fire' });
  ctx.advance(200);
  assert.deepEqual(game.rocks.map((r) => r.size), [2, 2]);
  assert.equal(game.bullets.length, 0);
  arena(game, { ships: [{ x: 2, y: 4.5, angle: 0, reloadUntil: 0 }], rocks: [{ x: 4, y: 4.5, size: 1 }] });
  game.onInput(0, { type: 'fire' });
  ctx.advance(200);
  assert.equal(game.rocks.length, 0);
});

test('flying into a rock costs a life', () => {
  const { ctx, game } = setup();
  arena(game, { ships: [{ x: 4, y: 4.5, angle: 0, vx: 3, vy: 0 }, { x: 14, y: 1 }], rocks: [{ x: 5, y: 4.5, size: 2 }] });
  ctx.advance(300);
  assert.equal(game.ships[0].lives, SHIP.lives - 1);
});

test('rocks keep coming: an empty sky gets a new mirrored pair', () => {
  const { ctx, game } = setup();
  play(ctx);
  game.rocks = [];
  game.nextRockAt = 0;
  ctx.advance(200);
  assert.ok(game.rocks.length >= 2);
  const [a, b] = game.rocks;
  assert.ok(Math.abs(a.x - (FIELD.w - b.x)) < 1e-9 && a.size === b.size);
});

test('lose your last life and the round goes to your rival; first to the setting wins', () => {
  const { ctx, game } = setup(() => 0.3, { wins: 2 });
  for (let round = 0; round < 2; round++) {
    play(ctx);
    arena(game, { ships: [{ x: 4, y: 4.5, angle: 0, reloadUntil: 0 }, { x: 5.2, y: 4.5, lives: 1, shieldUntil: 0 }] });
    game.onInput(0, { type: 'fire' });
    ctx.advance(100);
    if (round === 0) {
      assert.equal(game.phase, 'roundEnd');
      assert.deepEqual(game.scores, [1, 0]);
      ctx.advance(TIMING.roundEndMs + 20);
      assert.equal(game.phase, 'countdown');
      assert.equal(game.ships[1].lives, SHIP.lives, 'lives back for the new round');
    }
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  const updates = ctx.updates;
  ctx.advance(2000);
  assert.equal(ctx.updates, updates, 'nothing runs after the end');
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});

test('both out of lives in the same moment: a drawn round', () => {
  const { ctx, game } = setup();
  play(ctx);
  arena(game, {
    ships: [{ x: 4, y: 2, angle: 0, vx: 2, vy: 0, lives: 1, shieldUntil: 0 }, { x: 12, y: 2, angle: Math.PI, vx: -2, vy: 0, lives: 1, shieldUntil: 0 }],
    rocks: [{ x: 5, y: 2, size: 2 }, { x: 11, y: 2, size: 2 }],
  });
  ctx.advance(400);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.scores, [0, 0]);
  assert.equal(game.hostView().result.draw, true);
});

test('time up: more lives left wins the round; level is a draw', () => {
  const a = setup();
  play(a.ctx);
  arena(a.game, { ships: [{ x: 4, y: 2, lives: 2 }, { x: 12, y: 7 }] });
  a.ctx.advance(TIMING.roundMs + 50);
  assert.deepEqual(a.game.scores, [0, 1]);
  const b = setup();
  play(b.ctx);
  arena(b.game, { ships: [{ x: 4, y: 2 }, { x: 12, y: 7 }] });
  b.ctx.advance(TIMING.roundMs + 50);
  assert.deepEqual(b.game.scores, [0, 0]);
});

test('bad input is ignored; the default is first to ' + WIN_SCORE, () => {
  const { ctx, game } = setup();
  assert.equal(game.winScore, WIN_SCORE);
  arena(game, { ships: [{ x: 4, y: 4.5, angle: 0 }, { x: 12, y: 4.5, angle: Math.PI }] });
  for (const bad of [{ type: 'move', x: '1', y: 0 }, { type: 'move', x: NaN, y: 0 }, { type: 'move', x: 1 }, { type: 'warp' }]) game.onInput(0, bad);
  game.onInput(2, { type: 'fire' });
  ctx.advance(300);
  assert.deepEqual([game.ships[0].x, game.ships[0].angle], [4, 0]);
  assert.equal(game.bullets.length, 0);
});

test('the phone view has lives and scores, not positions', () => {
  const { game } = setup();
  const v = game.playerView(0);
  assert.equal(v.you, 0);
  assert.deepEqual(v.lives, [SHIP.lives, SHIP.lives]);
  assert.equal(v.ships, undefined);
  assert.ok(ROCK.sizes.length === 3);
});
