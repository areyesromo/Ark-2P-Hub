import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UltimateTtt, TIMING, newPosition, playMove, legalMoves } from '../server/games/ultimate-ttt.js';
import { ultimateTttBot } from '../server/games/ultimate-ttt-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new UltimateTtt(ctx);
  g.start();
  return { ctx, g };
}

test('where you play sends them to that board; a won or full board sends them anywhere', () => {
  const p = newPosition();
  assert.equal(legalMoves(p).length, 81);
  playMove(p, 4 * 9 + 2, 1); // the middle board, top-right square
  assert.equal(p.next, 2);
  assert.deepEqual(legalMoves(p), [18, 19, 20, 21, 22, 23, 24, 25, 26]);
  // Board 0 won by player 1: being sent there means any open board.
  const q = newPosition();
  for (const i of [0, 1, 2]) q.cells[i] = 1;
  q.boards[0] = 1;
  playMove(q, 5 * 9 + 0, 2);
  assert.equal(q.next, -1);
  assert.ok(legalMoves(q).every((c) => Math.floor(c / 9) !== 0));
});

test('three boards in a row wins; input is checked', () => {
  const { g } = setup();
  const pos = g.pos;
  // Boards 0 and 1 already player 1's; player 1 finishes board 2 with a line.
  pos.boards[0] = 1; pos.boards[1] = 1;
  pos.cells[18] = 1; pos.cells[19] = 1;
  pos.next = 2;
  for (const bad of [{ type: 'place', cell: 30 }, { type: 'place', cell: 18 }, { type: 'place', cell: 'x' }]) g.onInput(0, bad);
  g.onInput(1, { type: 'place', cell: 20 }); // not their turn
  assert.equal(g.phase, 'play');
  g.onInput(0, { type: 'place', cell: 20 });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  assert.deepEqual(g.line, [0, 1, 2]);
});

test('out of time: a random square that may be played', () => {
  const { ctx, g } = setup();
  g.onInput(0, { type: 'place', cell: 40 });
  ctx.advance(TIMING.turnMs + 1000);
  assert.equal(g.lastMove.by, 1);
  assert.equal(Math.floor(g.lastMove.cell / 9), 4);
});

test('the computer finishes a game it can win, and Easy beats a player who leaves it to the clock', () => {
  const pos = newPosition();
  pos.boards[0] = 2; pos.boards[4] = 2;
  pos.cells[72] = 2; pos.cells[73] = 2; // board 8: one more for its line, and the game
  pos.next = 8;
  const v = { phase: 'play', turn: 1, you: 1, round: 1, lastMove: { cell: 8, by: 0, n: 20 }, ...pos };
  assert.equal(ultimateTttBot(v, 'normal', seeded(3)).cell, 74);
  for (let seed = 1; seed <= 2; seed++) {
    const cpu = seed % 2;
    assert.equal(play('ultimate-ttt', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
