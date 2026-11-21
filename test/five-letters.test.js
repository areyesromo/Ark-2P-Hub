import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FiveLetters, marks, allowed, POOL, TIMING, MAX_GUESSES } from '../server/games/five-letters.js';
import { fiveLettersBot } from '../server/games/five-letters-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

function setup(answer = 'crane', settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new FiveLetters(ctx, () => 0);
  game.start();
  game.answer = answer;
  return { ctx, game };
}
const guess = (game, slot, word) => game.onInput(slot, { type: 'guess', word });

test('colours: green in the right spot, yellow elsewhere in the word, a repeat only as often as the word has it', () => {
  assert.equal(marks('crane', 'crane'), 'ggggg');
  assert.equal(marks('react', 'crane'), 'yygyb');
  assert.equal(marks('eerie', 'crane'), 'bbybg', 'three e\'s guessed, one in the word: the green one counts');
  assert.equal(marks('speed', 'abide'), 'bbyby', 'two e\'s guessed, one in the word: only the first is yellow');
  assert.equal(marks('allay', 'label'), 'yyybb');
  assert.equal(marks('lolly', 'hello'), 'byggb');
  assert.ok(POOL.length > 300 && POOL.every((w) => w.length === 5));
});

test('only real words count; a made-up one comes back (the phone shakes) and costs nothing', () => {
  const { game } = setup();
  assert.ok(allowed('crane') && allowed('zebra'));
  assert.ok(!allowed('qzxvw') && !allowed('cran') && !allowed(5));
  guess(game, 0, 'qzxvw');
  assert.equal(game.boards[0].length, 0);
  assert.deepEqual(game.playerView(0).rejected, { word: 'qzxvw', n: 1 });
  for (const word of [null, 12345, 'toolong', 'ab1de']) guess(game, 0, word);
  assert.equal(game.boards[0].length, 0);
  guess(game, 0, 'SLATE'); // (any case)
  assert.equal(game.boards[0][0].word, 'slate');
});

test('the other player sees your colours, never your letters; the TV the same until the round ends', () => {
  const { game } = setup();
  guess(game, 0, 'slate');
  assert.deepEqual(game.playerView(0).boards[0], [{ word: 'slate', marks: 'bbgbg' }]);
  assert.deepEqual(game.playerView(1).boards[0], [{ word: null, marks: 'bbgbg' }]);
  assert.deepEqual(game.hostView().boards[0], [{ word: null, marks: 'bbgbg' }]);
  assert.ok(!JSON.stringify(game.hostView()).includes('crane'), 'the answer is nowhere');
  assert.ok(!JSON.stringify(game.playerView(1)).includes('slate'));
});

test('fewer guesses wins the round; it ends as soon as the other can no longer beat it', () => {
  const { ctx, game } = setup();
  guess(game, 1, 'slate');
  guess(game, 1, 'brand');
  guess(game, 0, 'crane'); // solved in one: player 2 has had two goes already
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 0, word: 'crane', guesses: [1, null] });
  assert.deepEqual(game.scores, [1, 0]);
  assert.deepEqual(game.hostView().boards[1][0], { word: 'slate', marks: 'bbgbg' }, 'every letter shows now');
  ctx.advance(TIMING.roundEndMs);
  assert.equal(game.phase, 'play');
  assert.equal(game.round, 2);
  assert.notEqual(game.answer, 'crane', 'a new word');
});

test('a round goes on while the other can still beat it, and ends the moment they can\'t', () => {
  const { game } = setup();
  guess(game, 1, 'slate');
  for (const w of ['slate', 'brand', 'crane']) guess(game, 0, w); // solved in three
  assert.equal(game.phase, 'play', 'player 2 could still do it in two');
  guess(game, 1, 'crane');
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.result, { winner: 1, word: 'crane', guesses: [3, 2] });
  // The same count: whoever got there first, so a solve ends it when the other's next guess could only tie.
  const tie = setup();
  guess(tie.game, 0, 'slate');
  guess(tie.game, 1, 'slate');
  guess(tie.game, 1, 'crane');
  assert.equal(tie.game.phase, 'roundEnd');
  assert.equal(tie.game.result.winner, 1);
});

test('six misses each, or the clock: nobody takes the round; first to the rounds needed wins', () => {
  const { ctx, game } = setup('crane', { wins: 2 });
  for (let i = 0; i < MAX_GUESSES; i++) for (const s of [0, 1]) guess(game, s, ['slate', 'pious', 'dumpy', 'fight', 'block', 'wordy'][i]);
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.result.winner, null);
  assert.deepEqual(game.scores, [0, 0]);
  ctx.advance(TIMING.roundEndMs);
  game.answer = 'crane';
  ctx.advance(TIMING.roundMs);
  assert.equal(game.phase, 'roundEnd', 'time up');
  ctx.advance(TIMING.roundEndMs);
  game.answer = 'crane';
  guess(game, 1, 'crane');
  ctx.advance(TIMING.roundEndMs);
  game.answer = 'crane';
  guess(game, 1, 'crane');
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  game.onInput(0, { type: 'rematch' });
  assert.deepEqual(game.scores, [0, 0]);
});

test('no timer: the round waits', () => {
  const { ctx, game } = setup('crane', { timer: 'off' });
  ctx.advance(TIMING.roundMs * 3);
  assert.equal(game.phase, 'play');
});

test('the computer guesses words that fit its colours, and never sees yours', () => {
  const board = [{ word: 'slate', marks: marks('slate', 'crane') }];
  for (const level of ['normal', 'hard']) {
    for (let i = 0; i < 10; i++) {
      const m = fiveLettersBot({ phase: 'play', round: 1, you: 1, done: [false, false], boards: [[], board] }, level, Math.random);
      assert.equal(marks('slate', m.word), board[0].marks, level + ' ' + m.word);
    }
  }
  assert.equal(fiveLettersBot({ phase: 'play', round: 1, you: 1, done: [false, true], boards: [[], board] }, 'hard'), null);
});

test('the computer: Hard beats Easy, and Easy beats a player who does nothing', () => {
  let hard = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const flip = seed % 2;
    const { view } = play('five-letters', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 3, 'Hard won ' + hard + ' of 4');
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('five-letters', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
