import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PawnRace, TIMING, HOME, ENTRY, SLIDES, movesFor, applyMove, squareOf, progressAt } from '../server/games/pawn-race.js';
import { pawnRaceBot } from '../server/games/pawn-race-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new PawnRace(ctx, seeded(4));
  g.start();
  return { ctx, g };
}

test('the cards: out of Start, forward, back, swap, bump; Home needs an exact count', () => {
  const pawns = [[0, 5, 43], [0, 0, 0]];
  assert.deepEqual(movesFor(pawns, 0, 1).map((m) => m.kind + ':' + m.to), ['out:1', 'forward:6', 'forward:44']);
  assert.deepEqual(movesFor(pawns, 0, 3).map((m) => m.to), [8], 'a 3 from 43 would overshoot Home');
  assert.deepEqual(movesFor(pawns, 0, 4).map((m) => m.to), [1], 'back 4 from 5');
  assert.deepEqual(movesFor([[2, 0, 0], [0, 0, 0]], 0, 4).map((m) => m.to), [38], 'back 4 past the entry: round to the far end');
  assert.deepEqual(movesFor(pawns, 0, 'bump'), [], 'nothing of theirs on the loop');
  const theirs = [[0, 5, 0], [10, 0, 0]];
  const bump = movesFor(theirs, 0, 'bump');
  assert.equal(bump.length, 1);
  assert.equal(squareOf(0, bump[0].to), squareOf(1, 10));
  assert.ok(movesFor(theirs, 0, 11).some((m) => m.kind === 'swap'));
});

test('landing on theirs sends it back; a slide in their colour carries you and bumps', () => {
  // Their pawn on our square 6 steps on; we land on it with a 5 from 1.
  const sq = squareOf(0, 6);
  const theirs = progressAt(1, sq);
  const r = applyMove([[1, 0, 0], [theirs, 0, 0]], 0, { pawn: 0, kind: 'forward', to: 6 });
  assert.equal(r.pawns[1][0], 0);
  // Player 1 lands on the start of a slide in player 2's colour (square 7) and slides to 10.
  const slide = SLIDES.find((x) => x.owner === 1);
  const to = progressAt(0, slide.from);
  const r2 = applyMove([[to - 2, 0, 0], [progressAt(1, slide.from + 1), 0, 0]], 0, { pawn: 0, kind: 'forward', to });
  assert.equal(squareOf(0, r2.pawns[0][0]), slide.to);
  assert.equal(r2.slid, true);
  assert.equal(r2.pawns[1][0], 0, 'bumped off the slide');
  assert.equal(ENTRY.length, 2);
});

test('a turn: play a card, draw back to three; checked input; out of time loses the turn', () => {
  const { ctx, g } = setup();
  const s = g.turn;
  assert.equal(g.hands[s].length, 3);
  g.onInput(1 - s, { type: 'move', option: 0 }); // not their turn
  g.onInput(s, { type: 'move', option: 99 });
  assert.equal(g.n, 0);
  const before = g.hands[s].slice();
  g.onInput(s, { type: 'move', option: 0 });
  assert.equal(g.hands[s].length, 3);
  assert.notDeepEqual(g.hands[s], before);
  ctx.advance(TIMING.showMs);
  ctx.advance(TIMING.moveMs);
  assert.equal(g.lastMove.missed, true);
});

test('the computer goes for a bump, and Easy beats a player who leaves it to the clock', () => {
  const { g } = setup();
  g.pawns = [[0, 0, 0], [1, 0, 0]];
  g.hands = [[3, 'bump', 5], [3, 3, 3]];
  g.turn = 0;
  g.options = g.optionsFor(0);
  const v = g.playerView(0);
  assert.equal(v.options[pawnRaceBot(v, 'normal', seeded(1)).option].kind, 'bump');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('pawn-race', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
  assert.equal(HOME, 45);
});
