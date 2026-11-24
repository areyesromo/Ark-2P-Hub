import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Snake, GRID, TIMING, START_LENGTH } from '../server/solo/games/snake-1p.js';

/** A snake past the countdown, with the food somewhere out of the way. */
function playing(settings) {
  const ctx = fakeCtx('Ana', settings);
  const g = new Snake(ctx, () => 0.99);
  g.start();
  ctx.advance(TIMING.countdownMs);
  assert.equal(g.phase, 'play');
  return { ctx, g };
}

const ticks = (ctx, g, n) => { for (let i = 0; i < n; i++) ctx.advance(1000 / g.cps); };

test('counts down, then moves one cell per tick', () => {
  const { ctx, g } = playing();
  const [x, y] = g.body[0];
  ticks(ctx, g, 1);
  assert.deepEqual(g.body[0], [x + 1, y]);
  assert.equal(g.body.length, START_LENGTH);
});

test('eating grows the snake and scores', () => {
  const { ctx, g } = playing();
  const [x, y] = g.body[0];
  g.food = [x + 1, y];
  ticks(ctx, g, 1);
  assert.equal(g.hostView().score, 1);
  assert.equal(g.body.length, START_LENGTH + 1);
  assert.ok(g.food && !(g.food[0] === x + 1 && g.food[1] === y), 'new food somewhere else');
});

test('ignores reversing into your own neck; queues two quick turns', () => {
  const { ctx, g } = playing();
  g.onInput({ type: 'turn', dir: 'left' });
  assert.equal(g.queue.length, 0);
  g.onInput({ type: 'turn', dir: 'up' });
  g.onInput({ type: 'turn', dir: 'left' });
  assert.deepEqual(g.queue, ['up', 'left']);
  g.onInput({ type: 'turn', dir: 'nope' });
  g.onInput({ type: 'turn', dir: 'constructor' });
  assert.deepEqual(g.queue, ['up', 'left']);
  ticks(ctx, g, 2);
  assert.equal(g.dir, 'left');
});

test('a solid wall ends the run; the score is what you ate', () => {
  const { ctx, g } = playing();
  ticks(ctx, g, GRID.w);
  assert.equal(g.phase, 'over');
  assert.equal(g.crashed, true);
  assert.equal(g.hostView().score, 0);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'countdown');
});

test('wrap walls bring you out the other side, and the variant says so', () => {
  const { ctx, g } = playing({ walls: 'wrap', speed: 'fast' });
  ticks(ctx, g, GRID.w);
  assert.equal(g.phase, 'play');
  assert.equal(g.hostView().variant, 'Fast · Wrap');
});

test('pause stops the clock and resumes where it was', () => {
  const { ctx, g } = playing();
  g.onInput({ type: 'pause' });
  assert.equal(g.phase, 'paused');
  const head = g.body[0].slice();
  ctx.advance(5000);
  assert.deepEqual(g.body[0], head);
  g.onInput({ type: 'pause' });
  ticks(ctx, g, 1);
  assert.notDeepEqual(g.body[0], head);
});
