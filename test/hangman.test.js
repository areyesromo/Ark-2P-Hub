import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hangman, LIVES, TIMING, validWord, PICKS } from '../server/games/hangman.js';
import { hangmanBot } from '../server/games/hangman-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Hangman(ctx, seeded(2));
  game.start();
  return { ctx, game };
}
const letters = (game, slot, s) => { for (const ch of s) game.onInput(slot, { type: 'letter', letter: ch }); };

test('words: real ones of 4 to 10 letters; the hub\'s picks are everyday words', () => {
  assert.ok(validWord('garden') && validWord('zebra'));
  for (const bad of ['cat', 'qzxvwy', 'abcdefghijk', 'Hello', 7, null]) assert.ok(!validWord(bad), String(bad));
  assert.ok(PICKS.length > 300 && PICKS.every((w) => w.length >= 5 && w.length <= 8));
});

test('setting words (secret): a made-up one comes back; then both guess at once', () => {
  const { game } = setup();
  game.onInput(0, { type: 'word', word: 'qzxvwy' });
  assert.deepEqual(game.playerView(0).rejected, { word: 'qzxvwy', n: 1 });
  game.onInput(0, { type: 'word', word: 'Garden' });
  assert.equal(game.words[0], 'garden');
  assert.equal(game.playerView(0).myWord, 'garden');
  assert.ok(!JSON.stringify(game.playerView(1)).includes('garden'));
  assert.ok(!JSON.stringify(game.hostView()).includes('garden'));
  game.onInput(1, { type: 'word', word: 'zebra' });
  assert.equal(game.phase, 'guess');
  assert.deepEqual(game.playerView(0).masks[0], [null, null, null, null, null], 'player 1 guesses zebra');
  letters(game, 0, 'ex');
  assert.deepEqual(game.view(0).masks[0], [null, 'e', null, null, null]);
  assert.equal(game.view(0).misses[0], 1);
  for (const bad of ['E', 'ab', 1, 'e']) game.onInput(0, { type: 'letter', letter: bad });
  assert.equal(game.tried[0].length, 2);
});

test('reveal the whole word first and take the round; seven wrong and you\'re out; both out is level', () => {
  const { ctx, game } = setup({ wins: 1 });
  game.onInput(0, { type: 'word', word: 'garden' });
  game.onInput(1, { type: 'word', word: 'zebra' });
  letters(game, 1, 'qwxyz');
  assert.equal(game.phase, 'guess');
  letters(game, 0, 'zebr');
  assert.equal(game.phase, 'guess');
  letters(game, 0, 'a');
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.deepEqual(game.result.words, ['garden', 'zebra']);
  game.onInput(1, { type: 'rematch' });
  ctx.advance(TIMING.setMs);
  assert.equal(game.phase, 'guess', 'words picked for both');
  const theirs = game.words[1];
  const wrong = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !theirs.includes(c)).slice(0, LIVES);
  letters(game, 0, wrong.join(''));
  assert.equal(game.done[0], 'hanged');
  letters(game, 0, theirs); // (out: no more goes)
  assert.equal(game.phase, 'guess');
  const mine = game.words[0];
  letters(game, 1, 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !mine.includes(c)).slice(0, LIVES).join(''));
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.result.winner, null);
});

test('the hub can pick both words; time up, more letters found wins; no timer waits', () => {
  const { ctx, game } = setup({ words: 'hub' });
  assert.equal(game.phase, 'guess');
  assert.ok(PICKS.includes(game.words[0]) && PICKS.includes(game.words[1]));
  letters(game, 1, game.words[0].slice(0, 2));
  ctx.advance(TIMING.roundMs);
  assert.equal(game.result.winner, 1);
  const off = setup({ timer: 'off' });
  off.ctx.advance(TIMING.setMs * 3);
  assert.equal(off.game.phase, 'set');
});

test('the computer: guesses letters that fit, picks a word, never sees yours', () => {
  const view = { phase: 'guess', you: 1, round: 1, ready: [true, true], masks: [null, ['z', null, 'b', null, 'a']], tried: [[], ['z', 'b', 'a', 'x']], done: [null, null] };
  const m = hangmanBot(view, 'hard', Math.random);
  assert.equal(m.type, 'letter');
  assert.ok(['e', 'r'].includes(m.letter), m.letter);
  assert.equal(hangmanBot({ phase: 'set', you: 1, ready: [true, false] }, 'easy').type, 'word');
});

test('the computer: Normal beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let normal = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const flip = seed % 2;
    const { view } = play('hangman', flip ? ['easy', 'normal'] : ['normal', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) normal++;
  }
  assert.ok(normal >= 4, 'Normal won ' + normal + ' of 6');
  for (let seed = 1; seed <= 4; seed++) {
    const cpu = seed % 2;
    const { view } = play('hangman', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
