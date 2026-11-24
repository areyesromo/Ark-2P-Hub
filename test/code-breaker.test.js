import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodeBreaker, score, validCode, allCodes, TIMING, MAX_GUESSES } from '../server/games/code-breaker.js';
import { codeBreakerBot } from '../server/games/code-breaker-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new CodeBreaker(ctx, seeded(1));
  game.start();
  return { ctx, game };
}

test('codes: four different digits; bulls and cows', () => {
  assert.ok(validCode('0123'));
  for (const bad of ['1123', '123', '12345', 'abcd', 1234, null]) assert.ok(!validCode(bad), String(bad));
  assert.equal(allCodes().length, 5040);
  assert.deepEqual(score('1234', '1234'), { bulls: 4, cows: 0 });
  assert.deepEqual(score('1243', '1234'), { bulls: 2, cows: 2 });
  assert.deepEqual(score('5678', '1234'), { bulls: 0, cows: 0 });
  assert.deepEqual(score('4120', '1234'), { bulls: 0, cows: 3 });
});

test('setting the codes (secret), then taking turns to guess', () => {
  const { game } = setup();
  game.onInput(0, { type: 'code', code: '1123' }); // not a code
  game.onInput(0, { type: 'code', code: '1234' });
  game.onInput(0, { type: 'code', code: '5678' }); // (already set)
  assert.equal(game.codes[0], '1234');
  assert.equal(game.playerView(0).code, '1234');
  assert.equal(game.playerView(1).code, null);
  assert.ok(!JSON.stringify(game.hostView()).includes('1234'));
  assert.ok(!JSON.stringify(game.playerView(1)).includes('1234'));
  game.onInput(1, { type: 'code', code: '9876' });
  assert.equal(game.phase, 'guess');
  const s = game.turn;
  game.onInput(1 - s, { type: 'guess', guess: '0123' }); // not their turn
  game.onInput(s, { type: 'guess', guess: '0123' });
  assert.equal(game.guesses[s].length, 1);
  assert.equal(game.turn, 1 - s);
});

test('cracking it: the second player still gets the same go; both on the same go is level', () => {
  const { game } = setup({ wins: 1 });
  game.onInput(0, { type: 'code', code: '1234' });
  game.onInput(1, { type: 'code', code: '5678' });
  const s = game.turn;
  const theirs = game.codes[1 - s];
  game.onInput(s, { type: 'guess', guess: theirs });
  assert.equal(game.phase, 'guess', 'the other gets their go');
  game.onInput(1 - s, { type: 'guess', guess: game.codes[s] });
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.result.winner, null);
  assert.equal(game.result.both, true);
  assert.deepEqual(game.result.codes, ['1234', '5678']);
  assert.deepEqual(game.scores, [0, 0]);
});

test('the first to crack it takes the round; first to the rounds needed; ten goes each at most', () => {
  const { ctx, game } = setup({ wins: 1 });
  game.onInput(0, { type: 'code', code: '1234' });
  game.onInput(1, { type: 'code', code: '5678' });
  const s = game.turn;
  game.onInput(s, { type: 'guess', guess: game.codes[1 - s] });
  game.onInput(1 - s, { type: 'guess', guess: '9012' === game.codes[s] ? '9013' : '9012' });
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, s);
  game.onInput(0, { type: 'rematch' });
  ctx.advance(TIMING.setMs); // both codes picked for them
  assert.equal(game.phase, 'guess');
  for (let i = 0; i < MAX_GUESSES * 2; i++) {
    const t = game.turn;
    const wrong = allCodes().find((c) => c !== game.codes[1 - t] && !game.guesses[t].some((g) => g.guess === c));
    game.onInput(t, { type: 'guess', guess: wrong });
  }
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.result.winner, null);
});

test('out of time: a code is picked for you, a guess made; no timer waits', () => {
  const { ctx, game } = setup();
  ctx.advance(TIMING.setMs);
  assert.ok(validCode(game.codes[0]) && validCode(game.codes[1]));
  ctx.advance(TIMING.guessMs);
  assert.equal(game.guesses[game.starter].length, 1);
  const off = setup({ timer: 'off' });
  off.ctx.advance(TIMING.setMs * 3);
  assert.equal(off.game.phase, 'set');
});

test('the computer guesses codes that fit what it has been told (Hard may also probe with one that can\'t be it)', () => {
  const guesses = [{ guess: '0123', ...score('0123', '4567') }, { guess: '4560', ...score('4560', '4567') }];
  assert.ok(validCode(codeBreakerBot({ phase: 'guess', you: 0, turn: 0, round: 1, ready: [true, true], guesses: [guesses, []] }, 'hard', Math.random).guess));
  for (const level of ['normal']) {
    for (let i = 0; i < 5; i++) {
      const m = codeBreakerBot({ phase: 'guess', you: 0, turn: 0, round: 1, ready: [true, true], guesses: [guesses, []] }, level, Math.random);
      for (const g of guesses) assert.deepEqual(score(g.guess, m.guess), { bulls: g.bulls, cows: g.cows }, level + ' ' + m.guess);
    }
  }
  assert.equal(codeBreakerBot({ phase: 'set', you: 1, ready: [false, false] }, 'easy').type, 'code');
});

test('the computer: Normal beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let normal = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const flip = seed % 2;
    const { view } = play('code-breaker', flip ? ['easy', 'normal'] : ['normal', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) normal++;
  }
  assert.ok(normal >= 4, 'Normal won ' + normal + ' of 6');
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('code-breaker', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
