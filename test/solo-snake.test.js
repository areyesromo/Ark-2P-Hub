// Snake in the 1 player mode: Snake Battle's arena with one snake (server/games/snake.js, soloSnake).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { SnakeBattle, soloSnake, GRID, TIMING, START_LENGTH, SOLO_SPEEDS, FASTER_EVERY } from '../server/games/snake.js';
import { getGame, soloGameOf, gameFor, listGames } from '../server/games/index.js';

/** A run past the countdown, as the room plays it (onInput(input), playerView()), the food out of the way. */
function playing(settings) {
  const ctx = fakeCtx('Ana', settings);
  ctx.rng = () => 0.99;
  const run = soloSnake.create(ctx);
  run.start();
  ctx.advance(TIMING.countdownMs);
  const g = run.game;
  assert.equal(g.phase, 'play');
  return { ctx, run, g };
}

const ticks = (ctx, g, n) => { for (let i = 0; i < n; i++) ctx.advance(1000 / g.cps); };
const head = (g) => g.snakes[0].body[0];

test('one snake, one food, no rounds or clock: it moves one cell per tick', () => {
  const { ctx, run, g } = playing();
  assert.equal(g.snakes.length, 1);
  assert.equal(g.food.length, 1);
  const [x, y] = head(g);
  ticks(ctx, g, 1);
  assert.deepEqual(head(g), [x + 1, y]);
  const v = run.hostView();
  assert.equal(v.solo, true);
  assert.equal(v.score, 0);
  assert.equal(v.length, START_LENGTH);
  assert.equal(v.scores, undefined, 'no scoreboard');
  assert.deepEqual(Object.keys(run.playerView()).sort(), Object.keys(v).filter((k) => k !== 'player').concat('you').sort());
});

test('eating scores and grows; every few bites it speeds up', () => {
  const { ctx, run, g } = playing();
  for (let i = 0; i < FASTER_EVERY; i++) {
    const [x, y] = head(g);
    g.food = [[x + 1, y]];
    ticks(ctx, g, 1);
  }
  assert.equal(run.hostView().score, FASTER_EVERY);
  assert.equal(run.hostView().length, START_LENGTH + FASTER_EVERY);
  assert.equal(g.cps, SOLO_SPEEDS.normal.startCps + 1);
  assert.equal(g.food.length, 1, 'new food somewhere else');
});

test('turns: no reversing into your neck, two quick ones queue, bad ones are ignored', () => {
  const { ctx, run, g } = playing();
  run.onInput({ type: 'turn', dir: 'left' });
  assert.equal(g.snakes[0].queue.length, 0);
  run.onInput({ type: 'turn', dir: 'up' });
  run.onInput({ type: 'turn', dir: 'left' });
  run.onInput({ type: 'turn', dir: 'nope' });
  run.onInput({ type: 'turn', dir: 'constructor' });
  assert.deepEqual(g.snakes[0].queue, ['up', 'left']);
  ticks(ctx, g, 2);
  assert.equal(g.snakes[0].dir, 'left');
});

test('a solid wall ends the run; the score is what you ate; play again starts afresh', () => {
  const { ctx, run, g } = playing();
  ticks(ctx, g, GRID.w);
  assert.equal(g.phase, 'over');
  assert.equal(run.hostView().crashed, true);
  assert.equal(run.hostView().score, 0);
  assert.equal(ctx.pendingTimers(), 0);
  run.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'countdown');
  assert.equal(run.hostView().crashed, false);
});

test('wrap walls bring you out the other side, and the variant says so', () => {
  const { ctx, run, g } = playing({ walls: 'wrap', speed: 'fast' });
  assert.equal(g.cps, SOLO_SPEEDS.fast.startCps);
  ticks(ctx, g, GRID.w);
  assert.equal(g.phase, 'play');
  assert.equal(run.hostView().variant, 'Fast · Wrap');
  assert.equal(run.hostView().wrap, true);
});

test('pause stops the snake and carries on where it was; 1v1 Snake Battle can\'t be paused', () => {
  const { ctx, run, g } = playing();
  run.onInput({ type: 'pause' });
  assert.equal(g.phase, 'paused');
  const at = head(g).slice();
  ctx.advance(5000);
  assert.deepEqual(head(g), at);
  run.onInput({ type: 'pause' });
  ticks(ctx, g, 1);
  assert.notDeepEqual(head(g), at);
  const duo = new SnakeBattle(fakeCtx(), () => 0.99);
  duo.start();
  duo.onInput(0, { type: 'pause' });
  assert.equal(duo.phase, 'countdown');
});

test('one game in both lobbies: Snake Battle 1v1, Snake for 1 player, under one id', () => {
  const duo = getGame('snake');
  assert.equal(duo.name, 'Snake Battle');
  assert.equal(soloGameOf('snake').name, 'Snake');
  assert.equal(soloGameOf('snake').solo, true);
  assert.equal(gameFor('snake', 'duo'), duo);
  assert.equal(gameFor('snake', 'solo'), soloGameOf('snake'));
  assert.equal(gameFor('dogpark', 'duo'), null);
  assert.equal(gameFor('pong', 'solo'), null);
  const entries = listGames().filter((g) => g.id === 'snake');
  assert.deepEqual(entries.map((g) => [g.name, g.solo, g.category]), [['Snake Battle', false, 'competitive'], ['Snake', true, 'arcade']]);
  assert.notEqual(entries[0].blurb, entries[1].blurb, 'each lobby has its own line');
  assert.ok(!listGames().some((g) => g.id === 'snake-1p'), 'Snake 1P is gone');
});
