import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectFour, findLine, COLS, ROWS, WIN_SCORE, TIMING } from '../server/games/connect-four.js';
import { fakeCtx } from './helpers.js';

function setup() {
  const ctx = fakeCtx();
  const game = new ConnectFour(ctx, () => 0);
  game.start();
  return { ctx, game };
}

/** Play columns in order, alternating whoever's turn it is. */
function play(game, cols) {
  for (const col of cols) game.onInput(game.turn, { type: 'drop', col });
}

const empty = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

test('lines: across, down and both diagonals; three is not enough', () => {
  let b = empty();
  [0, 1, 2, 3].forEach((c) => (b[0][c] = 1));
  assert.equal(findLine(b, 2, 0).length, 4);
  b = empty();
  [0, 1, 2].forEach((r) => (b[r][5] = 2));
  assert.equal(findLine(b, 5, 2), null);
  b[3][5] = 2;
  assert.deepEqual(findLine(b, 5, 3), [[5, 0], [5, 1], [5, 2], [5, 3]]);
  b = empty();
  [0, 1, 2, 3].forEach((i) => (b[i][i + 1] = 1));
  assert.ok(findLine(b, 3, 2));
  b = empty();
  [0, 1, 2, 3].forEach((i) => (b[i][6 - i] = 2));
  assert.ok(findLine(b, 4, 2));
});

test('discs stack up, turns alternate, and only the player whose turn it is can drop', () => {
  const { game } = setup();
  assert.equal(game.turn, 0);
  game.onInput(1, { type: 'drop', col: 3 }); // not their turn
  assert.equal(game.board[0][3], 0);
  game.onInput(0, { type: 'drop', col: 3 });
  game.onInput(1, { type: 'drop', col: 3 });
  assert.equal(game.board[0][3], 1);
  assert.equal(game.board[1][3], 2);
  assert.deepEqual(game.lastMove, { col: 3, row: 1, by: 1 });
  assert.equal(game.turn, 0);
});

test('a full column and bad input are ignored', () => {
  const { game } = setup();
  play(game, [0, 0, 0, 0, 0, 0]); // fills column 0 (alternating, no four)
  const turn = game.turn;
  game.onInput(turn, { type: 'drop', col: 0 });
  assert.equal(game.turn, turn, 'still their turn');
  for (const col of [-1, 7, 2.5, '3', null]) game.onInput(turn, { type: 'drop', col });
  assert.equal(game.moves, 6);
});

test('four in a row wins the round; the other player starts the next one', () => {
  const { ctx, game } = setup();
  play(game, [0, 0, 1, 1, 2, 2, 3]); // player 1 across the bottom
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 0, draw: false });
  assert.deepEqual(game.scores, [1, 0]);
  assert.equal(game.hostView().line.length, 4);
  ctx.advance(TIMING.roundEndMs);
  assert.equal(game.phase, 'play');
  assert.equal(game.round, 2);
  assert.equal(game.turn, 1, 'starter swaps');
  assert.equal(game.board.flat().filter(Boolean).length, 0);
});

test('a full board with no four is a draw', () => {
  const { game } = setup();
  // Column pairs filled in an order that never lines up four.
  const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
  play(game, order);
  assert.equal(game.moves, ROWS * COLS);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: null, draw: true });
  assert.deepEqual(game.scores, [0, 0]);
});

test('the turn clock is pushed every second; running out plays a random column', () => {
  const { ctx, game } = setup();
  ctx.advance(1000);
  assert.equal(game.hostView().timeLeftMs, TIMING.turnMs - 1000);
  ctx.advance(TIMING.turnMs - 1000);
  assert.equal(game.moves, 1);
  assert.equal(game.board[0][0], 1, 'rng 0 picks the first open column');
  assert.equal(game.turn, 1);
  assert.equal(game.hostView().timeLeftMs, TIMING.turnMs, 'a fresh clock for the next player');
});

test(`first to ${WIN_SCORE} rounds wins; rematch resets`, () => {
  const { ctx, game } = setup();
  // Each round, whoever starts wins with a vertical four in column 6 (the other stacks column 5).
  let rounds = 0;
  while (game.phase !== 'over') {
    play(game, [6, 5, 6, 5, 6, 5, 6]);
    rounds++;
    if (game.phase === 'roundEnd') ctx.advance(TIMING.roundEndMs);
  }
  assert.equal(rounds, 2 * WIN_SCORE - 1, 'starters alternate, so it goes the distance');
  assert.equal(game.scores[game.winner], WIN_SCORE);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'play');
  assert.deepEqual(game.scores, [0, 0]);
});
