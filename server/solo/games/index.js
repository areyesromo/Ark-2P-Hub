// The solo games: one player chasing their own best, no computer (the 1 player mode in the
// lobby). They come from Ark 1P Hub and keep its game contract, which is simpler than this
// hub's (one player, so no slots):
//
//   { id, name, tagline, category, music?, score: { better, unit }, create(ctx) }
//
// with an instance's start(), onInput(input), hostView() and playerView(). category is
// 'arcade' (real time), 'puzzle' (think at your own pace) or 'brain' (memory and reflexes).
// score.better is 'higher' or 'lower'; score.unit says how to show a score: 'pts', 'ms', 'time'
// (a duration in ms), 'tries', 'moves', 'pegs' or 'm'. A run ends with phase 'over' and a score (null
// when it doesn't count); an optional variant ('Hard', 'Level 3') keeps separate bests.
//
// ctx gives a solo game: player ({ name, local }), now(), setTimeout / clearTimeout, update(),
// saved, settings (with withSetup from ./options.js), achievements() (the player's, { id: when }),
// best(variant) (their best in this game), daily ({ get(day), set(day, data) }: their go at
// the game's puzzle of the day) and rng (undefined: games use Math.random).
//
// soloGame() in ../adapter.js makes each one a game of this hub (see server/games/index.js).
// Games whose twin is a 2P game have "1P" after their name and id for now (Word Guess 1P beside
// Five Letters): they're to be merged into one game later (docs/MERGE-1P.md). A merged one, like
// Snake, is the 2P game's own module with a solo def (soloSnake), under the 2P game's id: see
// server/games/index.js, which plays it in either mode.

import { soloSnake as snake } from '../../games/snake.js'; // (Snake Battle's arena, one snake: a game for both modes)
import { soloBreaker as breaker } from '../../games/brick-duel-solo.js'; // (a game for both modes: Brick Breaker Duel's 1 player one)
import { soloBlocks as blocks } from '../../games/block-battle-solo.js'; // (a game for both modes: Falling Blocks Battle's 1 player one)
import flappy from './flappy.js';
import { soloAsteroids as asteroids } from '../../games/asteroid-duel-solo.js'; // (a game for both modes: Asteroid Duel's 1 player one)
import sudoku, { LEVELS as SUDOKU_LEVELS } from './sudoku.js';
import { soloFiveLetters as wordGuess } from '../../games/five-letters.js'; // (a game for both modes)
import solitaire from './solitaire.js';
import invaders from './invaders.js';
import runner from './runner.js';
import slide from './slide.js';
import gems from './gems.js';
import { soloMemory as memory, SIZES as MEMORY_SIZES } from '../../games/memory-match.js'; // (a game for both modes)
import { soloStack as stack } from '../../games/tower-stack-solo.js'; // (a game for both modes: Tower Stack's 1 player one)
import sokoban from './sokoban.js';
import bubbles from './bubbles.js';
import hopper from './hopper.js';
import kenken, { SIZES as KENKEN_SIZES } from './kenken.js';
import numbers from './numbers.js';
import oddone from './oddone.js';
import { soloHangman as hangman } from '../../games/hangman.js'; // (a game for both modes)
import lines from './lines.js';
import dogpark, { PARKS as DOG_PARKS, RANDOM as DOG_RANDOM, EXPERT_FROM as DOG_EXPERT } from './dogpark.js';
import { LEVELS as DOG_LEVELS } from './dogpark-levels.js';
import tango, { BOARDS as TANGO_BOARDS, RANDOM as TANGO_RANDOM } from './tango.js';
import { LEVELS as TANGO_LEVELS } from './tango-levels.js';
import zip, { BOARDS as ZIP_BOARDS, RANDOM as ZIP_RANDOM } from './zip.js';
import { LEVELS as ZIP_LEVELS } from './zip-levels.js';
import traffic, { BOARDS as TRAFFIC_BOARDS } from './traffic.js';
import { LEVELS as TRAFFIC_LEVELS } from './traffic-levels.js';
import pipes, { SIZES as PIPE_SIZES } from './pipes.js';
import futoshiki, { SIZES as FUTOSHIKI_SIZES } from './futoshiki.js';
import peg, { BOARDS as PEG_BOARDS, ORDER as PEG_ORDER } from './peg.js';
import hashi, { BOARDS as HASHI_BOARDS, RANDOM as HASHI_RANDOM } from './hashi.js';
import { LEVELS as HASHI_LEVELS } from './hashi-levels.js';
import flood, { SIZES as FLOOD_SIZES } from './flood.js';
import { soloMastermind as mastermind, LEVELS as MASTER_LEVELS } from '../../games/code-breaker-solo.js'; // (a game for both modes: Code Breaker's 1 player one)
import { LEVELS as SOKOBAN_LEVELS } from './sokoban-levels.js';
import cave, { MAPS as CAVE_MAPS, VEHICLES as CAVE_VEHICLES } from './cave.js';
import lights, { LEVELS as LIGHTS_LEVELS } from './lights.js';
import { soloWordSearch as wordsearch, SIZES as WORDSEARCH_SIZES } from '../../games/word-hunt.js'; // (a game for both modes)
import { soloAnagram as anagram } from '../../games/anagram-duel.js'; // (a game for both modes)
import mahjong from './mahjong.js';
import freecell from './freecell.js';
import nonogram from './nonogram.js';
import { soloTrivia as trivia, TOPICS as TRIVIA_TOPICS } from '../../games/quiz.js'; // (a game for both modes)
import maths from './maths.js';
import colours from './colours.js';
import game2048 from './2048.js';
import { soloMinesweeper as minesweeper, SIZES as MINE_SIZES } from '../../games/mine-duel.js'; // (a game for both modes)
import simon from './simon.js';
import { soloReaction as reaction } from '../../games/reaction-duel.js'; // (a game for both modes)
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
    ...lookRow('snake', 'Snake'),
  }),
  withSetup(breaker, {
    lives: { title: 'Lives', values: ['normal', 'easy'], label: (l) => (l === 'easy' ? '5 lives (easy, its own scores)' : '3 lives') },
    ...lookRow('brick-duel', 'Ball and paddle'),
  }),
  withSetup(blocks, lookRow('block-battle', 'Pieces')),
  withSetup(flappy, lookRow('flappy', 'Fly as')),
  withSetup(asteroids, lookRow('asteroid-duel', 'Ship')),
  withSetup(invaders, lookRow('invaders', 'Invaders')),
  withSetup(runner, lookRow('runner', 'Run as')),
  withSetup(stack, lookRow('tower-stack', 'Blocks')),
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
  withSetup(tango, {
    board: {
      title: 'Board',
      values: TANGO_BOARDS,
      label: (b) => {
        if (typeof b !== 'number') return `🎲 Random ${TANGO_RANDOM[b]} × ${TANGO_RANDOM[b]} (a new board every time)`;
        const n = TANGO_LEVELS[b - 1].rows.length;
        return `Level ${b} · ${n} × ${n}`;
      },
      // Each level opens once the one before it is solved; the random boards are open from the start.
      lock: (b, have, ctx) => (typeof b !== 'number' || b === 1 || (ctx.best && ctx.best(`Level ${b - 1}`) !== null) ? null : `Solve level ${b - 1} to unlock`),
    },
    ...lookRow('tango', 'Pieces'),
  }),
  withSetup(zip, {
    board: {
      title: 'Board',
      values: ZIP_BOARDS,
      label: (b) => {
        if (typeof b !== 'number') return `🎲 Random ${ZIP_RANDOM[b]} × ${ZIP_RANDOM[b]} (a new board every time)`;
        const l = ZIP_LEVELS[b - 1];
        return `Level ${b} · ${l.n} × ${l.n}${l.walls ? ' · walls' : ''}`;
      },
      // Each level opens once the one before it is solved; the random boards are open from the start.
      lock: (b, have, ctx) => (typeof b !== 'number' || b === 1 || (ctx.best && ctx.best(`Level ${b - 1}`) !== null) ? null : `Solve level ${b - 1} to unlock`),
    },
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
  withSetup(traffic, {
    board: {
      title: 'Car park',
      values: TRAFFIC_BOARDS,
      label: (b) => (typeof b !== 'number' ? '🎲 Random (a new car park every time, its own scores)' : `Level ${b} · par ${TRAFFIC_LEVELS[b - 1].par}`),
      // Each level opens once the one before it is solved; a random car park is open from the start.
      lock: (b, have, ctx) => (typeof b !== 'number' || b === 1 || (ctx.best && ctx.best(`Level ${b - 1}`) !== null) ? null : `Solve level ${b - 1} to unlock`),
    },
  }),
  withSetup(pipes, {
    size: { title: 'Size', values: PIPE_SIZES, label: (n) => `${n} × ${n}${n === 5 ? ' (a warm-up)' : n === 9 ? ' (a long one)' : ''}` },
    edges: { title: 'Edges', values: ['solid', 'wrap'], label: (k) => (k === 'wrap' ? '🌀 Wrap round (pipes can run off one edge and on at the other; its own scores)' : '🧱 Solid') },
  }),
  withSetup(kenken, {
    size: { title: 'Size', values: KENKEN_SIZES, label: (n) => `${n} × ${n} (numbers 1 to ${n})${n === 4 ? ', a warm-up' : n === 6 ? ', a real test' : ''}` },
  }),
  withSetup(futoshiki, {
    size: { title: 'Size', values: FUTOSHIKI_SIZES, label: (n) => `${n} × ${n} (numbers 1 to ${n})${n === 4 ? ', a warm-up' : n === 7 ? ', a real test' : ''}` },
  }),
  withSetup(peg, {
    board: { title: 'Board', values: PEG_ORDER, label: (k) => PEG_BOARDS[k].name },
  }),
  withSetup(hashi, {
    board: {
      title: 'Board',
      values: HASHI_BOARDS,
      label: (b) => {
        if (typeof b !== 'number') return `🎲 Random ${HASHI_RANDOM[b][0]} × ${HASHI_RANDOM[b][0]} (a new board every time)`;
        const rows = HASHI_LEVELS[b - 1];
        return `Level ${b} · ${rows.length} × ${rows.length} · ${rows.join('').replace(/\./g, '').length} islands`;
      },
      // Each level opens once the one before it is solved; the random boards are open from the start.
      lock: (b, have, ctx) => (typeof b !== 'number' || b === 1 || (ctx.best && ctx.best(`Level ${b - 1}`) !== null) ? null : `Solve level ${b - 1} to unlock`),
    },
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
    ...lookRow('memory-match', 'Faces'),
  }),
  reaction,
  maths,
  colours,
  anagram,
  numbers,
  oddone,
  hangman,
  withSetup(trivia, {
    topic: { title: 'Questions', values: TRIVIA_TOPICS.map((_, i) => i).concat(TRIVIA_TOPICS.length), label: (n) => (n === 0 ? '🎲 A mix of everything' : `${TRIVIA_TOPICS[n - 1]} (its own scores)`) },
  }),
];
