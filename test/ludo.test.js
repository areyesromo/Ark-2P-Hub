import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ludo, TIMING, HOME, target, squareOf, movable } from '../server/games/ludo.js';
import { ludoBot } from '../server/games/ludo-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

/** A game whose dice roll the numbers given, in order. */
function setup(rolls = [], settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const queue = rolls.map((d) => (d - 1) / 6 + 0.01);
  const game = new Ludo(ctx, () => (queue.length ? queue.shift() : 0.5));
  game.start();
  return { ctx, game };
}

test('the board: each starts on its own square, opposite each other; the home path after a lap', () => {
  assert.equal(squareOf(0, 0), 0);
  assert.equal(squareOf(1, 0), 26);
  assert.equal(squareOf(1, 30), 4);
  assert.equal(squareOf(0, 51), null, 'on the home path');
  const pawns = [[-1, 10, 53, HOME], [-1, -1, -1, -1]];
  assert.equal(target(pawns, 0, 0, 5), null, 'needs a 6 to come out');
  assert.equal(target(pawns, 0, 0, 6), 0);
  assert.equal(target(pawns, 0, 2, 4), null, 'home exactly, not past it');
  assert.equal(target(pawns, 0, 2, 3), HOME);
  assert.deepEqual(movable(pawns, 0, 6), [0, 1]);
});

test('a 6 brings a pawn out and rolls again; nothing to move passes the turn', () => {
  const { ctx, game } = setup([3, 6, 2]);
  const s = game.turn;
  game.onInput(1 - s, { type: 'roll' }); // not their turn
  game.onInput(s, { type: 'roll' }); // a 3: nobody out yet
  assert.equal(game.phase, 'show');
  ctx.advance(TIMING.showMs);
  assert.equal(game.turn, 1 - s);
  game.onInput(1 - s, { type: 'roll' }); // a 6
  assert.equal(game.phase, 'move');
  game.onInput(1 - s, { type: 'move', pawn: 9 });
  game.onInput(1 - s, { type: 'move', pawn: 2 });
  assert.equal(game.pawns[1 - s][2], 0);
  assert.equal(game.phase, 'roll', 'a 6: again');
  assert.equal(game.turn, 1 - s);
  game.onInput(1 - s, { type: 'roll' }); // a 2
  game.onInput(1 - s, { type: 'move', pawn: 2 });
  assert.equal(game.pawns[1 - s][2], 2);
  assert.equal(game.turn, s);
});

test('landing on a lone pawn sends it back (not on a safe square), and rolls again', () => {
  const { game } = setup([4]);
  game.turn = 0;
  game.pawns = [[10, -1, -1, -1], [-1, -1, -1, -1]];
  // Player 2's pawn on board square 14: its place is 14 - 26 + 52 = 40.
  game.pawns[1][0] = 40;
  game.startRoll();
  game.onInput(0, { type: 'roll' });
  game.onInput(0, { type: 'move', pawn: 0 });
  assert.equal(game.pawns[1][0], -1, 'back to the yard');
  assert.equal(game.last.hit, 0);
  assert.equal(game.turn, 0, 'and again');
  // On a star (square 21) it's safe.
  const safe = setup([4]).game;
  safe.turn = 0;
  safe.pawns = [[17, -1, -1, -1], [47, -1, -1, -1]]; // 47 + 26 = 73 % 52 = 21
  safe.startRoll();
  safe.onInput(0, { type: 'roll' });
  safe.onInput(0, { type: 'move', pawn: 0 });
  assert.equal(safe.pawns[1][0], 47);
});

test('all four home wins; out of time rolls and moves for you; no timer waits', () => {
  const { ctx, game } = setup([2]);
  game.turn = 0;
  game.pawns = [[HOME, HOME, HOME, 54], [-1, -1, -1, -1]];
  game.startRoll();
  game.onInput(0, { type: 'roll' });
  game.onInput(0, { type: 'move', pawn: 3 });
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  game.onInput(1, { type: 'rematch' });
  ctx.advance(TIMING.rollMs);
  assert.ok(game.die !== null);
  const off = setup([], { timer: 'off' });
  off.ctx.advance(TIMING.rollMs * 5);
  assert.equal(off.game.phase, 'roll');
});

test('the computer: takes a pawn when it can, brings one out on a 6', () => {
  const base = { phase: 'move', turn: 0, you: 0, game: 1, rollNo: 3 };
  // (a fixed rng: Easy plays a random pawn one time in ten, which this isn't testing)
  const hit = ludoBot({ ...base, die: 4, pawns: [[10, 2, -1, -1], [40, -1, -1, -1]], movable: [0, 1] }, 'easy', () => 0.5);
  assert.equal(hit.pawn, 0);
  for (const level of ['easy', 'normal', 'hard']) {
    const out = ludoBot({ ...base, die: 6, pawns: [[-1, 30, -1, -1], [-1, -1, -1, -1]], movable: [0, 1, 2, 3] }, level, () => 0.5);
    assert.ok([0, 2, 3].includes(out.pawn), level);
  }
  assert.equal(ludoBot({ ...base, phase: 'roll' }, 'hard').type, 'roll');
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock, most of the time', () => {
  let hard = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const flip = seed % 2;
    const { view } = play('ludo', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 7, 'Hard won ' + hard + ' of 10');
  let easy = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const cpu = seed % 2;
    const { view } = play('ludo', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3 * 3600 * 1000 });
    if (view.winner === cpu) easy++;
  }
  assert.ok(easy >= 8, 'Easy won ' + easy + ' of 10 (the dice decide some)');
});
