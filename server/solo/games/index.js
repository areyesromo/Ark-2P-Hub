// The solo games: one player chasing their own best, no computer (the 1 player mode in the
// lobby). They come from Ark 1P Hub and keep its game contract, which is simpler than this
// hub's (one player, so no slots):
//
//   { id, name, tagline, category, music?, score: { better, unit }, create(ctx) }
//
// with an instance's start(), onInput(input), hostView() and playerView(). category is
// 'arcade' (real time), 'puzzle' (think at your own pace) or 'brain' (memory and reflexes).
// score.better is 'higher' or 'lower'; score.unit says how to show a score: 'pts', 'ms', 'time'
// (a duration in ms), 'tries', 'moves' or 'm'. A run ends with phase 'over' and a score (null
// when it doesn't count); an optional variant ('Hard', 'Level 3') keeps separate bests.
//
// ctx gives a solo game: player ({ name, local }), now(), setTimeout / clearTimeout, update(),
// saved, settings (with withSetup from ./options.js), achievements() (the player's, { id: when }),
// best(variant) (their best in this game), daily ({ get(day), set(day, data) }: their go at
// the game's puzzle of the day) and rng (undefined: games use Math.random).
//
// soloGame() in ../adapter.js makes each one a game of this hub (see server/games/index.js).
// Games whose twin is a 2P game have "1P" after their name and id for now (Snake 1P beside
// Snake Battle): they're to be merged into one game later (docs/MERGE-1P.md).

import snake from './snake-1p.js';
import breaker from './breaker-1p.js';
import blocks from './blocks-1p.js';
import flappy from './flappy.js';
import asteroids from './asteroids-1p.js';
import sudoku, { LEVELS as SUDOKU_LEVELS } from './sudoku.js';
import wordGuess from './word-guess-1p.js';
import solitaire from './solitaire.js';
import invaders from './invaders.js';
import runner from './runner.js';
import slide from './slide.js';
import gems from './gems.js';
import memory, { SIZES as MEMORY_SIZES } from './memory-1p.js';
import stack from './stack-1p.js';
import sokoban from './sokoban.js';
import bubbles from './bubbles.js';
import hopper from './hopper.js';
import kenken, { SIZES as KENKEN_SIZES } from './kenken.js';
import numbers from './numbers.js';
import oddone from './oddone.js';
import hangman from './hangman-1p.js';
import lines from './lines.js';
import dogpark, { PARKS as DOG_PARKS, RANDOM as DOG_RANDOM, EXPERT_FROM as DOG_EXPERT } from './dogpark.js';
import { LEVELS as DOG_LEVELS } from './dogpark-levels.js';
import flood, { SIZES as FLOOD_SIZES } from './flood.js';
import mastermind, { LEVELS as MASTER_LEVELS } from './mastermind-1p.js';
import { LEVELS as SOKOBAN_LEVELS } from './sokoban-levels.js';
import cave, { MAPS as CAVE_MAPS, VEHICLES as CAVE_VEHICLES } from './cave.js';
import lights, { LEVELS as LIGHTS_LEVELS } from './lights.js';
import wordsearch, { SIZES as WORDSEARCH_SIZES } from './wordsearch-1p.js';
import anagram from './anagram-1p.js';
import mahjong from './mahjong.js';
import freecell from './freecell.js';
import nonogram from './nonogram.js';
import trivia from './trivia-1p.js';
import { CATEGORIES as TRIVIA_CATEGORIES } from './trivia-questions.js';
import maths from './maths.js';
import colours from './colours.js';
import game2048 from './2048.js';
import minesweeper, { SIZES as MINE_SIZES } from './minesweeper-1p.js';
import simon from './simon.js';
import reaction from './reaction-1p.js';
import { withSetup } from './options.js';
import { LOOKS } from './looks.js';
import { getAchievement } from '../achievements.js';

export const SOLO_CATEGORIES = ['arcade', 'puzzle', 'brain'];

/**
 * A lock for choices opened by an achievement (the choice's `unlock` id): null once the
 * player has it, else how to get it, e.g. "Fly 100 m to unlock".
 */
const byAchievement = (list) => (k, have) => {
  const id = list[k].unlock;
  if (!id || have[id]) return null;
  const a = getAchievement(id);
  const how = a.desc.replace(/^[^:]*: /, '').replace(/\.$/, '');
  return how.charAt(0).toUpperCase() + how.slice(1) + ' to unlock';
};

/** A setup row for a game's unlockable looks (see looks.js). */
const lookRow = (game, title) => ({ look: { title, values: Object.keys(LOOKS[game]), label: (k) => LOOKS[game][k].name, lock: byAchievement(LOOKS[game]) } });

// Setup screens for the games that have choices (see withSetup in options.js).
// The first value of each list is the default.
export const SOLO_GAMES = [
  withSetup(snake, {
    speed: { title: 'Speed', values: ['normal', 'fast'], label: (s) => (s === 'fast' ? '⚡ Fast' : 'Normal') },
    walls: { title: 'Walls', values: ['solid', 'wrap'], label: (w) => (w === 'wrap' ? '🌀 Wrap round (come out the other side)' : '🧱 Solid') },
    ...lookRow('snake-1p', 'Snake'),
  }),
  withSetup(breaker, {
    lives: { title: 'Lives', values: ['normal', 'easy'], label: (l) => (l === 'easy' ? '5 lives (easy, its own scores)' : '3 lives') },
    ...lookRow('breaker-1p', 'Ball and paddle'),
  }),
  withSetup(blocks, lookRow('blocks-1p', 'Pieces')),
  withSetup(flappy, lookRow('flappy', 'Fly as')),
  withSetup(asteroids, lookRow('asteroids-1p', 'Ship')),
  withSetup(invaders, lookRow('invaders', 'Invaders')),
  withSetup(runner, lookRow('runner', 'Run as')),
  withSetup(stack, lookRow('stack-1p', 'Blocks')),
  withSetup(cave, {
    map: { title: 'Map', values: Object.keys(CAVE_MAPS), label: (k) => CAVE_MAPS[k].name, lock: byAchievement(CAVE_MAPS) },
    vehicle: { title: 'Fly a', values: Object.keys(CAVE_VEHICLES), label: (k) => CAVE_VEHICLES[k].name, lock: byAchievement(CAVE_VEHICLES) },
  }),
  bubbles,
  hopper,
  withSetup(game2048, lookRow('2048', 'Tiles')),
  withSetup(minesweeper, {
    size: { title: 'Field', values: Object.keys(MINE_SIZES), label: (k) => `${MINE_SIZES[k].name} · ${MINE_SIZES[k].w}×${MINE_SIZES[k].h}, ${MINE_SIZES[k].mines} mines` },
  }),
  withSetup(sudoku, {
    level: { title: 'Difficulty', values: Object.keys(SUDOKU_LEVELS), label: (k) => `${SUDOKU_LEVELS[k].name} · ${SUDOKU_LEVELS[k].clues} numbers given` },
  }),
  withSetup(solitaire, {
    draw: { title: 'Turn from the stock', values: [1, 3], label: (n) => (n === 1 ? 'One card at a time' : 'Three at a time (harder, its own scores)') },
    ...lookRow('solitaire', 'Card backs'),
  }),
  withSetup(freecell, lookRow('freecell', 'Cards')),
  withSetup(mahjong, lookRow('mahjong', 'Tiles')),
  withSetup(slide, {
    size: { title: 'Size', values: [4, 3, 5], label: (n) => `${n} × ${n} (${n * n - 1} tiles${n === 3 ? ', a warm-up' : n === 5 ? ', a real test' : ''})` },
  }),
  withSetup(gems, lookRow('gems', 'Gems')),
  withSetup(mastermind, {
    level: { title: 'Code', values: Object.keys(MASTER_LEVELS), label: (k) => `${MASTER_LEVELS[k].name} · ${MASTER_LEVELS[k].pegs} pegs, ${MASTER_LEVELS[k].colours} colours` },
  }),
  withSetup(flood, {
    size: { title: 'Board', values: ['medium', 'small', 'large'], label: (k) => `${FLOOD_SIZES[k].name}${k === 'small' ? ' (a quick one)' : k === 'large' ? ' (a long one)' : ''}` },
  }),
  lines,
  withSetup(dogpark, {
    park: {
      title: 'Park',
      values: DOG_PARKS,
      label: (p) => {
        if (typeof p !== 'number') return `🎲 Random ${DOG_RANDOM[p]} × ${DOG_RANDOM[p]} (a new park every time)`;
        const n = DOG_LEVELS[p - 1].length;
        return `Level ${p} · ${n} × ${n}${p >= DOG_EXPERT ? ' · Expert' : ''}`;
      },
      // Each level opens once the one before it is solved; the random parks are open from the start.
      lock: (p, have, ctx) => (typeof p !== 'number' || p === 1 || (ctx.best && ctx.best(`Level ${p - 1}`) !== null) ? null : `Solve level ${p - 1} to unlock`),
    },
    ...lookRow('dogpark', 'Dogs'),
  }),
  withSetup(sokoban, {
    level: {
      title: 'Level',
      values: SOKOBAN_LEVELS.map((_, i) => i + 1),
      label: (n) => `${n} · par ${SOKOBAN_LEVELS[n - 1].par}`,
      // Each level opens once the one before it is solved.
      lock: (n, have, ctx) => (n === 1 || (ctx.best && ctx.best(`Level ${n - 1}`) !== null) ? null : `Solve level ${n - 1} to unlock`),
    },
  }),
  withSetup(kenken, {
    size: { title: 'Size', values: KENKEN_SIZES, label: (n) => `${n} × ${n} (numbers 1 to ${n})${n === 4 ? ', a warm-up' : n === 6 ? ', a real test' : ''}` },
  }),
  withSetup(nonogram, {
    size: { title: 'Size', values: [10, 5, 15], label: (n) => `${n} × ${n}${n === 5 ? ' (a warm-up)' : n === 15 ? ' (a long one)' : ''}` },
  }),
  withSetup(lights, {
    level: { title: 'Puzzle', values: ['medium', 'easy', 'hard'], label: (k) => `${LIGHTS_LEVELS[k].name} · par ${LIGHTS_LEVELS[k].presses}` },
  }),
  withSetup(wordsearch, {
    size: { title: 'Grid', values: ['small', 'medium', 'large'], label: (k) => `${WORDSEARCH_SIZES[k].name} · ${WORDSEARCH_SIZES[k].words} words${k === 'small' ? ', across and down' : k === 'medium' ? ', diagonals too' : ', any way, even backwards'}` },
  }),
  withSetup(wordGuess, {
    mode: { title: 'Word', values: ['daily', 'practice'], label: (m) => (m === 'daily' ? '📅 Today\'s word (the same for everyone, once a day)' : '🎲 Practice (a new word every time)') },
  }),
  withSetup(simon, lookRow('simon', 'Pads')),
  withSetup(memory, {
    size: { title: 'Cards', values: ['small', 'medium', 'large'], label: (k) => `${MEMORY_SIZES[k].w} × ${MEMORY_SIZES[k].h} (${(MEMORY_SIZES[k].w * MEMORY_SIZES[k].h) / 2} pairs)` },
    ...lookRow('memory-1p', 'Faces'),
  }),
  reaction,
  maths,
  colours,
  anagram,
  numbers,
  oddone,
  hangman,
  withSetup(trivia, {
    category: { title: 'Questions', values: ['mix', ...Object.keys(TRIVIA_CATEGORIES)], label: (c) => (c === 'mix' ? '🎲 A mix of everything' : `${TRIVIA_CATEGORIES[c]} (its own scores)`) },
  }),
];
