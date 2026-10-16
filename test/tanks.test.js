import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TankDuel, FIELD, TANK, SHELL, TIMING, WIN_SCORE } from '../server/games/tanks.js';
import { fakeCtx } from './helpers.js';

function setup() {
  const ctx = fakeCtx();
  const game = new TankDuel(ctx);
  game.start();
  return { ctx, game };
}

const toPlay = (ctx) => ctx.advance(TIMING.countdownMs + 20);
/** Put a tank somewhere, facing an angle. */
const place = (game, i, x, y, angle) => Object.assign(game.tanks[i], { x, y, angle });

test('counts down (with the countdown pushed every second), then play starts', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().countdown, 3);
  ctx.advance(1000);
  assert.equal(game.hostView().countdown, 2);
  ctx.advance(TIMING.countdownMs - 1000 + 20);
  assert.equal(game.phase, 'play');
  assert.equal(game.hostView().timeLeft, TIMING.roundMs / 1000);
});

test('no firing during the countdown', () => {
  const { game } = setup();
  game.onInput(0, { type: 'fire' });
  assert.equal(game.shells.length, 0);
});

test('the tank turns to face the stick, then drives that way', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'move', x: 0, y: 1 }); // down the TV
  ctx.advance(100);
  assert.ok(Math.abs(game.tanks[0].y - FIELD.h / 2) < 0.15, 'barely moves while still turning');
  ctx.advance(600);
  assert.ok(Math.abs(game.tanks[0].angle - Math.PI / 2) < 0.01, 'now faces down');
  assert.ok(game.tanks[0].y > FIELD.h / 2 + 1, 'and has driven down');
  game.onInput(0, { type: 'move', x: 0, y: 0 });
  const y = game.tanks[0].y;
  ctx.advance(300);
  assert.equal(game.tanks[0].y, y, 'stops when the stick is released');
});

test('tanks are stopped by the arena walls and by cover', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'move', x: -1, y: 0 });
  ctx.advance(2000);
  assert.ok(Math.abs(game.tanks[0].x - TANK.r) < 0.1, `at the left wall: ${game.tanks[0].x}`);
  place(game, 0, 6, 4.5, 0);
  game.onInput(0, { type: 'move', x: 1, y: 0 }); // the centre block starts at x = 7.4
  ctx.advance(2000);
  assert.ok(game.tanks[0].x <= 7.4 - TANK.r + 1e-9 && game.tanks[0].x > 6.8, `stopped at the block: ${game.tanks[0].x}`);
});

test('firing makes a shell in front of the barrel; reload and the 3-shell limit apply', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'fire' });
  assert.equal(game.shells.length, 1);
  assert.ok(game.shells[0].x > game.tanks[0].x && game.shells[0].vx > 0);
  game.onInput(0, { type: 'fire' }); // still reloading
  assert.equal(game.shells.length, 1);
  place(game, 0, 1.5, 1, -Math.PI / 2 + 0.01); // aim at the top wall so shells stay alive a bit
  for (let i = 0; i < 5; i++) {
    ctx.advance(SHELL.reloadMs);
    game.onInput(0, { type: 'fire' });
  }
  assert.ok(game.shells.filter((s) => s.owner === 0).length <= SHELL.max);
});

test('a shell bounces once off a wall, then is gone on the next hit', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  place(game, 1, 14.5, 8, Math.PI); // out of the way
  game.shells = [{ x: 1, y: 4.5, vx: -SHELL.speed, vy: 0, bounces: SHELL.bounces, owner: 1, born: -1e9 }];
  place(game, 0, 1.5, 1, 0);
  ctx.advance(200);
  assert.equal(game.shells.length, 1);
  assert.ok(game.shells[0].vx > 0, 'bounced off the left wall');
  assert.equal(game.shells[0].bounces, 0);
  game.shells[0].vx = -SHELL.speed;
  ctx.advance(400);
  assert.equal(game.shells.length, 0, 'second wall hit destroys it');
});

test('a shell bounces off cover', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.shells = [{ x: 6.5, y: 4.5, vx: SHELL.speed, vy: 0, bounces: 1, owner: 0, born: -1e9 }];
  ctx.advance(200);
  assert.ok(game.shells[0].vx < 0, 'came back off the centre block');
  assert.ok(game.shells[0].x < 7.4);
});

test('a hit costs 1 HP; 3 hits destroy the tank and end the round', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  // A clear lane along the top, above all the cover.
  place(game, 0, 2, 0.8, 0);
  place(game, 1, 6, 0.8, Math.PI);
  for (let i = 0; i < TANK.hp; i++) {
    ctx.advance(SHELL.reloadMs);
    game.onInput(0, { type: 'fire' });
    ctx.advance(800);
  }
  assert.equal(game.tanks[1].hp, 0);
  assert.equal(game.tanks[1].alive, false);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { reason: 'destroyed', draw: false, roundWinner: 0 });
  assert.deepEqual(game.scores, [1, 0]);
  assert.equal(game.shells.length, 0, 'shells are cleared when the round ends');
  ctx.advance(TIMING.roundEndMs + 20);
  assert.equal(game.phase, 'countdown');
  assert.equal(game.round, 2);
  assert.equal(game.tanks[1].hp, TANK.hp, 'fresh tanks next round');
});

test('a fresh shell cannot hit its own tank, but a bounced one can', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  place(game, 1, 14.5, 8, Math.PI);
  place(game, 0, 1, 4.5, Math.PI); // facing the left wall, right next to it
  game.onInput(0, { type: 'fire' });
  ctx.advance(300);
  assert.equal(game.tanks[0].hp, TANK.hp - 1, 'own shell came back off the wall');
});

test('shells that meet cancel out', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.shells = [
    { x: 4, y: 0.6, vx: SHELL.speed, vy: 0, bounces: 1, owner: 0, born: -1e9 },
    { x: 6, y: 0.6, vx: -SHELL.speed, vy: 0, bounces: 1, owner: 1, born: -1e9 },
  ];
  ctx.advance(200);
  assert.equal(game.shells.length, 0);
});

test('when time runs out the healthier tank wins the round', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.tanks[1].hp = 1;
  game.roundEnds = ctx.now() + 100;
  ctx.advance(150);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { reason: 'time', draw: false, roundWinner: 0 });
  assert.equal(game.hostView().timeLeft, 0);
});

test('bad input is ignored', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'move', x: 'left', y: 0 });
  game.onInput(0, { type: 'move', x: NaN, y: 1 });
  game.onInput(0, { type: 'nuke' });
  assert.deepEqual(game.controls[0], { x: 0, y: 0 });
  game.onInput(0, { type: 'move', x: 5, y: -9 });
  assert.deepEqual(game.controls[0], { x: 1, y: -1 }, 'clamped');
});

test('first to WIN_SCORE wins, the loop stops, rematch restarts', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) {
    toPlay(ctx);
    game.tanks[0].hp = 1;
    game.roundEnds = ctx.now() + 50;
    ctx.advance(100);
    if (game.phase !== 'over') ctx.advance(TIMING.roundEndMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});
