import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Backgammon, TIMING, startBoard, pips, legalMoves, singleMoves, applyMove } from '../server/games/backgammon.js';
import { backgammonBot } from '../server/games/backgammon-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

const empty = () => ({ points: new Array(24).fill(0), bar: [0, 0], off: [0, 0] });

/** A game past its opening roll, player 1 to move with these dice. */
function setup(settings, dice = [3, 1]) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Backgammon(ctx, seeded(5));
  game.start();
  ctx.advance(TIMING.openingMs);
  game.turn = 0;
  game.startMoving(dice);
  return { ctx, game };
}

test('the start: 15 checkers each, 167 pips each', () => {
  const st = { points: startBoard(), bar: [0, 0], off: [0, 0] };
  assert.equal(st.points.filter((v) => v > 0).reduce((a, b) => a + b, 0), 15);
  assert.equal(-st.points.filter((v) => v < 0).reduce((a, b) => a + b, 0), 15);
  assert.deepEqual([pips(st, 0), pips(st, 1)], [167, 167]);
});

test('no landing on two or more; a lone checker is hit to the bar, and comes back in first', () => {
  const st = empty();
  st.points[10] = 1;
  st.points[7] = -2; // blocked
  st.points[8] = -1; // a blot
  assert.deepEqual(singleMoves(st, 0, 3).map((m) => m.to), []);
  const hit = applyMove(st, 0, { from: 10, to: 8, die: 2 });
  assert.equal(hit.points[8], 1);
  assert.deepEqual(hit.bar, [0, 1]);
  // On the bar: only entering counts (player 2 comes in on 0..5).
  assert.deepEqual(singleMoves(hit, 1, 3), [{ from: 'bar', to: 2, die: 3 }]);
  hit.points[2] = 2;
  assert.deepEqual(singleMoves(hit, 1, 3), [], 'blocked: no move at all');
});

test('bearing off: only with everyone home; a bigger die takes the furthest checker', () => {
  const st = empty();
  st.points[3] = 1;
  st.points[1] = 1;
  assert.deepEqual(singleMoves(st, 0, 4).filter((m) => m.to === 'off').map((m) => m.from), [3], 'exact');
  assert.deepEqual(singleMoves(st, 0, 6).filter((m) => m.to === 'off').map((m) => m.from), [3], 'bigger: the furthest only');
  st.points[9] = 1;
  assert.equal(singleMoves(st, 0, 4).filter((m) => m.to === 'off').length, 0, 'not all home');
});

test('you must use both dice if you can, or the bigger one', () => {
  const st = empty();
  st.points[10] = 1;
  st.points[4] = -2; // 10 - 6: blocked
  st.points[3] = -2; // 10 - 1 - 6: blocked
  st.points[8] = -2; // 10 - 1 - 1 ... (only a 1 and a 6)
  // With 6-1: 10-1=9, then 9-6=3 blocked; 10-6=4 blocked: only one die, and it's the 1 here.
  assert.deepEqual(legalMoves(st, 0, [6, 1]).map((m) => [m.from, m.to]), [[10, 9]]);
  const st2 = empty();
  st2.points[20] = 1;
  st2.points[13] = -2; // 20-6-1: blocked both ways... 20-1=19, 19-6=13 blocked; 20-6=14, 14-1=13 blocked
  assert.deepEqual(legalMoves(st2, 0, [6, 1]).map((m) => m.die), [6], 'only one fits: the bigger');
});

test('a turn: moves, undo, done; the other then rolls', () => {
  const { game } = setup();
  const before = game.st.points.slice();
  game.onInput(1, { type: 'move', from: 7, to: 4 }); // not their turn
  game.onInput(0, { type: 'move', from: 7, to: 2 }); // no die for that
  game.onInput(0, { type: 'move', from: 'x', to: 4 });
  assert.deepEqual(game.st.points, before);
  game.onInput(0, { type: 'move', from: 7, to: 4 });
  game.onInput(0, { type: 'move', from: 5, to: 4 });
  assert.equal(game.st.points[4], 2, 'made the 5-point');
  assert.equal(game.view().canDone, true);
  game.onInput(0, { type: 'undo' });
  assert.deepEqual(game.st.points, before);
  game.onInput(0, { type: 'move', from: 7, to: 4 });
  game.onInput(0, { type: 'move', from: 5, to: 4 });
  game.onInput(0, { type: 'done' });
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 'roll');
  game.onInput(1, { type: 'roll' });
  assert.equal(game.phase, 'move');
  assert.equal(game.rolled.length, 2);
});

test('the cube: a double is taken (the stakes go up, the taker owns it) or dropped (the game is lost)', () => {
  const { game } = setup({ points: 3 });
  game.onInput(0, { type: 'move', from: 7, to: 4 });
  game.onInput(0, { type: 'move', from: 5, to: 4 });
  game.onInput(0, { type: 'done' });
  assert.equal(game.view().canDouble, true);
  game.onInput(1, { type: 'double' });
  assert.equal(game.phase, 'offer');
  game.onInput(1, { type: 'take' }); // (not theirs to answer)
  game.onInput(0, { type: 'take' });
  assert.deepEqual(game.cube, { value: 2, owner: 0 });
  assert.equal(game.view().canDouble, false, 'player 2 no longer owns it');
  game.turn = 0;
  game.startRoll();
  game.onInput(0, { type: 'double' });
  game.onInput(1, { type: 'drop' });
  assert.deepEqual(game.result, { winner: 0, kind: 'drop', points: 2 });
  assert.deepEqual(game.scores, [2, 0]);
});

test('bearing everything off wins: a gammon when the other has borne none off; first to the match points', () => {
  const { ctx, game } = setup({ points: 3 }, [6, 5]);
  game.st = empty();
  game.st.points[0] = 1;
  game.st.off = [14, 0];
  game.st.points[20] = -15;
  game.legal = legalMoves(game.st, 0, game.dice);
  game.onInput(0, { type: 'move', from: 0, to: 'off' });
  assert.equal(game.phase, 'gameEnd');
  assert.deepEqual(game.result, { winner: 0, kind: 'gammon', points: 2 });
  ctx.advance(TIMING.gameEndMs);
  assert.equal(game.phase, 'opening');
  game.st = empty();
  ctx.advance(TIMING.openingMs);
  game.turn = 1;
  game.st = empty();
  game.st.points[23] = -1;
  game.st.off = [3, 14];
  game.startMoving([2, 1]);
  game.onInput(1, { type: 'move', from: 23, to: 'off' });
  assert.equal(game.result.kind, 'single');
  assert.deepEqual(game.scores, [2, 1]);
  assert.equal(game.phase, 'gameEnd');
  game.scores = [2, 2];
  game.endGame(0);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
});

test('the clock rolls and plays for you; with no timer it waits; one game has no cube', () => {
  const { ctx, game } = setup();
  ctx.advance(TIMING.moveMs);
  assert.equal(game.turn, 1);
  ctx.advance(TIMING.rollMs);
  assert.equal(game.phase === 'move' || game.phase === 'noMove', true);
  const off = setup({ timer: 'off' });
  off.ctx.advance(TIMING.moveMs * 3);
  assert.equal(off.game.turn, 0);
  assert.equal(setup({ points: 1 }).game.cubeOn, false);
});

test('the computer only plays legal moves, and finishes its turn', () => {
  const { game } = setup();
  for (const level of ['easy', 'normal', 'hard']) {
    const m = backgammonBot(game.playerView(0), level, Math.random, 0, {});
    assert.equal(m.type, 'move');
    assert.ok(game.legal.some((x) => x.from === m.from && x.to === m.to), level);
  }
  game.onInput(0, { type: 'move', from: 7, to: 4 });
  game.onInput(0, { type: 'move', from: 5, to: 4 });
  assert.equal(backgammonBot(game.playerView(0), 'hard', Math.random, 0, {}).type, 'done');
  assert.equal(backgammonBot(game.playerView(1), 'hard', Math.random, 0, {}), null);
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let hard = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const flip = seed % 2;
    const { view } = play('backgammon', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed, settings: { points: 1 } });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 5, 'Hard won ' + hard + ' of 6');
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('backgammon', cpu ? [null, 'easy'] : ['easy', null], { seed, settings: { points: 1 }, limitMs: 3 * 3600 * 1000 });
    assert.equal(view.winner, cpu, 'seed ' + seed);
  }
});
