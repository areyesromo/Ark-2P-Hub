// The daily challenge: one game a day, the same for everyone. The date picks
// the game and its settings, and seeds its randomness, so every player gets
// the same deal (the same falling pieces, the same board, the same questions).
// One go a day; the runs of each day have their own high-score table.

import { hashSeed } from './rng.js';

/** The UTC day of a time: 'YYYY-MM-DD' (a new challenge at midnight UTC, like Word Guess's word). */
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * The games that take turns, with the settings they're played at. Games where
 * luck of the deal matters, so a shared deal makes the scores comparable.
 * (Word Guess has its own word of the day.)
 */
export const POOL = [
  { game: 'blocks-1p', settings: {} },
  { game: 'gems', settings: {} },
  { game: '2048', settings: {} },
  { game: 'minesweeper-1p', settings: { size: 'medium' } },
  { game: 'sudoku', settings: { level: 'medium' } },
  { game: 'nonogram', settings: { size: 10 } },
  { game: 'solitaire', settings: { draw: 1 } },
  { game: 'trivia-1p', settings: { category: 'mix' } },
  { game: 'memory-1p', settings: { size: 'medium' } },
  { game: 'mahjong', settings: {} },
  { game: 'freecell', settings: {} },
  { game: 'snake-1p', settings: { speed: 'normal', walls: 'solid' } },
  { game: 'slide', settings: { size: 4 } },
  { game: 'asteroids-1p', settings: {} },
  { game: 'maths', settings: {} },
  { game: 'flappy', settings: {} },
  { game: 'colours', settings: {} },
  { game: 'lights', settings: { level: 'hard' } },
  { game: 'wordsearch-1p', settings: { size: 'medium' } },
  { game: 'anagram-1p', settings: {} },
  { game: 'cave', settings: {} },
  { game: 'bubbles', settings: {} },
  { game: 'hopper', settings: {} },
  { game: 'kenken', settings: { size: 5 } },
  { game: 'numbers', settings: {} },
  { game: 'oddone', settings: {} },
  { game: 'lines', settings: {} },
  { game: 'dogpark', settings: { park: 'random9' } },
  { game: 'flood', settings: { size: 'small' } },
  { game: 'mastermind-1p', settings: { level: 'normal' } },
];

/**
 * Today's challenge: { day, game, settings, seed }. The order is a fixed shuffle
 * of the pool, so every game comes round once before any comes round again.
 */
export function challengeFor(day, pool = POOL) {
  const dayNumber = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const lap = Math.floor(dayNumber / pool.length);
  // Shuffle the pool for this lap (the same lap gives the same order).
  const order = pool.map((p, i) => ({ p, k: hashSeed(`${lap}:${i}`) })).sort((a, b) => a.k - b.k).map((x) => x.p);
  const pick = order[dayNumber - lap * pool.length];
  return { day, game: pick.game, settings: { ...pick.settings }, seed: hashSeed('ark-daily:' + day) };
}

/** The scores table a day's runs go on (a variant of that game). */
export const variantFor = (day) => 'Daily ' + day;
