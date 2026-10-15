import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pong, FIELD, PHYSICS, TIMING, WIN_SCORE } from '../server/games/pong.js';
import { fakeCtx } from './helpers.js';

function setup(rng = () => 0.5) {
  const ctx = fakeCtx();
  const game = new Pong(ctx, rng);
  game.start();
  return { ctx, game };
}

/** Put the ball somewhere with a velocity, in play. */
function launch(game, { x, y, vx, vy }) {
  game.phase = 'play';
  game.phaseEnds = null;
  Object.assign(game.ball, { x, y, vx, vy, speed: Math.hypot(vx, vy) });
}

test('counts down, then serves', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().countdown, 3);
  ctx.advance(TIMING.countdownMs + 20);
  assert.equal(game.phase, 'play');
  assert.notEqual(game.ball.vx, 0);
});

test('views are pushed about 30 times a second', () => {
  const { ctx } = setup();
  const before = ctx.updates;
  ctx.advance(1000);
  const pushed = ctx.updates - before;
  assert.ok(pushed >= 28 && pushed <= 33, `pushed ${pushed}`);
});

test('ball bounces off the top and bottom walls', () => {
  const { ctx, game } = setup();
  launch(game, { x: 8, y: FIELD.ballR + 0.05, vx: 0.1, vy: -6 });
  ctx.advance(50);
  assert.ok(game.ball.vy > 0);
  assert.ok(game.ball.y >= FIELD.ballR);
});

test('paddle hit returns the ball faster, angled by where it hit', () => {
  const { ctx, game } = setup();
  game.paddles[0] = 4.5;
  launch(game, { x: 2, y: 5.0, vx: -8, vy: 0 }); // hits below paddle centre
  ctx.advance(200);
  assert.ok(game.ball.vx > 0, 'bounced back to the right');
  assert.ok(game.ball.vy > 0, 'hit low on the paddle -> goes down');
  assert.ok(Math.hypot(game.ball.vx, game.ball.vy) > 8, 'sped up');
  assert.equal(game.rally, 1);
});

test('no tunnelling through a paddle at top speed, even with a late tick', () => {
  const { ctx, game } = setup();
  game.controls[1] = { mode: 'axis', v: 0 };
  game.paddles[1] = 4.5;
  launch(game, { x: 14.5, y: 4.5, vx: PHYSICS.ballMax, vy: 0 });
  ctx.advance(80); // several steps' worth in one go
  assert.ok(game.ball.vx < 0);
  assert.deepEqual(game.scores, [0, 0]);
});

test('missing the ball gives the other player the point, then a pause and a serve to the loser', () => {
  const { ctx, game } = setup();
  game.paddles[0] = 1.2; // far from the ball
  launch(game, { x: 3, y: 7, vx: -10, vy: 0 });
  ctx.advance(500);
  assert.deepEqual(game.scores, [0, 1]);
  assert.equal(game.phase, 'point');
  assert.equal(game.lastScorer, 1);
  ctx.advance(TIMING.pointMs + 20);
  assert.equal(game.phase, 'play');
  assert.ok(game.ball.vx < 0, 'served towards the player who conceded');
});

test('phone input moves the paddle towards the finger at the capped speed', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'move', y: 0 }); // top
  ctx.advance(100);
  const moved = FIELD.h / 2 - game.paddles[0];
  assert.ok(moved > 0 && moved <= PHYSICS.paddleSpeed * 0.1 + 0.25, `moved ${moved}`);
  ctx.advance(1000);
  assert.equal(game.paddles[0], FIELD.paddleH / 2, 'stops at the wall');
});

test('controller input moves the paddle by direction; bad input is ignored', () => {
  const { ctx, game } = setup();
  game.onInput(1, { type: 'axis', v: 1 });
  ctx.advance(100);
  assert.ok(game.paddles[1] > FIELD.h / 2);
  const y = game.paddles[1];
  game.onInput(1, { type: 'axis', v: 0 });
  game.onInput(1, { type: 'axis', v: 'fast' });
  game.onInput(1, { type: 'move', y: NaN });
  ctx.advance(100);
  assert.equal(game.paddles[1], y);
});

test('first to WIN_SCORE wins, the loop stops, and rematch restarts', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) game.point(0);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
  assert.equal(ctx.pendingTimers(), 1);
});
