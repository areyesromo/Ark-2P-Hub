import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChineseCheckers, TIMING, HOLES, HOMES, GOALS, at, movesFrom, hasWon, stepsToGo } from '../server/games/chinese-checkers.js';
import { chineseCheckersBot } from '../server/games/chinese-checkers-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new ChineseCheckers(ctx);
  g.start();
  return { ctx, g };
}

test('the star: 121 holes, two points of 10 facing each other', () => {
  assert.equal(HOLES.length, 121);
  assert.deepEqual(HOMES.map((h) => h.length), [10, 10]);
  assert.deepEqual(GOALS[0], HOMES[1]);
  const b = new Array(121).fill(0);
  for (const s of [0, 1]) for (const c of HOMES[s]) b[c] = s + 1;
  assert.equal(stepsToGo(b, 0), stepsToGo(b, 1), 'the same race for both');
  // Every piece moved straight across into the other point: nothing left to go.
  const done = new Array(121).fill(0);
  for (const c of GOALS[0]) done[c] = 1;
  assert.equal(stepsToGo(done, 0), 0);
});

test('steps and chains of hops; nothing is taken', () => {
  const b = new Array(121).fill(0);
  const c = at(0, 0);
  b[c] = 1;
  b[at(1, 0)] = 2; // a piece to hop
  b[at(3, -1)] = 1; // and from (2, 0), another over (3, -1) to (4, -2)
  const m = movesFrom(b, c);
  assert.ok(m.includes(at(-1, 0)), 'a step');
  assert.ok(m.includes(at(2, 0)), 'a hop');
  assert.ok(m.includes(at(4, -2)), 'a chain');
  assert.ok(!m.includes(at(1, 0)), 'not onto a piece');
});

test('a full far point with yours in it wins, even with theirs left there', () => {
  const b = new Array(121).fill(0);
  GOALS[0].forEach((c, i) => { b[c] = i < 2 ? 2 : 1; }); // two of theirs never left home
  assert.equal(hasWon(b, 0), true);
  b[GOALS[0][5]] = 0;
  assert.equal(hasWon(b, 0), false);
});

test('a game: moves checked, out of time steps a piece forward', () => {
  const { ctx, g } = setup();
  assert.equal(g.turn, 0);
  const piece = HOMES[0].find((c) => movesFrom(g.board, c).length);
  g.onInput(0, { type: 'move', from: piece, to: piece }); // not a move
  g.onInput(1, { type: 'move', from: HOMES[1][0], to: 0 }); // not their turn
  g.onInput(0, { type: 'move', from: at(0, 0), to: at(1, 0) }); // no piece there
  assert.equal(g.moves, 0);
  g.onInput(0, { type: 'move', from: piece, to: movesFrom(g.board, piece)[0] });
  assert.equal(g.turn, 1);
  const before = stepsToGo(g.board, 1);
  ctx.advance(TIMING.turnMs);
  assert.equal(g.turn, 0);
  assert.equal(stepsToGo(g.board, 1), before - 1, 'one step forward');
});

test('the computer hops forward, and Easy beats a player who leaves it to the clock', () => {
  const { g } = setup();
  const v = g.playerView(0);
  const move = chineseCheckersBot(v, 'normal', seeded(1));
  assert.ok(stepsToGo(g.board, 0) > 0);
  assert.ok(HOLES[move.to][1] < HOLES[move.from][1], 'up the board');
  for (let seed = 1; seed <= 2; seed++) {
    const cpu = seed % 2;
    assert.equal(play('chinese-checkers', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
