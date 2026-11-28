import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HiddenRanks, TIMING, N, ARMY, fight, targets } from '../server/games/hidden-ranks.js';
import { hiddenRanksBot } from '../server/games/hidden-ranks-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new HiddenRanks(ctx, seeded(3));
  g.start();
  return { ctx, g };
}

test('fights: higher wins, equal both go, the spy takes the 10 attacking, miners clear bombs', () => {
  assert.equal(fight(9, 7), 'a');
  assert.equal(fight(4, 6), 'd');
  assert.equal(fight(5, 5), 'both');
  assert.equal(fight(1, 10), 'a');
  assert.equal(fight(10, 1), 'a');
  assert.equal(fight(10, 'B'), 'd');
  assert.equal(fight(3, 'B'), 'a');
  assert.equal(fight(2, 'F'), 'a');
});

test('moves: one step, scouts run, never into a lake or onto your own; bombs and flags stay', () => {
  const board = new Array(N * N).fill(null);
  board[5 * N + 0] = { s: 0, rank: 2 };
  const run = targets(board, 5 * N + 0);
  assert.ok(run.includes(0) && run.includes(7 * N + 0), 'a scout runs the whole column');
  board[5 * N + 3] = { s: 0, rank: 7 };
  board[4 * N + 3] = { s: 1, rank: 9 };
  assert.deepEqual(targets(board, 5 * N + 3).sort((a, b) => a - b), [4 * N + 3, 5 * N + 2, 5 * N + 4, 6 * N + 3].sort((a, b) => a - b));
  board[6 * N + 1] = { s: 0, rank: 'B' };
  assert.deepEqual(targets(board, 6 * N + 1), []);
  board[5 * N + 1] = { s: 0, rank: 6 };
  assert.ok(!targets(board, 5 * N + 1).includes(4 * N + 1), 'the lake');
});

test('setting out in secret, then hidden ranks until a fight shows them', () => {
  const { g } = setup();
  assert.equal(g.phase, 'deploy');
  assert.equal(g.playerView(0).setup.length, ARMY.length);
  assert.equal(g.hostView().setup, null);
  g.onInput(0, { type: 'arrange', ranks: [10, 10, 9, 7, 6, 5, 4, 3, 3, 2, 2, 2, 1, 'B', 'B', 'F'] }); // not the army
  g.onInput(0, { type: 'swap', a: 0, b: 15 });
  g.onInput(0, { type: 'ready' });
  g.onInput(1, { type: 'ready' });
  assert.equal(g.phase, 'play');
  const v = g.playerView(0);
  assert.ok(v.board.every((p) => !p || p.s === 0 || p.rank === null), 'their ranks are hidden');
  assert.ok(g.hostView().board.every((p) => !p || p.rank === null), 'and from the TV');
});

test('out of time: setting out goes as it stands, a move is missed; the computer, and Easy beats an idle player', () => {
  const { ctx, g } = setup();
  ctx.advance(TIMING.setupMs);
  assert.equal(g.phase, 'play');
  const s = g.turn;
  ctx.advance(TIMING.turnMs);
  assert.equal(g.lastMove.missed, true);
  assert.equal(g.turn, 1 - s);
  const v = g.playerView(g.turn);
  const m = hiddenRanksBot(v, 'hard', seeded(2));
  assert.ok(v.moves.some(([a, b]) => a === m.from && b === m.to));
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('hidden-ranks', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
