import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnakeBattle, GRID, SPEED, TIMING, WIN_SCORE, START_LENGTH, FOOD_COUNT } from '../server/games/snake.js';
import { fakeCtx } from './helpers.js';

const TICK = 1000 / SPEED.startCps;

function setup(rng = () => 0.5) {
  const ctx = fakeCtx();
  const game = new SnakeBattle(ctx, rng);
  game.start();
  return { ctx, game };
}

const toPlay = (ctx) => ctx.advance(TIMING.countdownMs);
const head = (game, i) => game.snakes[i].body[0];

test('counts down (pushed every second), with food on the board, then snakes move', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.food.length, FOOD_COUNT);
  const before = ctx.updates;
  ctx.advance(1000);
  assert.equal(game.hostView().countdown, 2);
  assert.ok(ctx.updates > before);
  ctx.advance(TIMING.countdownMs - 1000);
  assert.equal(game.phase, 'play');
  game.food = []; // keep the path clear
  ctx.advance(TICK * 2);
  assert.deepEqual(head(game, 0), [7, 9]);
  assert.deepEqual(head(game, 1), [GRID.w - 8, 9]);
  assert.equal(game.snakes[0].body.length, START_LENGTH, 'tail follows: length unchanged');
});

test('food makes you grow, and new food appears elsewhere', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.food = [[6, 9], [0, 0], [1, 0]];
  ctx.advance(TICK);
  assert.equal(game.snakes[0].body.length, START_LENGTH + 1);
  assert.equal(game.food.length, FOOD_COUNT);
  assert.ok(!game.food.some(([x, y]) => x === 6 && y === 9));
  assert.equal(game.hostView().snakes[0].body.length, START_LENGTH + 1);
});

test('food never spawns on a snake', () => {
  let seq = 0;
  const { game } = setup(() => (seq++ % 97) / 97);
  for (let i = 0; i < 200; i++) game.spawnFood();
  const bodies = new Set(game.snakes.flatMap((s) => s.body.map(([x, y]) => y * GRID.w + x)));
  assert.ok(game.food.every(([x, y]) => !bodies.has(y * GRID.w + x)));
});

test('hitting the wall loses the round', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'turn', dir: 'up' }); // turns allowed during the countdown
  toPlay(ctx);
  game.food = [];
  ctx.advance(TICK * 10);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { reason: 'crash', crashed: [true, false], draw: false, roundWinner: 1 });
  assert.deepEqual(game.scores, [0, 1]);
  assert.equal(game.hostView().timeLeft, TIMING.roundMs / 1000 - 1, 'the clock stops where the crash happened');
});

test('running into your own body loses the round', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.food = [];
  game.snakes[0].body = [[10, 9], [9, 9], [8, 9], [7, 9], [6, 9], [5, 9]];
  game.onInput(0, { type: 'turn', dir: 'up' });
  game.onInput(0, { type: 'turn', dir: 'left' });
  ctx.advance(TICK * 2);
  game.onInput(0, { type: 'turn', dir: 'down' }); // back into the body
  ctx.advance(TICK);
  assert.deepEqual(game.result.crashed, [true, false]);
});

test("moving into the cell your own tail just left is fine", () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.food = [];
  // A 4-long snake in a 2x2 square: the head moves into where the tail was.
  game.snakes[0].body = [[10, 10], [11, 10], [11, 9], [10, 9]];
  game.snakes[0].dir = 'left';
  game.onInput(0, { type: 'turn', dir: 'up' });
  ctx.advance(TICK);
  assert.equal(game.phase, 'play');
  assert.deepEqual(head(game, 0), [10, 9]);
});

test("running into the rival's body loses the round; head-on is a draw", () => {
  let { ctx, game } = setup();
  toPlay(ctx);
  game.food = [];
  // A long rival body down column 12: its tail stays well clear of row 9 for a while.
  game.snakes[1].body = [[12, 16], [12, 15], [12, 14], [12, 13], [12, 12], [12, 11], [12, 10], [12, 9], [12, 8], [12, 7]];
  game.snakes[1].dir = 'right';
  game.snakes[0].body = [[10, 9], [9, 9], [8, 9], [7, 9]];
  ctx.advance(TICK * 2); // P1 runs into P2's body at (12, 9)
  assert.equal(game.result.roundWinner, 1);

  ({ ctx, game } = setup());
  toPlay(ctx);
  game.food = [];
  ctx.advance(TICK * 20); // nobody turns: they meet head-on in the middle
  assert.equal(game.result.draw, true);
  assert.deepEqual(game.scores, [0, 0]);
});

test('when time runs out the longer snake wins the round', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.food = [];
  // Keep both alive: send them into loops along separate rows.
  game.snakes[0].body = [[3, 2], [2, 2], [1, 2], [0, 2], [0, 3]];
  game.snakes[0].dir = 'right';
  game.snakes[1].body = [[28, 15], [29, 15], [30, 15], [31, 15]];
  game.snakes[1].dir = 'left';
  game.roundEnds = game.ctx.now() + TICK * 3;
  ctx.advance(TICK * 3);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { reason: 'time', crashed: [false, false], draw: false, roundWinner: 0 });
});

test('180° and repeated turns are ignored; two quick turns both apply; bad input ignored', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.food = [];
  game.onInput(0, { type: 'turn', dir: 'left' });
  game.onInput(0, { type: 'turn', dir: 'right' });
  game.onInput(0, { type: 'turn', dir: 'sideways' });
  game.onInput(0, { type: 'warp' });
  assert.equal(game.snakes[0].queue.length, 0);
  game.onInput(0, { type: 'turn', dir: 'up' });
  game.onInput(0, { type: 'turn', dir: 'right' });
  ctx.advance(TICK * 2);
  assert.deepEqual(head(game, 0), [6, 8]);
});

/** Steer a snake clockwise around a rectangle so it survives as long as we like. */
function circle(game, slot, [x0, y0, x1, y1]) {
  const [x, y] = game.snakes[slot].body[0];
  const dir = y === y0 && x < x1 ? 'right' : x === x1 && y < y1 ? 'down' : y === y1 && x > x0 ? 'left' : 'up';
  game.onInput(slot, { type: 'turn', dir });
}

test('snakes speed up during a round, up to the cap', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  game.food = [];
  game.snakes[0].body = [[5, 2], [4, 2], [3, 2], [2, 2]];
  game.snakes[0].dir = 'right';
  game.snakes[1].body = [[21, 10], [20, 10], [19, 10], [18, 10]];
  game.snakes[1].dir = 'right';
  const end = ctx.now() + SPEED.rampEveryMs * 2 + 200;
  while (ctx.now() < end) {
    circle(game, 0, [2, 2, 12, 7]);
    circle(game, 1, [18, 10, 29, 15]);
    ctx.advance(1000 / SPEED.maxCps / 2);
  }
  assert.equal(game.phase, 'play', 'both still alive');
  assert.equal(game.cps, SPEED.startCps + 2);
  assert.ok(game.cps <= SPEED.maxCps);
});

test('first to WIN_SCORE wins; the loop stops; rematch restarts', () => {
  const { ctx, game } = setup();
  for (let i = 0; i < WIN_SCORE; i++) {
    game.onInput(1, { type: 'turn', dir: 'up' });
    toPlay(ctx);
    game.food = [];
    ctx.advance(TICK * 10);
    if (game.phase !== 'over') ctx.advance(TIMING.roundEndMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});
