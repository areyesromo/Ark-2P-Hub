import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reversi, SIZE, TIMING, newBoard, flipsFor, legalMoves, countDiscs } from '../server/games/reversi.js';
import { reversiBot } from '../server/games/reversi-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

const at = (x, y) => y * SIZE + x;

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Reversi(ctx, () => 0);
  game.start();
  return { ctx, game };
}

test('the start: four discs in the middle, four moves for the dark side', () => {
  const b = newBoard();
  assert.deepEqual(countDiscs(b), [2, 2]);
  assert.deepEqual(legalMoves(b, 1).sort((a, c) => a - c), [at(3, 2), at(2, 3), at(5, 4), at(4, 5)].sort((a, c) => a - c));
  assert.deepEqual(flipsFor(b, at(3, 2), 1), [at(3, 3)]);
  assert.deepEqual(flipsFor(b, at(0, 0), 1), [], 'traps nothing');
  assert.deepEqual(flipsFor(b, at(3, 3), 1), [], 'taken');
});

test('a move flips every trapped line at once, in all directions', () => {
  const b = new Array(64).fill(0);
  b[at(3, 3)] = 1;
  // Player 2 lines from (3,3) out to player 1 discs: across, down and diagonal.
  for (const [x, y] of [[4, 3], [5, 3], [3, 4], [4, 4]]) b[at(x, y)] = 2;
  b[at(6, 3)] = 1;
  b[at(3, 5)] = 1;
  b[at(5, 5)] = 1;
  const flips = flipsFor(b, at(3, 3), 1);
  assert.deepEqual(flips, [], 'taken');
  b[at(3, 3)] = 0;
  b[at(2, 2)] = 0;
  const g = flipsFor(b, at(3, 3), 1).sort((a, c) => a - c);
  assert.deepEqual(g, [at(4, 3), at(5, 3), at(3, 4), at(4, 4)].sort((a, c) => a - c));
  // A line that ends at an empty square or the edge traps nothing.
  const e = new Array(64).fill(0);
  e[at(1, 0)] = 2;
  e[at(2, 0)] = 2;
  assert.deepEqual(flipsFor(e, at(0, 0), 1), []);
});

test('turns alternate, and only legal moves on your own turn count', () => {
  const { game } = setup();
  assert.equal(game.turn, 0);
  game.onInput(1, { type: 'place', cell: at(3, 2) }); // not their turn
  game.onInput(0, { type: 'place', cell: at(0, 0) }); // flips nothing
  for (const cell of [-1, 64, 2.5, '19', null]) game.onInput(0, { type: 'place', cell });
  game.onInput(0, { type: 'nope', cell: at(3, 2) });
  assert.deepEqual(countDiscs(game.board), [2, 2]);
  game.onInput(0, { type: 'place', cell: at(3, 2) });
  assert.deepEqual(countDiscs(game.board), [4, 1]);
  assert.deepEqual(game.lastMove, { cell: at(3, 2), flips: [at(3, 3)], by: 0, n: 1 });
  assert.equal(game.turn, 1);
  assert.ok(game.legal.length > 0);
});

test('with no move you pass, and the other plays on', () => {
  const { ctx, game } = setup();
  // Player 2 (to move) has nothing; player 1 has a move at (2,0).
  game.board = new Array(64).fill(0);
  game.board[at(0, 0)] = 1;
  game.board[at(1, 0)] = 2;
  game.turn = 1;
  game.startTurn();
  assert.equal(game.phase, 'pass');
  assert.equal(game.passed, 1);
  assert.equal(game.turn, 0);
  ctx.advance(TIMING.passMs);
  assert.equal(game.phase, 'play');
  assert.deepEqual(game.legal, [at(2, 0)]);
});

test('when neither can move, most discs wins the game; first to the wins needed takes the match', () => {
  const { ctx, game } = setup({ wins: 2 });
  assert.equal(game.winScore, 2);
  game.board = new Array(64).fill(0);
  game.board[at(0, 0)] = 1;
  game.board[at(1, 0)] = 1;
  game.board[at(7, 7)] = 2;
  game.startTurn();
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 0, draw: false, discs: [2, 1] });
  assert.deepEqual(game.scores, [1, 0]);
  ctx.advance(TIMING.roundEndMs);
  assert.equal(game.phase, 'play');
  assert.equal(game.turn, 1, 'the other player starts the next game');
  game.board = new Array(64).fill(0);
  game.board[at(0, 0)] = 1;
  game.startTurn();
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'play');
  assert.deepEqual(game.scores, [0, 0]);
});

test('a level board is a drawn game: nobody scores', () => {
  const { game } = setup();
  game.board = new Array(64).fill(0);
  game.board[at(0, 0)] = 1;
  game.board[at(7, 7)] = 2;
  game.startTurn();
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.result.draw, true);
  assert.deepEqual(game.scores, [0, 0]);
});

test('the clock plays a legal move for you; with no timer it waits', () => {
  const { ctx, game } = setup();
  assert.equal(game.view().timeLeftMs, TIMING.turnMs);
  ctx.advance(TIMING.turnMs);
  assert.equal(game.turn, 1);
  assert.deepEqual(countDiscs(game.board), [4, 1]);
  const off = setup({ timer: 'off' });
  off.ctx.advance(TIMING.turnMs * 3);
  assert.equal(off.game.turn, 0);
  assert.equal(off.game.view().timed, false);
});

test('a restart picks the game up: the clock runs on, a pause moves on', () => {
  const { ctx, game } = setup();
  ctx.advance(10000);
  const saved = JSON.parse(JSON.stringify(game));
  const ctx2 = fakeCtx();
  const fresh = new Reversi(ctx2);
  Object.assign(fresh, saved, { ctx: ctx2, rng: () => 0 });
  fresh.resumed(5000);
  // 20 s were left, and the 5 s the hub was down don't count (this clock starts at 0).
  assert.equal(fresh.turnEnds, TIMING.turnMs + 5000);
  ctx2.advance(TIMING.turnMs + 4000);
  assert.equal(fresh.turn, 0, 'still thinking');
  ctx2.advance(1000);
  assert.equal(fresh.turn, 1, 'its clock ran out and a move was played');
});

test('the computer: takes a corner when it can, and only ever plays a legal move', () => {
  const b = new Array(64).fill(0);
  b[at(1, 1)] = 1;
  b[at(2, 2)] = 2;
  b[at(3, 3)] = 2;
  b[at(4, 3)] = 1;
  b[at(5, 3)] = 2;
  const legal = legalMoves(b, 2);
  assert.ok(legal.includes(at(0, 0)));
  for (const level of ['normal', 'hard']) {
    const m = reversiBot({ phase: 'play', turn: 1, you: 1, board: b, legal }, level, Math.random);
    assert.equal(m.cell, at(0, 0), level);
  }
  for (let i = 0; i < 30; i++) {
    const m = reversiBot({ phase: 'play', turn: 1, you: 1, board: b, legal }, 'easy', Math.random);
    assert.ok(legal.includes(m.cell));
  }
  assert.equal(reversiBot({ phase: 'play', turn: 0, you: 1, board: b, legal }, 'hard'), null, 'not its turn');
});

test('the computer: Hard beats Normal beats Easy, and Easy beats a player who leaves it to the clock', () => {
  const duel = (a, b, n) => {
    let wins = 0;
    for (let seed = 1; seed <= n; seed++) {
      const flip = seed % 2;
      const { view } = play('reversi', flip ? [b, a] : [a, b], { seed });
      assert.equal(view.phase, 'over');
      if (view.winner === (flip ? 1 : 0)) wins++;
    }
    return wins;
  };
  assert.ok(duel('hard', 'easy', 4) >= 4, 'Hard beats Easy');
  assert.ok(duel('normal', 'easy', 4) >= 3, 'Normal beats Easy');
  for (let seed = 1; seed <= 6; seed++) {
    const cpu = seed % 2;
    const { view } = play('reversi', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu, 'seed ' + seed);
  }
});
