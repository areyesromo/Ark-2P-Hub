import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Flappy, FIELD, BIRD, PIPES, TIMING } from '../server/solo/games/flappy.js';

function game() {
  const ctx = fakeCtx();
  const g = new Flappy(ctx, () => 0.5); // every gap in the middle
  g.start();
  return { ctx, g };
}

test('waits for the first flap, then falls without more', () => {
  const { ctx, g } = game();
  ctx.advance(2000);
  assert.equal(g.phase, 'ready');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'flap' });
  assert.equal(g.phase, 'play');
  ctx.advance(5000);
  assert.equal(g.phase, 'over');
  assert.equal(g.crashed, true);
  assert.equal(ctx.pendingTimers(), 0);
});

test('flapping in rhythm through middle gaps passes pipes and scores', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'flap' });
  // Keep the bird near the middle: flap whenever it drops below it.
  for (let t = 0; t < 20000 && g.phase === 'play'; t += TIMING.tickMs) {
    ctx.advance(TIMING.tickMs);
    if (g.bird.y > FIELD.h / 2 + 2) g.onInput({ type: 'flap' });
  }
  assert.equal(g.phase, 'play');
  assert.ok(g.hostView().score >= 5, `passed ${g.passed}`);
});

test('flapping at the top keeps the bird there instead of ending the run', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'flap' });
  g.pipes = [{ x: 500, gapY: 30, gap: PIPES.gap, passed: false }]; // nothing in the way for now
  for (let i = 0; i < 20; i++) {
    g.onInput({ type: 'flap' });
    ctx.advance(100);
  }
  assert.equal(g.phase, 'play');
  assert.ok(g.bird.y < BIRD.r + 2, 'still up at the top');
});

test('touching a pipe ends the run', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'flap' });
  g.pipes = [{ x: BIRD.x - 1, gapY: 50, gap: PIPES.gap, passed: false }]; // the gap is far below the bird
  ctx.advance(TIMING.tickMs * 2);
  assert.equal(g.phase, 'over');
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'ready');
  assert.equal(g.hostView().score, 0);
});

test('pause freezes the bird; only known inputs count', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'flap' });
  ctx.advance(100);
  g.onInput({ type: 'pause' });
  const y = g.bird.y;
  ctx.advance(3000);
  assert.equal(g.bird.y, y);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'nope' });
  g.onInput({ type: 'pause' });
  assert.equal(g.phase, 'play');
});
