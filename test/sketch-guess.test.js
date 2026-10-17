import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SketchGuess, ROUNDS, TIMING, LIMITS, HINT_AT, GUESS_COOLDOWN_MS, judge, normalise } from '../server/games/sketch-guess.js';
import { WORDS } from '../server/games/sketch-words.js';
import { listGames } from '../server/games/index.js';
import { fakeCtx } from './helpers.js';

function setup({ local = [false, false] } = {}) {
  const ctx = fakeCtx();
  local.forEach((l, slot) => (ctx.players[slot].local = l));
  const game = new SketchGuess(ctx);
  game.start();
  return { ctx, game };
}

/** The drawer picks the word at `index` (0 easy, 1 medium, 2 hard). */
function pick(game, index = 0) {
  game.onInput(game.drawer, { type: 'choose', index });
  return game.word;
}

test('the word bank is big, unique and only uses letters, spaces and dashes', () => {
  const all = [...WORDS.easy, ...WORDS.medium, ...WORDS.hard];
  assert.ok(all.length >= 200, `only ${all.length} words`);
  assert.equal(new Set(all).size, all.length, 'duplicate words');
  for (const w of all) assert.match(w, /^[a-z][a-z -]*[a-z]$/, w);
});

test('judging guesses: case, spacing, plurals and near misses', () => {
  assert.equal(normalise(' Palm-Tree! '), 'palmtree');
  assert.equal(judge('Giraffe', 'giraffe'), 'right');
  assert.equal(judge('palmtree', 'palm tree'), 'right');
  assert.equal(judge('grape', 'grapes'), 'right');
  assert.equal(judge('cats', 'cat'), 'right');
  assert.equal(judge('girafe', 'giraffe'), 'close');
  assert.equal(judge('elefant', 'elephant'), 'close', 'two typos allowed on long words');
  assert.equal(judge('dog', 'cat'), 'wrong');
  assert.equal(judge('cot', 'cat'), 'wrong', 'short words have to be exact');
  assert.equal(judge('', 'cat'), 'wrong');
});

test('the drawer chooses from one word of each difficulty; only the drawer sees them', () => {
  const { game } = setup();
  assert.equal(game.phase, 'choose');
  const d = game.drawer;
  const choices = game.playerView(d).choices;
  assert.deepEqual(choices.map((c) => c.level), ['easy', 'medium', 'hard']);
  assert.ok(WORDS.medium.includes(choices[1].word));
  assert.equal(game.playerView(1 - d).choices, undefined);
  assert.equal(game.hostView().word, null);
  game.onInput(1 - d, { type: 'choose', index: 0 }); // not the drawer
  assert.equal(game.phase, 'choose');
  const word = pick(game, 1);
  assert.equal(word, choices[1].word);
  assert.equal(game.phase, 'draw');
  assert.equal(game.playerView(d).word, word, 'the drawer sees the word');
  assert.equal(game.playerView(1 - d).word, null, "the guesser doesn't");
  assert.equal(game.hostView().word, null, 'nor does the TV');
  assert.equal(game.hostView().blanks.replace(/[^_]/g, '').length, word.replace(/[^a-z]/g, '').length);
});

test('choosing runs out: a random word is picked', () => {
  const { ctx, game } = setup();
  ctx.advance(TIMING.chooseMs);
  assert.equal(game.phase, 'draw');
  assert.ok(game.word);
});

test('drawing streams to the TV and the guesser in batches, with colours', () => {
  const { ctx, game } = setup();
  pick(game);
  const d = game.drawer;
  const before = ctx.updates;
  game.onInput(d, { type: 'draw', newStroke: true, color: 1, pts: [0.1, 0.1, 0.2, 0.2] });
  game.onInput(d, { type: 'draw', newStroke: false, pts: [0.3, 0.3] });
  game.onInput(d, { type: 'draw', newStroke: true, color: 99, pts: [2, -1] }); // bad colour falls back; clamped
  assert.equal(ctx.updates, before, 'not pushed per input');
  ctx.advance(100);
  assert.deepEqual(game.hostView().strokes, [{ c: 1, pts: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3] }, { c: 0, pts: [1, 0] }]);
  assert.equal(game.playerView(1 - d).strokes.length, 2, 'the guesser sees it on their phone too');
  assert.deepEqual(game.playerView(d).strokes, [], "the drawer's phone keeps its own copy");
  game.onInput(1 - d, { type: 'draw', newStroke: true, pts: [0.5, 0.5] }); // the guesser can't draw
  game.onInput(d, { type: 'undo' });
  assert.equal(game.strokes.length, 1);
  game.onInput(d, { type: 'clear' });
  assert.deepEqual(game.strokes, []);
  for (let i = 0; i < 60; i++) game.onInput(d, { type: 'draw', newStroke: false, pts: new Array(LIMITS.batch).fill(0.5) });
  assert.equal(game.points, LIMITS.points, 'point limit holds');
});

test('wrong and close guesses are listed; the right one ends the round with stars', () => {
  const { ctx, game } = setup();
  const word = pick(game, 0); // easy
  const g = game.guesser;
  game.onInput(g, { type: 'guess', text: 'definitely not it' });
  game.onInput(g, { type: 'guess', text: '   ' });
  game.onInput(game.drawer, { type: 'guess', text: word }); // the drawer can't guess
  assert.equal(game.phase, 'draw');
  assert.deepEqual(game.hostView().guesses, [{ text: 'definitely not it', close: false }]);
  ctx.advance(5000);
  game.onInput(g, { type: 'guess', text: word.toUpperCase() });
  assert.equal(game.phase, 'reveal');
  assert.equal(game.hostView().word, word, 'revealed to everyone');
  assert.equal(game.result.guessed, true);
  assert.equal(game.result.stars, 3, 'fast + easy = 3 stars');
  assert.equal(game.stars, 3);
});

test('harder and slower words: bonus stars for difficulty, fewer for time', () => {
  const { ctx, game } = setup();
  const word = pick(game, 2); // hard
  ctx.advance(TIMING.drawMs * 0.8);
  game.onInput(game.guesser, { type: 'guess', text: word });
  assert.equal(game.result.stars, 1 + 2);
});

test('hints reveal letters as time passes, but never the whole word', () => {
  const { ctx, game } = setup();
  game.choices[0].word = 'cat';
  pick(game, 0);
  const shown = () => game.hostView().blanks.replace(/_/g, '').length;
  assert.equal(shown(), 0);
  ctx.advance(TIMING.drawMs * HINT_AT[0] + 1000);
  assert.equal(shown(), 1);
  ctx.advance(TIMING.drawMs * (HINT_AT[1] - HINT_AT[0]));
  assert.equal(shown(), 2, 'two of three letters, never all three');
  ctx.advance(TIMING.drawMs * (1 - HINT_AT[1]));
  assert.equal(game.phase, 'reveal');
  assert.equal(game.result.guessed, false);
  assert.equal(game.result.stars, 0);
});

test('the drawer can skip a word', () => {
  const { game } = setup();
  pick(game);
  game.onInput(game.drawer, { type: 'skip' });
  assert.equal(game.phase, 'reveal');
  assert.equal(game.result.guessed, false);
});

test('two phones take turns drawing; the match ends after ROUNDS with a team total', () => {
  const { ctx, game } = setup();
  const drawers = [];
  for (let r = 0; r < ROUNDS; r++) {
    assert.equal(game.phase, 'choose');
    drawers.push(game.drawer);
    const word = pick(game);
    game.onInput(game.guesser, { type: 'guess', text: word });
    ctx.advance(TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.deepEqual(drawers, [0, 1, 0, 1, 0, 1]);
  assert.equal(game.stars, ROUNDS * 3);
  assert.equal(game.history.length, ROUNDS);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'choose');
  assert.equal(game.drawer, 1, 'the other player draws first next time');
  assert.equal(game.stars, 0);
});

test('a controller player always guesses, from four options with a cooldown on wrong picks', () => {
  const { ctx, game } = setup({ local: [true, false] });
  for (let r = 0; r < 3; r++) {
    assert.equal(game.drawer, 1, 'the phone player draws every round');
    pick(game);
    if (r < 2) {
      game.onInput(1, { type: 'skip' });
      ctx.advance(TIMING.revealMs);
    }
  }
  const opts = game.hostView().options;
  assert.equal(opts.length, 4);
  assert.ok(opts.includes(game.word));
  assert.equal(game.playerView(1).options.length, 4);
  const wrong = opts.findIndex((o) => o !== game.word);
  const right = opts.indexOf(game.word);
  game.onInput(0, { type: 'pick', index: wrong });
  assert.deepEqual(game.ruledOut, [wrong]);
  game.onInput(0, { type: 'pick', index: right }); // still cooling down
  assert.equal(game.phase, 'draw');
  ctx.advance(GUESS_COOLDOWN_MS);
  game.onInput(0, { type: 'pick', index: right });
  assert.equal(game.phase, 'reveal');
  assert.equal(game.result.guessed, true);
});

test('two controllers: nobody can draw in secret, so the game asks for a phone', () => {
  const { game } = setup({ local: [true, true] });
  assert.equal(game.phase, 'needPhone');
  assert.equal(game.hostView().phase, 'needPhone');
});

test('the lobby lists competitive games first, then dice & board, then casual ones', () => {
  const games = listGames();
  const cats = games.map((g) => g.category);
  assert.deepEqual([...new Set(cats)], ['competitive', 'board', 'casual']);
  assert.equal(cats.lastIndexOf('competitive') < cats.indexOf('board'), true);
  assert.equal(cats.lastIndexOf('board') < cats.indexOf('casual'), true);
  assert.equal(games.find((g) => g.id === 'sketch-guess').category, 'casual');
  assert.equal(games.find((g) => g.id === 'draw-duel').category, 'competitive');
});
