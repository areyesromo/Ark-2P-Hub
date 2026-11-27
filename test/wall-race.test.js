import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WallRace, TIMING, distance, pawnMoves, wallOk, blocked } from '../server/games/wall-race.js';
import { wallRaceBot } from '../server/games/wall-race-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new WallRace(ctx);
  g.start();
  return { ctx, g };
}

const N = 9;
const empty = () => new Array(64).fill(0);

test('walls block steps, can\'t overlap or cross, and must leave a way through', () => {
  const h = empty();
  const v = empty();
  h[3 * 8 + 4] = 1; // under squares (4, 3) and (5, 3)
  assert.equal(blocked(N, h, v, 4, 3, 0, 1), true);
  assert.equal(blocked(N, h, v, 5, 4, 0, -1), true);
  assert.equal(blocked(N, h, v, 6, 3, 0, 1), false);
  const pawns = [8 * N + 4, 4];
  const goals = [0, 8];
  assert.equal(wallOk(N, h, v, pawns, goals, 'h', 3 * 8 + 5), false, 'overlaps');
  assert.equal(wallOk(N, h, v, pawns, goals, 'v', 3 * 8 + 4), false, 'crosses');
  assert.equal(wallOk(N, h, v, pawns, goals, 'h', 3 * 8 + 6), true);
  // Boxing a pawn in isn't allowed: player 1 in the bottom-left corner, a wall over (0, 8) and (1, 8)…
  const corner = empty();
  corner[7 * 8 + 0] = 1;
  const p = [8 * N + 0, 4];
  assert.ok(distance(N, corner, v, p[0], 0) > 0);
  // …and one beside (1, 7) and (1, 8) would shut them in.
  assert.equal(wallOk(N, corner, v, p, goals, 'v', 7 * 8 + 1), false);
  assert.equal(wallOk(N, corner, v, p, goals, 'v', 6 * 8 + 1), true);
});

test('face to face: jump over, or step round when there\'s a wall behind', () => {
  const h = empty();
  const v = empty();
  const pawns = [5 * N + 4, 4 * N + 4]; // player 1 just below player 2
  assert.ok(pawnMoves(N, h, v, pawns, 0).includes(3 * N + 4), 'the jump');
  h[3 * 8 + 4] = 1; // a wall behind player 2
  const m = pawnMoves(N, h, v, pawns, 0);
  assert.ok(!m.includes(3 * N + 4));
  assert.ok(m.includes(4 * N + 3) && m.includes(4 * N + 5), 'the side steps');
});

test('a game: steps and walls checked, out of time misses the turn, the far row wins', () => {
  const { ctx, g } = setup({ size: 7 });
  assert.equal(g.turn, 0);
  g.onInput(0, { type: 'step', cell: 0 }); // not a neighbour
  g.onInput(1, { type: 'step', cell: 1 * 7 + 3 }); // not their turn
  g.onInput(0, { type: 'wall', dir: 'x', k: 0 });
  assert.equal(g.moves, 0);
  ctx.advance(TIMING.turnMs);
  assert.equal(g.turn, 1);
  assert.equal(g.lastMove.kind, 'pass');
  g.onInput(1, { type: 'wall', dir: 'h', k: 0 });
  assert.equal(g.wallsLeft[1], 7);
  // Player 1 walks straight up column 3 while player 2 steps sideways.
  for (let k = 0; k < 6 && g.phase === 'play'; k++) {
    g.onInput(0, { type: 'step', cell: g.pawns[0] - 7 });
    if (g.phase !== 'play') break;
    g.onInput(1, { type: 'step', cell: g.pawns[1] % 7 === 0 ? g.pawns[1] + 1 : g.pawns[1] - 1 });
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
});

test('the computer walls a runner who is ahead, and Easy beats a player who leaves it to the clock', () => {
  // They're one step from home, with a wall to their right: one more wall over their heads sends
  // them four steps round. That beats a step of our own.
  const walls = empty();
  walls[1] = 1; // to the right of (1, 0) and (1, 1)
  const v = { phase: 'play', turn: 1, you: 1, size: N, h: empty(), v: walls, pawns: [1 * N + 1, 4], goals: [0, 8], wallsLeft: [10, 10], round: 1, lastMove: null };
  assert.deepEqual(wallRaceBot(v, 'normal', seeded(1)).type, 'wall');
  for (let seed = 1; seed <= 2; seed++) {
    const cpu = seed % 2;
    assert.equal(play('wall-race', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
