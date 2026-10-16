import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AirHockey, FIELD, PHYSICS, TIMING, WIN_SCORE, padToTable } from '../server/games/air-hockey.js';
import { fakeCtx } from './helpers.js';

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg || ''} ${actual} != ${expected}`);

function setup() {
  const ctx = fakeCtx();
  const game = new AirHockey(ctx);
  game.start();
  return { ctx, game };
}

/** Put the puck somewhere, moving, in play; park the mallets out of the way. */
function launch(game, puck) {
  game.phase = 'play';
  game.phaseEnds = null;
  game.mallets[0] = { x: FIELD.malletR, y: FIELD.malletR, vx: 0, vy: 0 };
  game.mallets[1] = { x: FIELD.w - FIELD.malletR, y: FIELD.malletR, vx: 0, vy: 0 };
  game.controls = [{ mode: 'axis', x: 0, y: 0 }, { mode: 'axis', x: 0, y: 0 }];
  Object.assign(game.puck, puck);
}

test('counts down with the puck still in the middle, then play starts', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().countdown, 3);
  ctx.advance(TIMING.countdownMs + 20);
  assert.equal(game.phase, 'play');
  assert.deepEqual([game.puck.x, game.puck.y], [FIELD.w / 2, FIELD.h / 2]);
});

test('views are pushed about 30 times a second', () => {
  const { ctx } = setup();
  const before = ctx.updates;
  ctx.advance(1000);
  const pushed = ctx.updates - before;
  assert.ok(pushed >= 28 && pushed <= 33, `pushed ${pushed}`);
});

test('the puck bounces off the side rails and slows down with friction', () => {
  const { ctx, game } = setup();
  launch(game, { x: 8, y: 1, vx: 0, vy: -10 });
  ctx.advance(200);
  assert.ok(game.puck.vy > 0, 'bounced off the top rail');
  assert.ok(game.puck.vy < 10, 'lost some speed');
});

test('the end wall bounces the puck outside the goal mouth', () => {
  const { ctx, game } = setup();
  launch(game, { x: 1.5, y: 1.2, vx: -10, vy: 0 });
  ctx.advance(300);
  assert.ok(game.puck.vx > 0);
  assert.deepEqual(game.scores, [0, 0]);
});

test('a puck through the goal mouth scores, then restarts still in the loser half', () => {
  const { ctx, game } = setup();
  launch(game, { x: 2, y: FIELD.h / 2, vx: -12, vy: 0 });
  ctx.advance(500);
  assert.deepEqual(game.scores, [0, 1]);
  assert.equal(game.phase, 'goal');
  assert.equal(game.lastScorer, 1);
  assert.deepEqual(game.puck, { x: FIELD.w / 4, y: FIELD.h / 2, vx: 0, vy: 0 });
  ctx.advance(TIMING.goalMs + 20);
  assert.equal(game.phase, 'play');
});

test('a moving mallet smashes the puck: the puck takes on its speed', () => {
  const { ctx, game } = setup();
  launch(game, { x: 6, y: 4.5, vx: 0, vy: 0 });
  game.mallets[0] = { x: 4, y: 4.5, vx: 0, vy: 0 };
  game.controls[0] = { mode: 'axis', x: 1, y: 0 }; // full speed right
  ctx.advance(200);
  assert.ok(game.puck.vx > PHYSICS.malletSpeed * 0.9, `puck vx ${game.puck.vx}`);
  assert.ok(Math.hypot(game.puck.vx, game.puck.vy) <= PHYSICS.puckMax + 1e-9);
});

test('a fast puck never passes through a still mallet', () => {
  const { ctx, game } = setup();
  launch(game, { x: 8, y: 4.5, vx: -PHYSICS.puckMax, vy: 0 });
  game.mallets[0] = { x: 3, y: 4.5, vx: 0, vy: 0 };
  ctx.advance(400);
  assert.ok(game.puck.x > game.mallets[0].x, 'puck stayed in front of the mallet');
  assert.deepEqual(game.scores, [0, 0]);
});

test('mallets stay in their own half and inside the rails', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'axis', x: 1, y: -1 });
  game.onInput(1, { type: 'axis', x: -1, y: 1 });
  ctx.advance(2000);
  assert.equal(game.mallets[0].x, FIELD.w / 2 - FIELD.malletR);
  assert.equal(game.mallets[0].y, FIELD.malletR);
  assert.equal(game.mallets[1].x, FIELD.w / 2 + FIELD.malletR);
  assert.equal(game.mallets[1].y, FIELD.h - FIELD.malletR);
});

test('the phone pad is your half turned to face you', () => {
  // Bottom of the pad is your own goal, top is the centre line.
  near(padToTable(0, 0.5, 1).x, FIELD.malletR);
  near(padToTable(0, 0.5, 0).x, FIELD.w / 2 - FIELD.malletR);
  near(padToTable(1, 0.5, 1).x, FIELD.w - FIELD.malletR);
  near(padToTable(1, 0.5, 0).x, FIELD.w / 2 + FIELD.malletR);
  // Right on the pad is your right-hand side of the table.
  near(padToTable(0, 1, 0.5).y, FIELD.h - FIELD.malletR); // facing right -> right hand is down the TV
  near(padToTable(1, 1, 0.5).y, FIELD.malletR); // facing left -> right hand is up the TV
});

test('phone input moves the mallet towards the finger at the capped speed; bad input ignored', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'move', u: 0.5, v: 0 }); // to the centre line
  ctx.advance(100);
  const moved = game.mallets[0].x - 2.5;
  assert.ok(moved > 0 && moved <= PHYSICS.malletSpeed * 0.1 + 0.4, `moved ${moved}`);
  const at = { ...game.mallets[0] };
  game.onInput(0, { type: 'move', u: NaN, v: 0 });
  game.onInput(0, { type: 'axis', x: 'left', y: 0 });
  assert.equal(game.controls[0].mode, 'target');
  ctx.advance(1000);
  assert.equal(game.mallets[0].x, FIELD.w / 2 - FIELD.malletR);
  assert.ok(game.mallets[0].x >= at.x);
});

test('first to WIN_SCORE wins, the loop stops, and rematch restarts', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) game.goal(1);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});
