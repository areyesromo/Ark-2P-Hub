import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Checkers, legalMoves, SIZE, TIMING } from '../server/games/checkers.js';
import { fakeCtx } from './helpers.js';

// Board codes: 0 empty, 1 P1 man, 2 P2 man, 3 P1 king, 4 P2 king. Row 0 is P2's back row (top),
// row 7 is P1's (bottom); P1 moves up (to lower rows), P2 down.
const empty = () => Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Checkers(ctx, () => 0);
  game.start();
  return { ctx, game, v: () => game.hostView() };
}
const mv = (game, slot, from, to) => game.onInput(slot, { type: 'move', from, to });

test('the opening position: 12 men each on the dark squares; P1 starts; 7 opening moves', () => {
  const { game, v } = setup();
  const b = v().board;
  let p1 = 0;
  let p2 = 0;
  b.forEach((row, r) => row.forEach((x, c) => {
    if (x) assert.equal((r + c) % 2, 1, 'dark squares only');
    if (x === 1) { p1++; assert.ok(r >= 5); }
    if (x === 2) { p2++; assert.ok(r <= 2); }
  }));
  assert.deepEqual([p1, p2], [12, 12]);
  assert.equal(v().turn, 0);
  assert.equal(v().legal.length, 7);
  assert.equal(game.phase, 'play');
});

test('men move one step diagonally forward; wrong turn, bad squares and backward moves are ignored', () => {
  const { game, v } = setup();
  mv(game, 1, [1, 2], [0, 3]); // not P2's turn
  mv(game, 0, [0, 5], [0, 4]); // straight up: not diagonal
  mv(game, 0, [0, 5], [2, 3]); // two squares without a jump
  assert.equal(v().turn, 0);
  mv(game, 0, [0, 5], [1, 4]);
  assert.equal(v().board[4][1], 1);
  assert.equal(v().board[5][0], 0);
  assert.equal(v().turn, 1);
  assert.deepEqual(v().lastMove, { from: [0, 5], to: [1, 4], captured: [] });
});

test('jumps are forced, take the piece, and a multi-jump keeps the same piece going', () => {
  const b = empty();
  b[5][0] = 1; // P1 man at (c0, r5)
  b[4][1] = 2; // jumpable
  b[2][3] = 2; // jumpable after landing on (2, 3)
  b[0][7] = 2; // so P2 still has a piece
  b[7][6] = 1; // another P1 man that could step (not allowed: a jump is available)
  assert.deepEqual(legalMoves(b, 0, null), [{ from: [0, 5], to: [2, 3] }]);
  const { game, v } = setup();
  game.board = b;
  game.legal = legalMoves(b, 0, null);
  mv(game, 0, [6, 7], [5, 6]); // a step while a jump is open: ignored
  assert.equal(v().board[7][6], 1);
  mv(game, 0, [0, 5], [2, 3]);
  assert.equal(v().board[4][1], 0, 'captured');
  assert.equal(v().turn, 0, 'still P1: another jump');
  assert.deepEqual(v().chain, [2, 3]);
  assert.deepEqual(v().legal, [{ from: [2, 3], to: [4, 1] }]);
  mv(game, 0, [2, 3], [4, 1]);
  assert.equal(v().board[2][3], 0);
  assert.equal(v().board[1][4], 1);
  assert.equal(v().turn, 1);
  assert.equal(v().chain, null);
});

test('reaching the far row crowns a king (and ends the jump chain); kings move both ways', () => {
  const b = empty();
  b[1][2] = 1;
  b[6][1] = 2;
  const { game, v } = setup();
  game.board = b;
  game.legal = legalMoves(b, 0, null);
  mv(game, 0, [2, 1], [1, 0]);
  assert.equal(v().board[0][1], 3, 'a P1 king');
  assert.equal(v().turn, 1);
  const k = empty();
  k[4][3] = 3;
  const to = legalMoves(k, 0, null).map((m) => m.to.join());
  assert.deepEqual(to.sort(), ['2,3', '2,5', '4,3', '4,5']);
});

test('a player with no pieces (or no moves) loses the round; first to the wins setting takes the match', () => {
  const b = empty();
  b[5][2] = 1;
  b[4][3] = 2; // P2's last piece
  const { game, v, ctx } = setup({ wins: 2 });
  game.board = b;
  game.legal = legalMoves(b, 0, null);
  mv(game, 0, [2, 5], [4, 3]);
  assert.equal(v().phase, 'roundEnd');
  assert.deepEqual(v().result, { winner: 0, draw: false, why: 'pieces' });
  assert.deepEqual(v().scores, [1, 0]);
  ctx.advance(TIMING.roundEndMs);
  assert.equal(v().phase, 'play');
  assert.equal(v().turn, 1, 'the starter swaps');
  const nb = empty();
  nb[0][1] = 1; // P1 man stuck at the top? (it's a king row: it would be a king) use a blocked man instead
  nb[0][1] = 0;
  nb[2][1] = 2; // P2 to move, blocked by two P1 men
  nb[3][0] = 1;
  nb[3][2] = 1;
  nb[4][3] = 1; // blocks the jump over (2, 3)
  nb[4][1] = 1; // blocks the jump over (0, 3)? off-board anyway
  game.board = nb;
  game.legal = legalMoves(nb, 1, null);
  assert.equal(game.legal.length, 0);
  game.checkStuck();
  assert.equal(v().phase, 'over');
  assert.equal(v().winner, 0);
});

test('40 moves without a capture or a man moving is a draw', () => {
  const b = empty();
  b[7][0] = 3;
  b[0][7] = 4;
  const { game, v } = setup();
  game.board = b;
  game.legal = legalMoves(b, 0, null);
  // each king shuffles in its own corner: (0, 7) <-> (1, 6) and (7, 0) <-> (6, 1)
  const at = [[[0, 7], [1, 6]], [[7, 0], [6, 1]]];
  for (let i = 0; i < 40; i++) {
    assert.equal(v().phase, 'play', `move ${i}`);
    const slot = v().turn;
    const [a, b2] = at[slot];
    mv(game, slot, a, b2);
    at[slot] = [b2, a];
  }
  assert.equal(v().phase, 'roundEnd');
  assert.deepEqual(v().result, { winner: null, draw: true, why: 'quiet' });
});

test('the move clock: run out and a legal move is played for you', () => {
  const { game, v, ctx } = setup();
  assert.ok(v().timeLeftMs > 0);
  ctx.advance(TIMING.turnMs);
  assert.equal(v().turn, 1);
  assert.equal(v().lastMove.captured.length, 0);
  assert.ok(game.board[4].some((x) => x === 1));
});

test('views: phones get "you"; the TV gets the players; rematch only at the end', () => {
  const { game, v } = setup();
  assert.equal(game.playerView(1).you, 1);
  assert.equal(v().players.length, 2);
  game.onInput(0, { type: 'rematch' });
  assert.equal(v().phase, 'play');
});
