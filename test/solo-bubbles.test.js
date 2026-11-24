import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Bubbles, COLS, DEATH_ROW, MISSES_PER_DROP } from '../server/solo/games/bubbles.js';

function game(seed = 3) {
  const ctx = fakeCtx();
  const g = new Bubbles(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** An empty board with just these bubbles: { 'r,c': colour }. */
function board(g, cells) {
  g.parity = 0;
  g.grid = Array.from({ length: DEATH_ROW + 2 }, (_, r) => Array(g.width(r)).fill(-1));
  for (const [k, v] of Object.entries(cells)) {
    const [r, c] = k.split(',').map(Number);
    g.grid[r][c] = v;
  }
}

test('a fresh board has five rows; short rows hold one fewer', () => {
  const { g } = game();
  assert.equal(g.grid[0].length, COLS);
  assert.equal(g.grid[1].length, COLS - 1);
  assert.equal(g.lowest(), 4);
  assert.ok(g.grid[0].every((v) => v >= 0 && v < g.colours));
});

test('neighbours: six round a bubble, fewer at the edges', () => {
  const { g } = game();
  assert.equal(g.neighbours(2, 4).length, 6);
  assert.equal(g.neighbours(0, 0).length, 2);
  assert.deepEqual(g.neighbours(1, 0).map(String).sort(), ['0,0', '0,1', '1,1', '2,0', '2,1'].sort());
});

test('a shot straight up flies to the ceiling; one at an angle bounces off a wall', () => {
  const { g } = game();
  board(g, {});
  const up = g.fly(0);
  assert.equal(up.r, 0);
  assert.equal(up.path.length, 2);
  const side = g.fly(60);
  assert.ok(side.path.length >= 3, 'turned at a wall');
  assert.equal(side.r, 0);
});

test('three of a colour pop, and what hung from them falls', () => {
  const { g } = game();
  // Two reds on the ceiling (columns 4 and 5) with a blue hanging below them.
  board(g, { '0,4': 0, '0,5': 0, '1,4': 1 });
  g.current = 0;
  // Fire at the red pair's right: it sticks at 0,6 next to them.
  const target = g.centre(0, 6);
  const angle = (Math.atan2(target.x - 5, 15) * 180) / Math.PI;
  g.onInput({ type: 'shoot', angle });
  const last = g.last;
  assert.equal(last.popped.length, 3, JSON.stringify(last.at));
  assert.equal(last.dropped.length, 1);
  assert.equal(g.score, 3 * 10 + 20 + 1000, 'popped, dropped, and the board cleared');
  assert.equal(g.level, 2);
  assert.equal(g.last.cleared, true);
});

test('shots that pop nothing bring the ceiling down; a bubble on the line ends the run', () => {
  const { g } = game();
  board(g, { '0,0': 0 });
  g.current = 1;
  g.next = 1;
  for (let i = 0; i < MISSES_PER_DROP; i++) {
    g.current = i % 2 ? 2 : 1;
    g.onInput({ type: 'shoot', angle: 0 });
  }
  assert.equal(g.parity, 1, 'came down a row');
  assert.equal(g.misses, 0);
  // Fill a column down to the line and the next shot ends it.
  board(g, {});
  for (let r = 0; r < DEATH_ROW; r++) g.grid[r][4] = r % 2 ? 1 : 2;
  g.current = 3;
  g.onInput({ type: 'shoot', angle: 0 });
  assert.equal(g.phase, 'over');
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.score, 0);
});

test('the next bubble is always a colour on the board; bad input is ignored', () => {
  const { g } = game();
  for (let i = 0; i < 20 && g.phase === 'play'; i++) {
    g.onInput({ type: 'shoot', angle: (i * 37) % 140 - 70 });
    if (g.phase === 'play' && !g.last.cleared) assert.ok(g.colourLeft(g.current), 'current colour on the board');
  }
  const { g: h } = game();
  const shots = h.shots;
  for (const input of [{ type: 'shoot' }, { type: 'shoot', angle: 'x' }, { type: 'shoot', angle: NaN }, { type: 'zap', angle: 0 }]) h.onInput(input);
  assert.equal(h.shots, shots);
  h.onInput({ type: 'aim', angle: 500 });
  assert.equal(h.aim, 78);
  assert.equal(h.shots, shots);
});
