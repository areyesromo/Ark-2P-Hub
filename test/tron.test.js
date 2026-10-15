import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tron, GRID, SPEED, TIMING, WIN_SCORE } from '../server/games/tron.js';
import { fakeCtx } from './helpers.js';

const TICK = 1000 / SPEED.startCps;

function setup() {
  const ctx = fakeCtx();
  const game = new Tron(ctx);
  game.start();
  return { ctx, game };
}

const toPlay = (ctx) => ctx.advance(TIMING.countdownMs);

test('counts down, then cycles move one cell per tick', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().countdown, 3);
  const before = ctx.updates;
  ctx.advance(1000);
  assert.equal(game.hostView().countdown, 2);
  assert.ok(ctx.updates > before, 'the countdown is pushed to the screens each second');
  ctx.advance(TIMING.countdownMs - 1000);
  assert.equal(game.phase, 'play');
  ctx.advance(TICK * 3);
  assert.deepEqual([game.cycles[0].x, game.cycles[0].y], [11, 18]);
  assert.deepEqual([game.cycles[1].x, game.cycles[1].y], [GRID.w - 12, 18]);
});

test('nobody turns: head-on in the middle is a draw, no point', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  ctx.advance(TICK * 30);
  assert.equal(game.phase, 'crash');
  assert.deepEqual(game.result.crashed, [true, true]);
  assert.equal(game.result.draw, true);
  assert.deepEqual(game.scores, [0, 0]);
  ctx.advance(TIMING.crashMs);
  assert.equal(game.phase, 'countdown');
  assert.equal(game.round, 2);
});

test('hitting the wall loses the round', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'turn', dir: 'up' }); // turns allowed during the countdown
  toPlay(ctx);
  ctx.advance(TICK * 19); // 18 cells to the top wall, then the crash
  assert.equal(game.phase, 'crash');
  assert.deepEqual(game.result, { crashed: [true, false], draw: false, roundWinner: 1 });
  assert.deepEqual(game.scores, [0, 1]);
});

test("running into the rival's trail loses the round", () => {
  const { ctx, game } = setup();
  // P1 goes up and across the top of P2's path; P2 turns up into P1's trail.
  game.onInput(0, { type: 'turn', dir: 'up' });
  toPlay(ctx);
  ctx.advance(TICK * 5); // P1 at (8,13)
  game.onInput(0, { type: 'turn', dir: 'right' });
  ctx.advance(TICK * 30); // P1 trail along y=13 to x≈38; P2 at x≈25 on y=18
  game.onInput(1, { type: 'turn', dir: 'up' });
  ctx.advance(TICK * 6);
  assert.equal(game.result.roundWinner, 0);
  assert.deepEqual(game.result.crashed, [false, true]);
});

test('180° and repeated turns are ignored; two quick turns both apply', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.onInput(0, { type: 'turn', dir: 'left' }); // reverse: ignored
  game.onInput(0, { type: 'turn', dir: 'right' }); // same: ignored
  assert.equal(game.cycles[0].queue.length, 0);
  game.onInput(0, { type: 'turn', dir: 'up' });
  game.onInput(0, { type: 'turn', dir: 'left' }); // now valid (after up)
  game.onInput(0, { type: 'turn', dir: 'down' }); // queue full: ignored
  ctx.advance(TICK * 2);
  assert.deepEqual([game.cycles[0].x, game.cycles[0].y, game.cycles[0].dir], [7, 17, 'left']);
  // The view carries corners + head only.
  assert.deepEqual(game.hostView().cycles[0].path, [[8, 18], [8, 17], [7, 17]]);
});

test('bad input is ignored', () => {
  const { game } = setup();
  game.onInput(0, { type: 'turn', dir: 'diagonal' });
  game.onInput(0, { type: 'turn' });
  game.onInput(0, { type: 'warp' });
  assert.equal(game.cycles[0].queue.length, 0);
});

test('cycles speed up during a round, up to the cap', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'turn', dir: 'up' });
  game.onInput(1, { type: 'turn', dir: 'down' });
  toPlay(ctx);
  ctx.advance(800);
  game.onInput(0, { type: 'turn', dir: 'right' });
  game.onInput(1, { type: 'turn', dir: 'left' });
  // They now run along separate rows, so the round lasts long enough to speed up.
  ctx.advance(SPEED.rampEveryMs + 200);
  assert.ok(game.cps > SPEED.startCps, `cps ${game.cps}`);
  assert.ok(game.cps <= SPEED.maxCps);
});

test('first to WIN_SCORE wins; the loop stops; rematch restarts', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) {
    game.onInput(1, { type: 'turn', dir: 'up' });
    toPlay(ctx);
    ctx.advance(TICK * 19);
    if (game.phase !== 'over') ctx.advance(TIMING.crashMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});
