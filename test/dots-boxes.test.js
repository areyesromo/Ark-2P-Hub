import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DotsBoxes, TIMING } from '../server/games/dots-boxes.js';
import { fakeCtx } from './helpers.js';

// Lines: { dir: 'h', r, c } joins dot (r, c) to (r, c + 1); { dir: 'v', r, c } joins (r, c) to (r + 1, c).
// A grid of n × n boxes has (n + 1) rows of n h-lines and n rows of (n + 1) v-lines.
function setup(settings) {
  const ctx = fakeCtx();
  ctx.settings = settings || {};
  const game = new DotsBoxes(ctx, () => 0);
  game.start();
  return { ctx, game, v: () => game.hostView() };
}
const line = (game, slot, dir, r, c) => game.onInput(slot, { type: 'line', dir, r, c });

test('the grid: 4 × 4 boxes by default (3 and 5 as settings); P1 starts; lines and boxes start empty', () => {
  let { v } = setup();
  assert.equal(v().size, 4);
  assert.equal(v().h.length, 5);
  assert.equal(v().h[0].length, 4);
  assert.equal(v().v.length, 4);
  assert.equal(v().v[0].length, 5);
  assert.equal(v().boxes.flat().filter((b) => b !== null).length, 0);
  assert.equal(v().turn, 0);
  ({ v } = setup({ size: 3 }));
  assert.equal(v().boxes.length, 3);
});

test('drawing a line passes the turn; a drawn line, wrong turn or a bad line is ignored', () => {
  const { game, v } = setup();
  line(game, 1, 'h', 0, 0); // not their turn
  assert.equal(v().h[0][0], null);
  line(game, 0, 'h', 0, 9); // off the grid
  line(game, 0, 'x', 0, 0);
  line(game, 0, 'h', 0, 0);
  assert.equal(v().h[0][0], 0);
  assert.equal(v().turn, 1);
  line(game, 1, 'h', 0, 0); // already drawn
  assert.equal(v().turn, 1);
  assert.deepEqual(v().lastLine, { dir: 'h', r: 0, c: 0, by: 0 });
});

test('closing a box scores it and you go again; one line can close two boxes', () => {
  const { game, v } = setup();
  line(game, 0, 'h', 0, 0);
  line(game, 1, 'v', 0, 0);
  line(game, 0, 'h', 1, 0);
  line(game, 1, 'v', 0, 1); // closes box (0, 0)
  assert.equal(v().boxes[0][0], 1);
  assert.deepEqual(v().score, [0, 1]);
  assert.equal(v().turn, 1, 'goes again');
  // box (0, 1) needs h 0,1 / h 1,1 / v 0,2 (v 0,1 is shared and drawn); box (1, 1) shares h 1,1
  line(game, 1, 'h', 0, 1);
  line(game, 0, 'v', 0, 2);
  line(game, 1, 'v', 1, 1);
  line(game, 0, 'v', 1, 2);
  line(game, 1, 'h', 2, 1);
  assert.equal(v().turn, 0);
  line(game, 0, 'h', 1, 1); // closes (0, 1) and (1, 1) at once
  assert.equal(v().boxes[0][1], 0);
  assert.equal(v().boxes[1][1], 0);
  assert.deepEqual(v().score, [2, 1]);
  assert.equal(v().turn, 0);
});

test('when every line is drawn, the most boxes wins (a tie is a draw); first to the wins setting', () => {
  const { game, v, ctx } = setup({ size: 3, wins: 2 });
  let guard = 0;
  while (v().phase === 'play' && guard++ < 100) {
    const open = [];
    v().h.forEach((row, r) => row.forEach((x, c) => { if (x === null) open.push(['h', r, c]); }));
    v().v.forEach((row, r) => row.forEach((x, c) => { if (x === null) open.push(['v', r, c]); }));
    line(game, v().turn, ...open[0]);
  }
  assert.equal(v().phase, 'roundEnd');
  const s = v().score;
  assert.equal(s[0] + s[1], 9);
  assert.equal(v().result.winner, s[0] > s[1] ? 0 : 1);
  assert.equal(v().scores[v().result.winner], 1);
  ctx.advance(TIMING.roundEndMs);
  assert.equal(v().phase, 'play');
  assert.equal(v().turn, 1, 'the starter swaps');
  assert.deepEqual(v().score, [0, 0]);
});

test('the move clock: run out and a line is drawn for you', () => {
  const { v, ctx } = setup();
  ctx.advance(TIMING.turnMs);
  assert.equal(v().turn, 1);
  assert.ok(v().lastLine);
});

test('views: phones get "you", the TV the players; rematch only at the end', () => {
  const { game, v } = setup();
  assert.equal(game.playerView(1).you, 1);
  assert.equal(v().players.length, 2);
  game.onInput(0, { type: 'rematch' });
  assert.equal(v().phase, 'play');
});
