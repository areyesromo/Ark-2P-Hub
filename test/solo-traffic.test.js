import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Traffic, makeRandom, HINT_PENALTY } from '../server/solo/games/traffic.js';
import { LEVELS } from '../server/solo/games/traffic-levels.js';
import { RANDOM_BOARDS } from '../server/solo/games/traffic-random.js';
import { parseBoard, placesOf, solve, rangeOf, boardText, hardestFrom, EXIT_ROW, SIZE } from '../server/solo/games/traffic-gen.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

function game(board = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { board });
  const g = new Traffic(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('a board reads back as it was written; the red car is in the exit row', () => {
  for (const { rows } of LEVELS) {
    const cars = parseBoard(rows);
    assert.deepEqual(boardText(cars), rows);
    assert.equal(cars[0].id, 'r');
    assert.ok(cars[0].across && cars[0].y === EXIT_ROW && cars[0].len === 2);
    assert.ok(cars.every((c) => c.len === 2 || c.len === 3));
  }
});

test('every level has the par the solver finds, and the pars climb to over thirty', () => {
  let last = 0;
  LEVELS.forEach(({ rows, par }, i) => {
    const cars = parseBoard(rows);
    assert.equal(solve(cars, placesOf(cars)).moves, par, `level ${i + 1}`);
    assert.ok(par >= last, `level ${i + 1} is no easier than the one before`);
    last = par;
  });
  assert.equal(LEVELS.length, 40);
  assert.ok(last > 30);
});

test('sliding: only along its lane and only as far as it is clear; the red car out wins on the moves', () => {
  const { g } = game(1);
  const cars = g.cars;
  // A vehicle refused past a neighbour, or to where it already is.
  for (let i = 0; i < cars.length; i++) {
    const [lo, hi] = rangeOf(cars, g.pos, i);
    g.onInput({ type: 'move', car: i, to: hi + 1 });
    g.onInput({ type: 'move', car: i, to: lo - 1 });
    g.onInput({ type: 'move', car: i, to: g.pos[i] });
  }
  assert.equal(g.moves, 0);
  for (const bad of [{ type: 'move', car: 99, to: 1 }, { type: 'move', car: 0, to: 'x' }, { type: 'nope' }]) g.onInput(bad);
  // Play the solver's way.
  for (let k = 0; k < 50 && g.phase === 'play'; k++) {
    const s = solve(g.cars, g.pos);
    g.onInput({ type: 'move', car: s.first[0], to: s.first[1] });
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, LEVELS[0].par);
  assert.equal(v.starred, true);
  assert.equal(v.variant, 'Level 1');
});

test('undo takes a move back (and off the count); start again; a hint moves for you and costs 2', () => {
  const { g } = game(5);
  const s = solve(g.cars, g.pos);
  g.onInput({ type: 'move', car: s.first[0], to: s.first[1] });
  assert.equal(g.moves, 1);
  g.onInput({ type: 'undo' });
  assert.equal(g.moves, 0);
  assert.deepEqual(g.pos, placesOf(g.cars));
  g.onInput({ type: 'move', car: s.first[0], to: s.first[1] });
  g.onInput({ type: 'restart' });
  assert.equal(g.moves, 0);
  assert.equal(g.restarts, 1);
  for (let k = 0; k < 60 && g.phase === 'play'; k++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, LEVELS[4].par * (1 + HINT_PENALTY));
  assert.equal(g.hostView().starred, false);
  g.onInput({ type: 'rematch' });
  assert.equal(g.moves, 0);
});

test('the random pack has the pars it says are right (8 to 18 moves), and the hardest start is the farthest from the way out', () => {
  for (const r of RANDOM_BOARDS) {
    const cars = parseBoard(r.rows);
    assert.equal(solve(cars, placesOf(cars)).moves, r.par);
    assert.ok(r.par >= 8 && r.par <= 18);
  }
  assert.ok(RANDOM_BOARDS.includes(makeRandom(seeded(5))));
  const cars = parseBoard(LEVELS[0].rows);
  const h = hardestFrom(cars, placesOf(cars));
  assert.ok(h.moves >= LEVELS[0].par);
  assert.equal(SIZE, 6);
  const { g } = game('random', 4);
  assert.equal(g.hostView().variant, 'Random');
});

test('levels open one by one; a random car park is open from the start', () => {
  const def = SOLO_GAMES.find((x) => x.id === 'traffic');
  const ctx = fakeCtx('Ana');
  ctx.best = () => null;
  const locked = lockedFor(ctx, def.spec).board;
  assert.match(locked[2], /Solve level 1/);
  assert.equal(locked.random, undefined);
  ctx.best = (variant) => (variant === 'Level 1' ? 3 : null);
  assert.equal(lockedFor(ctx, def.spec).board[2], undefined);
});
