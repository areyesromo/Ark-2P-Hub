import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Lights, press, N, LEVELS } from '../server/solo/games/lights.js';

function game(level = 'easy', seed = 2) {
  const ctx = fakeCtx('Ana', { level });
  const g = new Lights(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** A way to switch every light off: press the lights that, with this rule, chase the lit ones down (then try every top row). */
function solve(board) {
  for (let top = 0; top < 1 << N; top++) {
    const b = board.slice();
    const presses = [];
    for (let x = 0; x < N; x++) if (top & (1 << x)) { press(b, x); presses.push(x); }
    for (let y = 1; y < N; y++) for (let x = 0; x < N; x++) if (b[(y - 1) * N + x]) { press(b, y * N + x); presses.push(y * N + x); }
    if (b.every((c) => !c)) return presses;
  }
  return null;
}

test('a press switches the light and the ones beside it, not the ones diagonal', () => {
  const b = Array(N * N).fill(0);
  press(b, 0); // a corner: itself and two neighbours
  assert.equal(b.filter(Boolean).length, 3);
  press(b, 12); // the middle: itself and four
  assert.equal(b.filter(Boolean).length, 8);
  press(b, 12);
  press(b, 0);
  assert.ok(b.every((c) => !c), 'pressing twice undoes it');
});

test('every puzzle has lights on and can be solved; par is the presses that made it', () => {
  for (const level of Object.keys(LEVELS)) {
    for (const seed of [1, 2, 3, 4]) {
      const { g } = game(level, seed);
      assert.ok(g.board.some(Boolean));
      assert.ok(solve(g.board), `${level} ${seed}`);
      assert.equal(g.par, LEVELS[level].presses);
    }
  }
});

test('switching them all off ends it, scored by the moves; reset goes back but keeps counting', () => {
  const { g } = game();
  const solution = solve(g.board);
  g.onInput({ type: 'press', cell: solution[0] });
  g.onInput({ type: 'reset' });
  assert.deepEqual(g.board, g.startBoard);
  assert.equal(g.moves, 1);
  for (const c of solution) g.onInput({ type: 'press', cell: c });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 1 + solution.length);
  assert.equal(v.variant, 'Easy');
  g.onInput({ type: 'rematch' });
  assert.equal(g.moves, 0);
});

test('bad input is ignored', () => {
  const { g } = game();
  const before = g.board.slice();
  for (const input of [{ type: 'press', cell: 25 }, { type: 'press', cell: -1 }, { type: 'press', cell: '3' }, { type: 'press' }, { type: 'zap' }]) g.onInput(input);
  assert.deepEqual(g.board, before);
  assert.equal(g.moves, 0);
  assert.equal(new Lights(fakeCtx('Ana', { level: 'toString' })).level, 'medium');
});
