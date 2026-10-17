import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sumo, RING, PLAYER, DASH, TIMING, WIN_SCORE, FIELD } from '../server/games/sumo.js';
import { fakeCtx } from './helpers.js';

function setup() {
  const ctx = fakeCtx();
  const game = new Sumo(ctx);
  game.start();
  return { ctx, game };
}

const toPlay = (ctx) => ctx.advance(TIMING.countdownMs + 20);
const dist = (p) => Math.hypot(p.x - FIELD.w / 2, p.y - FIELD.h / 2);

test('counts down, then the round starts with both discs on the ring', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  ctx.advance(1000);
  assert.equal(game.hostView().countdown, 2);
  game.onInput(0, { type: 'move', x: 1, y: 0 }); // steering in the countdown does nothing yet
  ctx.advance(TIMING.countdownMs);
  assert.equal(game.phase, 'play');
  for (const d of game.hostView().discs) assert.ok(dist(d) < RING.r);
});

test('steering builds speed up to a cap; letting go slows you down', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'move', x: 0, y: -1 });
  ctx.advance(800); // not long enough to slide off the ring
  const p = game.players[0];
  const speed = Math.hypot(p.vx, p.vy);
  assert.ok(speed > PLAYER.maxSpeed * 0.7 && speed <= PLAYER.maxSpeed + 1e-9, `speed ${speed}`);
  assert.ok(p.vy < 0, 'moving up');
  for (let i = 0; i < 300; i++) {
    p.x = FIELD.w / 2 - 2; // keep pushing on the spot (without sliding off): the speed caps out
    p.y = FIELD.h / 2;
    game.step(1 / 60, ctx.now());
  }
  assert.equal(game.phase, 'play');
  assert.ok(Math.hypot(p.vx, p.vy) <= PLAYER.maxSpeed + 1e-9);
  p.x = FIELD.w / 2 - 2; // back near the middle before coasting
  p.y = FIELD.h / 2;
  game.onInput(0, { type: 'move', x: 0, y: 0 });
  ctx.advance(1500);
  assert.ok(Math.hypot(p.vx, p.vy) < speed * 0.2, 'drag slows it down');
});

test('bad move input is ignored; long sticks are clamped to length 1', () => {
  const { game } = setup();
  game.onInput(0, { type: 'move', x: 'a', y: 0 });
  game.onInput(0, { type: 'move', x: NaN, y: 1 });
  assert.deepEqual(game.controls[0], { x: 0, y: 0 });
  game.onInput(0, { type: 'move', x: 3, y: 4 });
  assert.ok(Math.abs(Math.hypot(game.controls[0].x, game.controls[0].y) - 1) < 1e-9);
});

test('dash: a burst of speed with a cooldown', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(1, { type: 'move', x: -1, y: 0 });
  game.onInput(1, { type: 'dash' });
  const p = game.players[1];
  assert.ok(Math.abs(p.vx + DASH.speed) < 1e-9, 'dashes where the stick points');
  assert.equal(game.dashes[1], 1);
  assert.ok(game.hostView().discs[1].dashing);
  game.onInput(1, { type: 'dash' }); // still cooling down
  assert.equal(game.dashes[1], 1);
  assert.ok(game.hostView().discs[1].dashIn > 0);
  game.step = () => {}; // hold everyone still while the cooldown runs
  ctx.advance(DASH.cooldownMs);
  game.onInput(1, { type: 'dash' });
  assert.equal(game.dashes[1], 2);
});

test('a dash with the stick centred goes at the rival', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'dash' });
  assert.ok(game.players[0].vx > 0, 'player 1 starts on the left, so it dashes right');
});

test('discs bump off each other; a dashing hit knocks harder', () => {
  const plain = setup();
  toPlay(plain.ctx);
  const [a1, b1] = plain.game.players;
  a1.x = b1.x - 2 * PLAYER.r + 0.01; // touching
  a1.vx = 5;
  b1.vx = 0;
  plain.game.collide(plain.ctx.now());
  assert.equal(plain.game.bumps, 1);
  const normalKick = b1.vx;
  assert.ok(normalKick > 0 && a1.vx < 5);

  const dashed = setup();
  toPlay(dashed.ctx);
  const [a2, b2] = dashed.game.players;
  a2.x = b2.x - 2 * PLAYER.r + 0.01;
  a2.vx = 5;
  b2.vx = 0;
  a2.dashUntil = dashed.ctx.now() + 100;
  dashed.game.collide(dashed.ctx.now());
  assert.ok(b2.vx > normalKick * 1.4, `dash knockback ${b2.vx} vs ${normalKick}`);
});

test('leaving the ring loses the round; first to WIN_SCORE wins the match', () => {
  const { ctx, game } = setup();
  for (let r = 0; r < WIN_SCORE; r++) {
    toPlay(ctx);
    game.players[1].x = FIELD.w / 2 + RING.r + 0.5; // shoved off
    ctx.advance(20);
    if (r < WIN_SCORE - 1) {
      assert.equal(game.phase, 'roundEnd');
      assert.deepEqual(game.result, { winner: 0, draw: false, reason: 'out' });
      assert.equal(game.hostView().discs[1].out, true);
      ctx.advance(TIMING.roundEndMs);
    }
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.deepEqual(game.scores, [WIN_SCORE, 0]);
  assert.equal(ctx.pendingTimers(), 0, 'the loop stops');
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});

test('both out together is a draw; nobody scores', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.players[0].x = FIELD.w / 2 - RING.r - 0.5;
  game.players[1].x = FIELD.w / 2 + RING.r + 0.5;
  ctx.advance(20);
  assert.deepEqual(game.result, { winner: null, draw: true, reason: 'out' });
  assert.deepEqual(game.scores, [0, 0]);
});

test('the ring shrinks after a while, down to its minimum', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  // Keep both discs safely in the middle (and apart) while time passes.
  const park = () => {
    game.players[0].x = FIELD.w / 2 - 0.7; game.players[0].y = FIELD.h / 2; game.players[0].vx = game.players[0].vy = 0;
    game.players[1].x = FIELD.w / 2 + 0.7; game.players[1].y = FIELD.h / 2; game.players[1].vx = game.players[1].vy = 0;
  };
  park();
  ctx.advance(RING.shrinkAfterMs - 100);
  assert.equal(game.hostView().ring.r, RING.r);
  assert.equal(game.hostView().ring.shrinking, false);
  park();
  ctx.advance(RING.shrinkMs / 2);
  const half = game.hostView().ring.r;
  assert.ok(half < RING.r && half > RING.minR, `half-way radius ${half}`);
  assert.equal(game.hostView().ring.shrinking, true);
  park();
  ctx.advance(RING.shrinkMs);
  assert.ok(Math.abs(game.ringR - RING.minR) < 1e-9);
});

test('a round that runs out of time is a draw', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  // Freeze both discs in the middle so nobody falls.
  game.step = () => {};
  ctx.advance(TIMING.roundMs + 100);
  assert.deepEqual(game.result, { winner: null, draw: true, reason: 'time' });
});
