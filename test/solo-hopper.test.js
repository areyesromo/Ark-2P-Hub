import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Hopper, START, TIMING, LIVES, W } from '../server/solo/games/hopper.js';

function game(seed = 2) {
  const ctx = fakeCtx();
  const g = new Hopper(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** Clear the road and put one log under every river cell, so a straight run is safe. */
function calm(g) {
  for (const l of g.lanes) {
    if (l.kind === 'road') l.objs = [];
    else {
      l.speed = 0;
      l.len = W + 6;
      l.objs = [0];
    }
  }
}

test('hops move the frog a cell; it can\'t leave the board', () => {
  const { g } = game();
  calm(g);
  g.onInput({ type: 'hop', dir: 'up' });
  assert.deepEqual(g.frog, { x: START.x, row: START.row - 1 });
  g.onInput({ type: 'hop', dir: 'down' });
  g.onInput({ type: 'hop', dir: 'down' }); // already at the start row
  assert.equal(g.frog.row, START.row);
  for (let i = 0; i < 10; i++) g.onInput({ type: 'hop', dir: 'left' });
  assert.equal(g.frog.x, 0);
});

test('a crossing scores the rows, a crossing bonus and the time left, and speeds things up', () => {
  const { ctx, g } = game();
  calm(g);
  ctx.advance(5000);
  for (let i = 0; i < 12; i++) g.onInput({ type: 'hop', dir: 'up' });
  assert.equal(g.crossings, 1);
  assert.equal(g.level, 2);
  assert.deepEqual(g.frog, { x: START.x, row: START.row });
  assert.equal(g.score, 12 * 10 + 50 + 25 * 2);
  assert.equal(g.lastCross.bonus, 50);
});

test('a car on the frog\'s lane ends that go; water does too; the third ends the run', () => {
  const { ctx, g } = game();
  calm(g);
  // A car parked right where the frog will land.
  const road = g.laneAt(11);
  road.speed = 0;
  road.objs = [START.x + 3]; // positions are x0 - 3
  g.onInput({ type: 'hop', dir: 'up' });
  assert.equal(g.phase, 'dead');
  assert.equal(g.death.how, 'car');
  assert.equal(g.lives, LIVES - 1);
  ctx.advance(TIMING.deadMs);
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.frog, { x: START.x, row: START.row });
  // Into the river with no log.
  calm(g);
  g.laneAt(5).objs = [];
  for (let i = 0; i < 7; i++) g.onInput({ type: 'hop', dir: 'up' });
  assert.equal(g.death.how, 'water');
  ctx.advance(TIMING.deadMs);
  ctx.advance(TIMING.lifeMs + 100); // standing still till the time runs out
  assert.equal(g.phase, 'over');
  assert.equal(g.death.how, 'time');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.lives, LIVES);
});

test('a moving log carries the frog, off the edge if it stays on', () => {
  const { ctx, g } = game();
  calm(g);
  const river = g.laneAt(5);
  river.speed = 2;
  river.dir = 1;
  for (let i = 0; i < 7; i++) g.onInput({ type: 'hop', dir: 'up' });
  assert.equal(g.frog.row, 5);
  const x = g.frog.x;
  ctx.advance(1000);
  assert.ok(Math.abs(g.frog.x - (x + 2)) < 0.15, `carried to ${g.frog.x}`);
  ctx.advance(4000);
  assert.equal(g.death.how, 'edge');
});

test('pause stops the clock and the lanes; bad input is ignored', () => {
  const { ctx, g } = game();
  calm(g);
  ctx.advance(1000);
  g.onInput({ type: 'pause' });
  const t = g.view().t;
  ctx.advance(60000);
  assert.equal(g.phase, 'paused');
  assert.equal(g.view().t, t);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'pause' });
  assert.ok(Math.abs(g.view().t - t) < 0.001);
  assert.ok(g.view().timeLeft > 25000);
  for (const input of [{ type: 'hop', dir: 'north' }, { type: 'hop' }, { type: 'zap' }]) g.onInput(input);
  assert.deepEqual(g.frog, { x: START.x, row: START.row });
});
