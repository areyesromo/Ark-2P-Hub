import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Make24, replay, solutions, newPuzzle, TIMING } from '../server/games/make-24.js';
import { make24Bot, solve } from '../server/games/make-24-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

function setup(numbers = [8, 3, 8, 3], settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Make24(ctx, seeded(3));
  game.start();
  game.numbers = numbers;
  return { ctx, game };
}

test('sums: joining two numbers makes one; fractions are exact (8 ÷ (3 − 8 ÷ 3) = 24)', () => {
  const done = replay([8, 3, 8, 3], [[2, '/', 3], [1, '-', 2], [0, '/', 1]]);
  assert.deepEqual(done.v, [24, 1]);
  assert.equal(done.text, '8 ÷ (3 − (8 ÷ 3))');
  assert.equal(replay([1, 2, 3, 4], [[0, '/', 1], [0, '-', 0], [0, '+', 1]]), null, 'the same number twice');
  assert.equal(replay([1, 2, 3, 4], [[0, '^', 1], [0, '+', 1], [0, '+', 1]]), null);
  assert.equal(replay([0, 2, 3, 4], [[1, '/', 0], [0, '+', 1], [0, '+', 1]]), null, 'no dividing by nothing');
  assert.ok(solutions([8, 3, 8, 3]).includes('8 ÷ (3 − (8 ÷ 3))'));
  assert.deepEqual(solutions([1, 1, 1, 1]), []);
});

test('every puzzle can be made', () => {
  const rng = seeded(9);
  for (let i = 0; i < 40; i++) {
    const p = newPuzzle(rng);
    assert.equal(p.numbers.length, 4);
    assert.ok(p.numbers.every((n) => n >= 1 && n <= 9));
    assert.ok(solve(p.numbers), p.numbers.join());
  }
});

test('first to make 24 takes the round; a sum that isn\'t 24, or nonsense, does nothing', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'solve', steps: [[0, '+', 1], [0, '+', 1], [0, '+', 1]] }); // 22
  game.onInput(0, { type: 'solve', steps: 'abc' });
  game.onInput(0, { type: 'solve', steps: [[0, '+', 1]] });
  assert.equal(game.phase, 'play');
  game.onInput(1, { type: 'progress', joined: 2 });
  game.onInput(1, { type: 'progress', joined: 9 });
  assert.deepEqual(game.progress, [0, 2]);
  game.onInput(1, { type: 'solve', steps: [[2, '/', 3], [1, '-', 2], [0, '/', 1]] });
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 1, text: '8 ÷ (3 − (8 ÷ 3))', solved: true });
  assert.deepEqual(game.scores, [0, 1]);
  game.onInput(0, { type: 'solve', steps: [[2, '/', 3], [1, '-', 2], [0, '/', 1]] }); // (too late)
  assert.deepEqual(game.scores, [0, 1]);
  ctx.advance(TIMING.roundEndMs);
  assert.equal(game.round, 2);
  assert.deepEqual(game.progress, [0, 0]);
});

test('time up, or both give up: a way is shown and nobody scores; first to the rounds needed wins', () => {
  const { ctx, game } = setup([8, 3, 8, 3], { wins: 1, seconds: 60 });
  game.way = '8 ÷ (3 − (8 ÷ 3))';
  ctx.advance(60000);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: null, text: '8 ÷ (3 − (8 ÷ 3))', solved: false });
  ctx.advance(TIMING.roundEndMs);
  game.onInput(0, { type: 'skip' });
  assert.equal(game.phase, 'play');
  game.onInput(1, { type: 'skip' });
  assert.equal(game.phase, 'roundEnd');
  ctx.advance(TIMING.roundEndMs);
  const steps = solve(game.numbers);
  game.onInput(0, { type: 'solve', steps });
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'play');
  const off = setup([8, 3, 8, 3], { seconds: 0 });
  off.ctx.advance(600000);
  assert.equal(off.game.phase, 'play', 'no timer: it waits');
});

test('the computer joins its numbers one pair at a time, then makes 24', () => {
  const memory = {};
  const view = { phase: 'play', round: 1, you: 1, numbers: [8, 3, 8, 3], progress: [0, 0], skips: [false, false] };
  const first = make24Bot(view, 'hard', () => 0.5, 0, memory);
  assert.deepEqual([first.type, first.joined], ['progress', 1]);
  const last = make24Bot({ ...view, progress: [0, 2] }, 'hard', () => 0.5, 0, memory);
  assert.equal(last.type, 'solve');
  assert.deepEqual(replay(view.numbers, last.steps).v, [24, 1]);
});

test('the computer: Hard beats Easy, and Easy beats a player who does nothing', () => {
  let hard = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const flip = seed % 2;
    const { view } = play('make-24', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 3, 'Hard won ' + hard + ' of 4');
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('make-24', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
