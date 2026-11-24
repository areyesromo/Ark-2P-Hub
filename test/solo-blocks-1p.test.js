import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Blocks, W, H, TIMING, LINE_POINTS, cellsOf, gravityMs } from '../server/solo/games/blocks-1p.js';

function game(seed = 1) {
  const ctx = fakeCtx();
  const g = new Blocks(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** Fill row y of the board except the columns given. */
function fillRow(g, y, gaps = []) {
  for (let x = 0; x < W; x++) if (!gaps.includes(x)) g.board[y * W + x] = 'Z';
}

test('every 7 pieces have one of each shape', () => {
  const { g } = game(5);
  const seen = [g.piece.kind];
  for (let i = 0; i < 6; i++) seen.push(g.nextKind());
  assert.deepEqual(seen.sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
});

test('four quarter turns bring a shape back', () => {
  for (const k of ['I', 'T', 'S', 'L']) assert.deepEqual(cellsOf(k, 4), cellsOf(k, 0));
  assert.notDeepEqual(cellsOf('T', 1), cellsOf('T', 0));
});

test('gravity pulls the piece down a row at a time, faster each level', () => {
  const { ctx, g } = game();
  const y = g.piece.y;
  ctx.advance(gravityMs(1));
  assert.equal(g.piece.y, y + 1);
  assert.ok(gravityMs(5) < gravityMs(1));
});

test('moves stop at the walls; bad input is ignored', () => {
  const { g } = game();
  for (let i = 0; i < 12; i++) g.onInput({ type: 'move', dir: 'left' });
  assert.equal(Math.min(...g.cells(g.piece).map(([x]) => x)), 0);
  const before = JSON.stringify(g.piece);
  for (const bad of [{ type: 'move', dir: 'up' }, { type: 'rotate', dir: 'x' }, { type: 'nope' }]) g.onInput(bad);
  assert.equal(JSON.stringify(g.piece), before);
});

test('a turned piece against a wall is kicked back in', () => {
  const { g } = game();
  g.piece = { kind: 'I', rot: 1, x: -2, y: 5 }; // standing up against the left wall
  assert.ok(g.fits(g.piece));
  g.onInput({ type: 'rotate', dir: 'cw' });
  assert.equal(g.piece.rot, 2);
  assert.ok(g.cells(g.piece).every(([x]) => x >= 0 && x < W));
});

test('a hard drop locks at once and scores 2 a row', () => {
  const { g } = game();
  const kind = g.piece.kind;
  const ghost = g.ghostY() - g.piece.y;
  g.onInput({ type: 'drop' });
  assert.equal(g.score, 2 * ghost);
  assert.equal(g.board.filter((c) => c === kind).length, 4);
  assert.equal(g.pieces, 1);
});

test('a resting piece locks after the lock delay', () => {
  const { ctx, g } = game();
  while (!g.landed()) g.onInput({ type: 'soft' });
  ctx.advance(TIMING.lockMs - 10);
  assert.equal(g.pieces, 0);
  ctx.advance(20);
  assert.equal(g.pieces, 1);
});

test('full rows clear and score by how many at once, times the level', () => {
  const { g } = game();
  for (let y = H - 4; y < H; y++) fillRow(g, y, [0]);
  g.piece = { kind: 'I', rot: 1, x: -2, y: 0 }; // straight piece, upright in column 0
  g.onInput({ type: 'drop' });
  assert.equal(g.lines, 4);
  assert.equal(g.score - 2 * (H - 4), LINE_POINTS[4]);
  assert.equal(g.board.join('').replace(/\./g, '').length, 0);
  assert.deepEqual(g.cleared.rows, [H - 4, H - 3, H - 2, H - 1]);
});

test('hold swaps once per piece', () => {
  const { g } = game();
  const first = g.piece.kind;
  g.onInput({ type: 'hold' });
  assert.equal(g.hold, first);
  const second = g.piece.kind;
  g.onInput({ type: 'hold' });
  assert.equal(g.piece.kind, second, 'no second swap before the piece locks');
  g.onInput({ type: 'drop' });
  g.onInput({ type: 'hold' });
  assert.equal(g.piece.kind, first);
});

test('no room for a new piece ends the run; pause and rematch work', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'pause' });
  assert.equal(g.phase, 'paused');
  assert.equal(g.hostView().board, '.'.repeat(W * H), 'the well is hidden while paused');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'pause' });
  for (let y = 2; y < H; y++) fillRow(g, y, [y % W]);
  for (let i = 0; i < 20 && g.phase === 'play'; i++) g.onInput({ type: 'drop' });
  assert.equal(g.phase, 'over');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.score, 0);
});
