import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VolleyBlobs, FIELD, PHYSICS, TIMING, WIN_SCORE, MAX_TOUCHES } from '../server/games/volley-blobs.js';
import { fakeCtx } from './helpers.js';

function setup(rng = () => 0.2, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new VolleyBlobs(ctx, rng);
  game.start();
  return { ctx, game };
}

/** Straight into play with the ball somewhere, moving. */
function launch(game, { x, y, vx = 0, vy = 0 }) {
  game.phase = 'play';
  game.phaseEnds = null;
  Object.assign(game.ball, { x, y, vx, vy });
}

const NET_L = FIELD.w / 2 - FIELD.netW / 2;
const NET_R = FIELD.w / 2 + FIELD.netW / 2;

test('counts down, then the ball drops over the server\'s blob', () => {
  const { ctx, game } = setup(() => 0.2); // rng < 0.5: player 1 serves first
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().countdown, 3);
  ctx.advance(TIMING.countdownMs + 20);
  assert.equal(game.phase, 'play');
  assert.ok(Math.abs(game.ball.x - game.blobs[0].x) < 0.01, 'over blob 1');
  const y = game.ball.y;
  ctx.advance(100);
  assert.ok(game.ball.y < y, 'falling');
});

test('views are pushed about 30 times a second', () => {
  const { ctx } = setup();
  const before = ctx.updates;
  ctx.advance(1000);
  const pushed = ctx.updates - before;
  assert.ok(pushed >= 28 && pushed <= 33, `pushed ${pushed}`);
});

test('blobs slide at a fixed speed and can\'t cross the net or leave the court', () => {
  const { ctx, game } = setup();
  const x0 = game.blobs[0].x;
  game.onInput(0, { type: 'move', x: 1 });
  ctx.advance(200);
  const moved = game.blobs[0].x - x0;
  assert.ok(Math.abs(moved - PHYSICS.moveSpeed * 0.2) < 0.15, String(moved));
  ctx.advance(5000);
  assert.ok(game.blobs[0].x + FIELD.blobR <= NET_L + 1e-9, 'stops at the net');
  game.onInput(1, { type: 'move', x: 1 });
  ctx.advance(5000);
  assert.ok(game.blobs[1].x + FIELD.blobR <= FIELD.w + 1e-9, 'stops at the wall');
  game.onInput(1, { type: 'move', x: -1 });
  ctx.advance(5000);
  assert.ok(game.blobs[1].x - FIELD.blobR >= NET_R - 1e-9, 'stops at the net on its side too');
});

test('holding a direction through a point keeps you moving (the phone doesn\'t resend it)', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'move', x: -1 });
  launch(game, { x: FIELD.w * 0.75, y: FIELD.ballR + 0.1, vy: -5 });
  game.blobs[1].x = FIELD.w - FIELD.blobR;
  ctx.advance(50);
  assert.equal(game.phase, 'point');
  const x = game.blobs[0].x;
  ctx.advance(300);
  assert.ok(game.blobs[0].x < x - 1, 'still sliding left in the pause');
});

test('the serve drops over where the server\'s blob is, not its starting mark', () => {
  const { ctx, game } = setup(() => 0.2); // player 1 serves
  game.onInput(0, { type: 'move', x: 1 });
  ctx.advance(1000);
  game.onInput(0, { type: 'move', x: 0 });
  ctx.advance(TIMING.countdownMs);
  assert.equal(game.phase, 'play');
  assert.ok(Math.abs(game.ball.x - game.blobs[0].x) < 0.01);
});

test('bad input is ignored', () => {
  const { ctx, game } = setup();
  const before = game.blobs.map((b) => b.x);
  for (const x of ['1', NaN, null, Infinity]) game.onInput(0, { type: 'move', x });
  game.onInput(2, { type: 'move', x: 1 });
  game.onInput(2, { type: 'jump' });
  game.onInput(0, { type: 'warp' });
  ctx.advance(300);
  assert.deepEqual(game.blobs.map((b) => b.x), before);
  assert.equal(game.blobs[0].y, 0);
});

test('jump only from the ground, about JUMP high', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'jump' });
  let top = 0;
  for (let i = 0; i < 30; i++) {
    ctx.advance(20);
    top = Math.max(top, game.blobs[0].y);
    if (i === 5) game.onInput(0, { type: 'jump' }); // in the air: nothing
  }
  const want = (PHYSICS.jumpV * PHYSICS.jumpV) / (2 * PHYSICS.blobGravity);
  assert.ok(Math.abs(top - want) < 0.25, `top ${top}, want ${want}`);
  ctx.advance(1000);
  assert.equal(game.blobs[0].y, 0, 'lands');
});

test('a ball dropped on top of a blob bounces up and counts a touch', () => {
  const { ctx, game } = setup();
  const b = game.blobs[0];
  launch(game, { x: b.x, y: FIELD.blobR + FIELD.ballR + 0.5, vy: -6 });
  ctx.advance(100);
  assert.ok(game.ball.vy > 0, 'going up');
  assert.equal(game.touches[0], 1);
});

test('the front edge of the blob sends it towards the net; the back edge away', () => {
  const { ctx, game } = setup();
  const b = game.blobs[0];
  launch(game, { x: b.x + 0.6, y: FIELD.blobR + FIELD.ballR, vy: -6 });
  ctx.advance(80);
  assert.ok(game.ball.vx > 1, 'forward: ' + game.ball.vx);
  const g2 = setup().game;
  const b2 = g2.blobs[0];
  launch(g2, { x: b2.x - 0.6, y: FIELD.blobR + FIELD.ballR, vy: -6 });
  g2.ctx.advance(80);
  assert.ok(g2.ball.vx < -1, 'back: ' + g2.ball.vx);
});

test('both sides play alike: a mirrored hit on blob 2 goes the mirrored way', () => {
  const a = setup();
  const b = setup();
  const ba = a.game.blobs[0];
  const bb = b.game.blobs[1];
  launch(a.game, { x: ba.x + 0.5, y: FIELD.blobR + FIELD.ballR + 0.2, vx: 1, vy: -5 });
  launch(b.game, { x: bb.x - 0.5, y: FIELD.blobR + FIELD.ballR + 0.2, vx: -1, vy: -5 });
  a.ctx.advance(300);
  b.ctx.advance(300);
  assert.ok(Math.abs(a.game.ball.x - (FIELD.w - b.game.ball.x)) < 1e-6);
  assert.ok(Math.abs(a.game.ball.y - b.game.ball.y) < 1e-6);
  assert.ok(Math.abs(a.game.ball.vx + b.game.ball.vx) < 1e-6);
});

test('a blob jumping into a ball against the net can\'t push it through', () => {
  const { ctx, game } = setup();
  launch(game, { x: NET_L - FIELD.ballR, y: 1.6, vx: 0, vy: -1 });
  Object.assign(game.blobs[0], { x: 6.9, y: 1, vy: 8, move: 1 });
  for (let i = 0; i < 20 && game.phase === 'play'; i++) {
    ctx.advance(PHYSICS.tickMs);
    if (game.ball.y < FIELD.netH) assert.ok(game.ball.x <= NET_L - FIELD.ballR + 1e-6, 'tick ' + i + ': x ' + game.ball.x);
  }
});

test('a ball rolling off a dome is one touch, not one every few ticks', () => {
  const { ctx, game } = setup();
  const b = game.blobs[0];
  const reach = FIELD.blobR + FIELD.ballR;
  const a = Math.PI / 3; // 60° up, towards the net
  launch(game, { x: b.x + reach * Math.cos(a), y: reach * Math.sin(a), vx: 0, vy: 0 });
  for (let i = 0; i < 30 && game.phase === 'play'; i++) {
    ctx.advance(PHYSICS.tickMs);
    assert.ok(game.touches[0] <= 1, 'tick ' + i + ': ' + game.touches[0] + ' touches');
  }
  assert.notEqual(game.fault, 'touches');
});

test('a ball passing under a jumping blob doesn\'t hit an invisible underside', () => {
  const { ctx, game } = setup();
  Object.assign(game.blobs[0], { y: 2, vy: 3 });
  const b = game.blobs[0];
  launch(game, { x: b.x + 0.5, y: 1, vx: -4, vy: 0 }); // under the dome's flat base
  ctx.advance(150);
  assert.equal(game.touches[0], 0);
  assert.ok(game.ball.vx < -3, 'kept going: ' + game.ball.vx);
});

test('a ball dead on the net rolls over to the side away from the last one to touch it', () => {
  for (const toucher of [0, 1]) {
    const { ctx, game } = setup();
    game.blobs[0].x = FIELD.blobR;
    game.blobs[1].x = FIELD.w - FIELD.blobR;
    launch(game, { x: FIELD.w / 2, y: FIELD.netH + 2, vx: 0, vy: 0 });
    game.lastTouch = toucher;
    ctx.advance(4000);
    assert.equal(game.lastScorer, toucher, 'it went over, onto the rival\'s side');
  }
});

test('the ball can\'t pass through the net, and bounces off the walls', () => {
  const { ctx, game } = setup();
  launch(game, { x: NET_L - 1, y: 1, vx: 12, vy: 3 });
  ctx.advance(100);
  assert.ok(game.ball.x < FIELD.w / 2, 'stays on its side');
  assert.ok(game.ball.vx < 0, 'bounced back');
  launch(game, { x: FIELD.ballR + 0.3, y: 5, vx: -10, vy: 0 });
  ctx.advance(60);
  assert.ok(game.ball.vx > 0, 'off the wall');
});

test('a ball dropped dead on top of the net rolls off a side, it doesn\'t sit there', () => {
  const { ctx, game } = setup();
  game.blobs[0].x = FIELD.blobR;
  game.blobs[1].x = FIELD.w - FIELD.blobR;
  launch(game, { x: FIELD.w / 2, y: FIELD.netH + 2, vx: 0, vy: 0 });
  ctx.advance(4000);
  assert.equal(game.scores[0] + game.scores[1], 1);
});

test('the ball landing on your side is a point to your rival; the one who lost the point serves', () => {
  const { ctx, game } = setup();
  launch(game, { x: FIELD.w * 0.75, y: FIELD.ballR + 0.1, vy: -5 }); // on player 2's side
  game.blobs[1].x = FIELD.w - FIELD.blobR; // out of the way
  ctx.advance(50);
  assert.deepEqual(game.scores, [1, 0]);
  assert.equal(game.phase, 'point');
  assert.equal(game.lastScorer, 0);
  ctx.advance(TIMING.pointMs + 20);
  assert.equal(game.phase, 'play');
  assert.ok(Math.abs(game.ball.x - game.blobs[1].x) < 0.01, 'player 2 (who lost the point) serves');
});

test(`a side gets ${MAX_TOUCHES} touches; one more is a point to the rival`, () => {
  const { ctx, game } = setup();
  const b = game.blobs[0];
  for (let i = 0; i < MAX_TOUCHES; i++) {
    launch(game, { x: b.x, y: FIELD.blobR + FIELD.ballR + 0.3, vy: -6 });
    ctx.advance(100);
  }
  assert.equal(game.touches[0], MAX_TOUCHES);
  assert.deepEqual(game.scores, [0, 0]);
  launch(game, { x: b.x, y: FIELD.blobR + FIELD.ballR + 0.3, vy: -6 });
  ctx.advance(100);
  assert.deepEqual(game.scores, [0, 1]);
  assert.equal(game.hostView().fault, 'touches');
});

test('touches start again once the ball crosses the net', () => {
  const { ctx, game } = setup();
  const b = game.blobs[0];
  launch(game, { x: b.x, y: FIELD.blobR + FIELD.ballR + 0.3, vy: -6 });
  ctx.advance(100);
  assert.equal(game.touches[0], 1);
  launch(game, { x: NET_R + 1, y: 6, vx: 2, vy: 0 });
  ctx.advance(50);
  assert.deepEqual(game.touches, [0, 0]);
});

test('first to the setting wins; then rematch starts over', () => {
  const { ctx, game } = setup(() => 0.2, { wins: 3 });
  assert.equal(game.winScore, 3);
  for (let i = 0; i < 3; i++) {
    launch(game, { x: FIELD.w * 0.75, y: FIELD.ballR + 0.1, vy: -5 });
    game.blobs[1].x = FIELD.w - FIELD.blobR;
    ctx.advance(50);
    if (game.phase === 'point') ctx.advance(TIMING.pointMs + 20);
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

test('the default is first to ' + WIN_SCORE, () => {
  assert.equal(setup().game.winScore, WIN_SCORE);
});

test('the phone view has its own score side and no more', () => {
  const { game } = setup();
  const v = game.playerView(1);
  assert.equal(v.you, 1);
  assert.deepEqual(v.scores, [0, 0]);
  assert.equal(v.ball, undefined);
});
