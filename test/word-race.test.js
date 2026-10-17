import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WordRace, spell, solve, isWord, wordPoints, neighbours, rollGrid, TIMING, WIN_SCORE, MAX_ROUNDS, MIN_GRID_WORDS } from '../server/games/word-race.js';
import { fakeCtx } from './helpers.js';

// A fixed grid for the game tests:
//   C A T S
//   O R E Q
//   D O G X
//   Z Z Z Z
const GRID = 'CATSOREQDOGXZZZZ'.split('');
const at = (r, c) => r * 4 + c;
const PATH = {
  cat: [at(0, 0), at(0, 1), at(0, 2)],
  cats: [at(0, 0), at(0, 1), at(0, 2), at(0, 3)],
  car: [at(0, 0), at(0, 1), at(1, 1)],
  dog: [at(2, 0), at(2, 1), at(2, 2)],
  core: [at(0, 0), at(1, 0), at(1, 1), at(1, 2)],
};

function setup() {
  const ctx = fakeCtx();
  const game = new WordRace(ctx);
  game.start();
  game.grid = GRID.slice(); // a known grid instead of a random one
  return { ctx, game };
}

const toPlay = (ctx) => ctx.advance(TIMING.countdownMs);
const say = (game, slot, word) => game.onInput(slot, { type: 'word', path: PATH[word] });

test('dictionary, scoring and adjacency basics', () => {
  assert.ok(isWord('cat') && isWord('dog') && !isWord('xqzt'));
  assert.deepEqual([3, 4, 5, 6, 7, 8, 9].map((n) => wordPoints('a'.repeat(n))), [1, 1, 2, 3, 5, 11, 11]);
  assert.deepEqual(neighbours(0).sort((a, b) => a - b), [1, 4, 5], 'a corner touches 3 tiles');
  assert.equal(neighbours(5).length, 8, 'an inside tile touches 8');
});

test('spelling a traced path: touching tiles only, each tile once, Q spells "qu"', () => {
  assert.equal(spell(GRID, PATH.cat), 'cat');
  assert.equal(spell(GRID, [at(0, 0), at(0, 2)]), null, 'not touching');
  assert.equal(spell(GRID, [at(0, 0), at(0, 1), at(0, 0)]), null, 'tile used twice');
  assert.equal(spell(GRID, [at(0, 3), at(1, 3)]), 'squ');
  for (const bad of [null, 'cat', [0], [0, 99], [0, 1.5], [0, '1']]) assert.equal(spell(GRID, bad), null);
});

test('the solver finds the words a grid holds; random grids are rich enough', () => {
  const all = solve(GRID);
  for (const w of ['cat', 'cats', 'car', 'dog', 'core', 'cart']) assert.ok(all.has(w), w);
  for (const w of all) assert.ok(isWord(w) && w.length >= 3);
  const game = new WordRace(fakeCtx());
  game.start();
  assert.ok(game.possible >= MIN_GRID_WORDS, `only ${game.possible} words`);
  assert.equal(rollGrid().length, 16);
});

test('the grid stays hidden in the countdown, then words count during play', () => {
  const { ctx, game } = setup();
  assert.equal(game.hostView().grid, null);
  say(game, 0, 'cat'); // too early
  assert.deepEqual(game.words[0], []);
  toPlay(ctx);
  assert.equal(game.phase, 'play');
  assert.equal(game.hostView().grid.length, 16);
  say(game, 0, 'cat');
  assert.deepEqual(game.playerView(0).yourWords, [{ word: 'cat', points: 1 }]);
  assert.deepEqual(game.playerView(0).feedback, { word: 'cat', seq: 1, ok: true, points: 1 });
});

test('feedback for repeats, short traces and non-words; other players only see counts', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  say(game, 0, 'cat');
  say(game, 0, 'cat');
  assert.equal(game.playerView(0).feedback.reason, 'again');
  game.onInput(0, { type: 'word', path: [at(0, 0), at(0, 1)] });
  assert.equal(game.playerView(0).feedback.reason, 'short');
  game.onInput(0, { type: 'word', path: [at(2, 3), at(3, 3), at(3, 2)] }); // "xzz"
  assert.equal(game.playerView(0).feedback.reason, 'unknown');
  assert.deepEqual(game.words[0], ['cat']);
  assert.deepEqual(game.hostView().counts, [1, 0]);
  assert.equal(game.hostView().result, null, 'no words on the TV until the round ends');
  assert.equal(game.playerView(1).yourWords.length, 0);
  assert.equal(JSON.stringify(game.playerView(1)).includes('"cat"'), false, "the other phone doesn't see your words");
});

test('at the end, shared words cancel and the higher score takes the round', () => {
  const { ctx, game } = setup();
  toPlay(ctx);
  ['cat', 'cats', 'core'].forEach((w) => say(game, 0, w));
  ['cat', 'dog', 'car'].forEach((w) => say(game, 1, w));
  ctx.advance(TIMING.playMs);
  assert.equal(game.phase, 'reveal');
  const r = game.hostView().result;
  assert.deepEqual(r.tally[0].map((t) => [t.word, t.points, t.shared]), [['cat', 0, true], ['cats', 1, false], ['core', 1, false]]);
  assert.deepEqual(r.points, [2, 2]); // cats + core vs dog + car
  assert.equal(r.winner, null, '2 - 2 is a drawn round');
  assert.deepEqual(game.scores, [0, 0]);
  ctx.advance(TIMING.revealMs);
  assert.equal(game.phase, 'countdown');
  assert.equal(game.round, 2);
  assert.deepEqual(game.words, [[], []]);
});

test(`best of 3: first to ${WIN_SCORE} rounds; drawn rounds stop after ${MAX_ROUNDS}`, () => {
  const { ctx, game } = setup();
  for (let r = 0; r < WIN_SCORE; r++) {
    game.grid = GRID.slice();
    toPlay(ctx);
    say(game, 1, 'core');
    ctx.advance(TIMING.playMs);
    if (game.phase === 'reveal') ctx.advance(TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.equal(ctx.pendingTimers(), 0);

  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  for (let r = 0; r < MAX_ROUNDS; r++) {
    toPlay(ctx);
    ctx.advance(TIMING.playMs); // nobody finds anything: drawn rounds
    if (game.phase === 'reveal') ctx.advance(TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.draw, true);
});
