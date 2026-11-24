import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Breaker, FIELD, PADDLE, TIMING, LIVES, ROW_POINTS } from '../server/solo/games/breaker-1p.js';

function game(settings) {
  const ctx = fakeCtx('Ana', settings);
  const g = new Breaker(ctx);
  g.start();
  return { ctx, g };
}

test('the ball waits on the paddle, then launches by itself', () => {
  const { ctx, g } = game();
  assert.equal(g.phase, 'serve');
  ctx.advance(TIMING.autoLaunchMs + 50);
  assert.equal(g.phase, 'play');
  assert.ok(g.ball.vy < 0, 'flies up');
});

test('the paddle follows the phone and stays in the field', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'aim', x: 1 });
  ctx.advance(2000);
  assert.equal(g.paddleX, FIELD.w - PADDLE.w / 2);
  g.onInput({ type: 'axis', v: -1 });
  ctx.advance(2000);
  assert.equal(g.paddleX, PADDLE.w / 2);
  g.onInput({ type: 'aim', x: NaN });
  g.onInput({ type: 'axis', v: 'left' });
  assert.equal(g.axis, -1);
});

test('a brick hit scores its row and bounces the ball back', () => {
  const { g } = game();
  g.onInput({ type: 'launch' });
  const k = g.bricks.find((b) => b.row === 5);
  // Put the ball just under a bottom-row brick, flying up.
  Object.assign(g.ball, { x: k.x + k.w / 2, y: k.y + k.h + 1.2, vx: 0, vy: -50 });
  g.step(0.02);
  assert.equal(k.alive, false);
  assert.equal(g.score, ROW_POINTS[5]);
  assert.ok(g.ball.vy > 0);
});

test('the paddle sends the ball back up, angled by where it hit', () => {
  const { g } = game();
  g.onInput({ type: 'launch' });
  Object.assign(g.ball, { x: g.paddleX + PADDLE.w / 2 - 1, y: PADDLE.y - 1.5, vx: 0, vy: 40 });
  g.step(0.02);
  assert.ok(g.ball.vy < 0);
  assert.ok(g.ball.vx > 0, 'off the right side goes right');
});

test('losing every ball ends the run with the score', () => {
  const { ctx, g } = game();
  for (let life = LIVES.normal; life > 0; life--) {
    g.onInput({ type: 'launch' });
    Object.assign(g.ball, { x: 2, y: FIELD.h - 1, vx: 0, vy: 80 });
    g.paddleX = FIELD.w - PADDLE.w / 2;
    g.onInput({ type: 'aim', x: 1 });
    ctx.advance(200);
    if (life > 1) {
      assert.equal(g.phase, 'lost');
      ctx.advance(TIMING.lostMs);
      assert.equal(g.phase, 'serve');
    }
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, 0);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'serve');
  assert.equal(g.lives, LIVES.normal);
});

test('clearing the wall starts the next level', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'launch' });
  for (const k of g.bricks) k.alive = false;
  const last = g.bricks[0];
  last.alive = true;
  Object.assign(g.ball, { x: last.x + last.w / 2, y: last.y + last.h + 1.2, vx: 0, vy: -50 });
  ctx.advance(TIMING.tickMs * 2);
  assert.equal(g.phase, 'cleared');
  ctx.advance(TIMING.levelMs + 50);
  assert.equal(g.phase, 'serve');
  assert.equal(g.hostView().level, 2);
  assert.ok(g.bricks.every((k) => k.alive));
});

test('pause freezes everything; easy mode has its own scores', () => {
  const { ctx, g } = game({ lives: 'easy' });
  assert.equal(g.lives, LIVES.easy);
  assert.equal(g.hostView().variant, 'Easy');
  g.onInput({ type: 'launch' });
  ctx.advance(100);
  g.onInput({ type: 'pause' });
  const at = { ...g.ball };
  ctx.advance(3000);
  assert.deepEqual({ ...g.ball }, at);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'pause' });
  ctx.advance(100);
  assert.notEqual(g.ball.y, at.y);
});
