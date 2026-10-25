import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BrickDuel, FIELD, TIMING, ROWS, MAX_ROWS, MAX_BALLS } from '../server/games/brick-duel.js';
import { fakeCtx } from './helpers.js';

function setup(rng = () => 0.3, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new BrickDuel(ctx, rng);
  game.start();
  return { ctx, game };
}

/** Into play at once, with `slot`'s first ball somewhere, moving; the other side's ball parked. */
function launch(game, slot, ball) {
  game.phase = 'play';
  game.phaseEnds = null;
  game.endsAt = game.ctx.now() + TIMING.matchMs;
  game.sides.forEach((s) => { s.balls = [{ x: FIELD.w / 2, y: FIELD.paddleY - FIELD.ballR, vx: 0, vy: 0, heldUntil: Infinity }]; });
  game.sides[slot].balls = [{ heldUntil: null, ...ball }];
}

const brickRect = (r, c) => ({ x: c * FIELD.brickW, y: FIELD.top + r * FIELD.brickH });

test('every view can be built at every update, from the very first (as the room does)', () => {
  const ctx = fakeCtx();
  let game = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (game) [game.hostView(), game.playerView(0), game.playerView(1)];
    update();
  };
  game = new BrickDuel(ctx, () => 0.3);
  game.start();
  ctx.advance(TIMING.countdownMs + 500);
  assert.equal(game.phase, 'play');
});

test('counts down, then a ball leaves each paddle the same way on both sides', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  ctx.advance(TIMING.countdownMs + 40);
  assert.equal(game.phase, 'play');
  const [a, b] = game.sides.map((s) => s.balls[0]);
  assert.ok(a.vy < 0, 'going up');
  assert.deepEqual([a.x, a.y, a.vx, a.vy], [b.x, b.y, b.vx, b.vy]);
});

test('both walls are the same, power bricks included', () => {
  const { game } = setup(() => 0.77);
  const wall = (s) => [...s.bricks.values()].map((b) => `${b.r},${b.c},${b.p || ''}`).sort();
  assert.deepEqual(wall(game.sides[0]), wall(game.sides[1]));
  assert.equal(game.sides[0].bricks.size, ROWS * FIELD.cols);
  assert.ok([...game.sides[0].bricks.values()].some((b) => b.p), 'some power bricks');
});

test('views are pushed about 30 times a second', () => {
  const { ctx } = setup();
  const before = ctx.updates;
  ctx.advance(1000);
  const pushed = ctx.updates - before;
  assert.ok(pushed >= 28 && pushed <= 33, `pushed ${pushed}`);
});

test('paddles: a phone target and a stick move at the same top speed, inside the wall; bad input is ignored', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'move', x: 1 });
  game.onInput(1, { type: 'axis', v: 1 });
  ctx.advance(200);
  const [a, b] = game.sides.map((s) => s.paddle);
  assert.ok(Math.abs(a - b) < 0.05, `${a} vs ${b}`);
  ctx.advance(3000);
  assert.ok(Math.abs(game.sides[0].paddle - (FIELD.w - FIELD.paddleW / 2)) < 1e-9);
  const p = game.sides[1].paddle;
  for (const bad of [{ type: 'move', x: '0' }, { type: 'axis', v: NaN }, { type: 'move' }]) game.onInput(1, bad);
  game.onInput(2, { type: 'axis', v: -1 });
  game.onInput(1, { type: 'axis', v: 0 });
  ctx.advance(300);
  assert.equal(game.sides[1].paddle, p);
});

test('a ball breaks the brick it hits, bounces back, and counts it', () => {
  const { ctx, game } = setup();
  const r = ROWS - 1;
  const { x, y } = brickRect(r, 3);
  launch(game, 0, { x: x + FIELD.brickW / 2, y: y + FIELD.brickH + 0.5, vx: 0, vy: -6 });
  ctx.advance(150);
  assert.equal(game.sides[0].bricks.has(r * FIELD.cols + 3), false);
  assert.equal(game.sides[0].broken, 1);
  assert.ok(game.sides[0].balls[0].vy > 0, 'bounced back down');
  assert.equal(game.sides[1].bricks.size, ROWS * FIELD.cols, 'the other wall is untouched');
});

test('where the ball hits the paddle sets its angle', () => {
  const { ctx, game } = setup();
  const px = game.sides[0].paddle;
  launch(game, 0, { x: px + FIELD.paddleW * 0.4, y: FIELD.paddleY - 1, vx: 0, vy: 6 });
  ctx.advance(250);
  const b = game.sides[0].balls[0];
  assert.ok(b.vy < 0 && b.vx > 2, `${b.vx}, ${b.vy}`);
});

test('a missed ball comes back on your paddle after a moment; you don\'t lose', () => {
  const { ctx, game } = setup();
  launch(game, 0, { x: 1, y: FIELD.h - 0.3, vx: 0, vy: 6 });
  game.sides[0].paddle = FIELD.w - FIELD.paddleW / 2;
  ctx.advance(200);
  const b = game.sides[0].balls[0];
  assert.ok(b.heldUntil > ctx.now(), 'waiting on the paddle');
  assert.equal(game.phase, 'play');
  ctx.advance(TIMING.respawnMs);
  assert.ok(game.sides[0].balls[0].vy < 0, 'served again');
});

test('a 🔻 brick shrinks your rival\'s paddle for a while', () => {
  const { ctx, game } = setup();
  const { x, y } = brickRect(ROWS - 1, 0);
  game.sides[0].bricks.set((ROWS - 1) * FIELD.cols, { r: ROWS - 1, c: 0, p: 'shrink' });
  launch(game, 0, { x: x + 0.5, y: y + FIELD.brickH + 0.4, vx: 0, vy: -6 });
  ctx.advance(150);
  assert.equal(game.hostView().sides[1].paddleW, FIELD.shrunkW);
  assert.equal(game.hostView().sides[0].paddleW, FIELD.paddleW);
  ctx.advance(TIMING.shrinkMs);
  assert.equal(game.hostView().sides[1].paddleW, FIELD.paddleW);
});

test('a ⚪ brick gives you another ball, but never more than ' + MAX_BALLS, () => {
  const { ctx, game } = setup();
  const hit = (c) => {
    const { x, y } = brickRect(ROWS - 1, c);
    game.sides[0].bricks.set((ROWS - 1) * FIELD.cols + c, { r: ROWS - 1, c, p: 'multi' });
    return { x: x + 0.5, y: y + FIELD.brickH + 0.4, vx: 0, vy: -6, heldUntil: null };
  };
  launch(game, 0, hit(0));
  ctx.advance(120);
  assert.equal(game.sides[0].balls.length, 2);
  // Already at the limit: no more.
  const parked = () => ({ x: 1, y: FIELD.paddleY - FIELD.ballR, vx: 0, vy: 0, heldUntil: Infinity });
  game.sides[0].balls = [hit(1), ...Array.from({ length: MAX_BALLS - 1 }, parked)];
  ctx.advance(120);
  assert.equal(game.sides[0].broken, 2);
  assert.equal(game.sides[0].balls.length, MAX_BALLS);
});

test('a 🧱 brick adds a row to your rival\'s wall (pushing it down), never past the limit', () => {
  const { ctx, game } = setup();
  const before = game.sides[1].bricks.size;
  const { x, y } = brickRect(ROWS - 1, 2);
  game.sides[0].bricks.set((ROWS - 1) * FIELD.cols + 2, { r: ROWS - 1, c: 2, p: 'rows' });
  launch(game, 0, { x: x + 0.5, y: y + FIELD.brickH + 0.4, vx: 0, vy: -6 });
  ctx.advance(150);
  const rows = [...game.sides[1].bricks.values()].map((b) => b.r);
  assert.equal(game.sides[1].bricks.size, before + FIELD.cols);
  assert.equal(Math.max(...rows), ROWS, 'pushed down one row');
  // A full-height wall only gets its gaps filled.
  const g = setup().game;
  g.sides[1].bricks.clear();
  for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < FIELD.cols; c++) if (c !== 4) g.sides[1].bricks.set(r * FIELD.cols + c, { r, c, p: null });
  g.addRow(1);
  assert.equal(g.sides[1].bricks.size, MAX_ROWS * FIELD.cols - (MAX_ROWS - 1));
  assert.ok(Math.max(...[...g.sides[1].bricks.values()].map((b) => b.r)) < MAX_ROWS);
});

test('clear your wall first and you win at once', () => {
  const { ctx, game } = setup();
  game.sides[0].bricks.clear();
  game.sides[0].bricks.set(0, { r: 0, c: 0, p: null });
  const { y } = brickRect(0, 0);
  launch(game, 0, { x: 0.5, y: y + FIELD.brickH + 0.4, vx: 0, vy: -6 });
  ctx.advance(150);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  const updates = ctx.updates;
  ctx.advance(2000);
  assert.equal(ctx.updates, updates, 'nothing runs after the end');
});

test('at time up more bricks broken wins; level goes to sudden death (next brick wins)', () => {
  const park = (g) => g.sides.forEach((side) => side.balls.forEach((b) => { b.heldUntil = Infinity; }));
  const a = setup();
  a.ctx.advance(TIMING.countdownMs + 20);
  park(a.game);
  a.game.sides[1].broken = 3;
  a.game.sides[0].broken = 2;
  a.ctx.advance(TIMING.matchMs);
  assert.equal(a.game.phase, 'over');
  assert.equal(a.game.winner, 1);

  const b = setup();
  b.ctx.advance(TIMING.countdownMs + 20);
  park(b.game);
  b.ctx.advance(TIMING.matchMs);
  assert.equal(b.game.phase, 'play');
  assert.equal(b.game.hostView().suddenDeath, true);
  const { x, y } = brickRect(ROWS - 1, 5);
  launch(b.game, 1, { x: x + 0.5, y: y + FIELD.brickH + 0.4, vx: 0, vy: -6 });
  b.game.suddenDeath = true;
  b.ctx.advance(150);
  assert.equal(b.game.phase, 'over');
  assert.equal(b.game.winner, 1);
});

test('the wall setting sets the rows; rematch starts over', () => {
  const { game } = setup(() => 0.3, { rows: 3 });
  assert.equal(game.sides[0].bricks.size, 3 * FIELD.cols);
  game.phase = 'over';
  game.sides[0].broken = 9;
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.equal(game.sides[0].broken, 0);
});

test('the phone view has the scores and no positions', () => {
  const { game } = setup();
  const v = game.playerView(1);
  assert.equal(v.you, 1);
  assert.deepEqual(v.broken, [0, 0]);
  assert.equal(v.sides, undefined);
});
