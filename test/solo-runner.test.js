import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Runner, RUNNER, TIMING } from '../server/solo/games/runner.js';

function game() {
  const ctx = fakeCtx();
  const g = new Runner(ctx, seeded(5));
  g.start();
  return { ctx, g };
}

test('waits for the first jump; then the distance counts up', () => {
  const { ctx, g } = game();
  ctx.advance(2000);
  assert.equal(g.phase, 'ready');
  g.onInput({ type: 'jump', on: true });
  g.onInput({ type: 'jump', on: false });
  assert.equal(g.phase, 'play');
  g.obstacles = [];
  g.nextAt = 1e9;
  ctx.advance(3000);
  assert.ok(g.hostView().score > 5);
  assert.equal(g.y, 0, 'landed again');
});

test('hitting a cactus ends the run; jumping it in time clears it', () => {
  let { ctx, g } = game();
  g.onInput({ type: 'jump', on: true });
  g.onInput({ type: 'jump', on: false });
  ctx.advance(800);
  g.nextAt = 1e9;
  g.obstacles = [{ kind: 'cactus', x: RUNNER.x + 12, y: 0, w: 2.5, h: 4.5 }];
  ctx.advance(1500);
  assert.equal(g.phase, 'over');
  assert.equal(ctx.pendingTimers(), 0);

  ({ ctx, g } = game());
  g.onInput({ type: 'jump', on: true });
  g.onInput({ type: 'jump', on: false });
  ctx.advance(800);
  g.nextAt = 1e9;
  g.obstacles = [{ kind: 'cactus', x: RUNNER.x + 12, y: 0, w: 2.5, h: 4.5 }];
  ctx.advance(200);
  g.onInput({ type: 'jump', on: true });
  ctx.advance(150);
  g.onInput({ type: 'jump', on: false });
  ctx.advance(1500);
  assert.equal(g.phase, 'play');
  assert.equal(g.dodged, 1);
});

test('ducking passes under a middle-height bird', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'jump', on: true });
  g.onInput({ type: 'jump', on: false });
  ctx.advance(800);
  g.nextAt = 1e9;
  g.obstacles = [{ kind: 'bird', x: RUNNER.x + 10, y: 6, w: 5, h: 3 }];
  g.onInput({ type: 'duck', on: true });
  ctx.advance(1500);
  assert.equal(g.phase, 'play');
  assert.equal(g.hostView().runner.ducking, true);
  g.onInput({ type: 'duck', on: 'yes' });
  assert.equal(g.ducking, true);
});

test('the obstacles keep coming and the run speeds up; pause stops it', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'jump', on: true });
  ctx.advance(TIMING.tickMs);
  const speed = g.speed;
  g.distance = 5000;
  ctx.advance(200);
  assert.ok(g.speed > speed);
  assert.ok(g.obstacles.length > 0);
  g.onInput({ type: 'pause' });
  const d = g.distance;
  ctx.advance(2000);
  assert.equal(g.distance, d);
  assert.equal(ctx.pendingTimers(), 0);
});
