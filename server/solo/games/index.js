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
// best(variant) (their best in this game) and rng (undefined: games use Math.random).
//
// soloGame() in ../adapter.js makes each one a game of this hub (see server/games/index.js).
// Games whose twin is a 2P game have "1P" after their name and id for now (Snake 1P beside
// Snake Battle): they're to be merged into one game later (docs/MERGE-1P.md).

import { withSetup } from './options.js';
import { LOOKS } from './looks.js';
import { getAchievement } from '../achievements.js';
import snake from './snake-1p.js';
import reaction from './reaction-1p.js';
import dogpark, { PARKS as DOG_PARKS, RANDOM as DOG_RANDOM, EXPERT_FROM as DOG_EXPERT } from './dogpark.js';
import { LEVELS as DOG_LEVELS } from './dogpark-levels.js';

export const SOLO_CATEGORIES = ['arcade', 'puzzle', 'brain'];

/**
 * A lock for choices opened by an achievement (the choice's `unlock` id): null once the
 * player has it, else how to get it, e.g. "Eat 10 to unlock".
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
  reaction,
];
