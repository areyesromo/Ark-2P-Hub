/**
 * The computer for Snakes & Ladders (see `bot` in index.js). The choice each turn is which die to
 * move by.
 *   easy:   mostly the bigger die (snakes or not), now and then either.
 *   normal: the bigger die, unless that lands on a snake (it doesn't go out of its way for ladders).
 *   hard:   knows, for every square, how many turns it takes on average to finish from there
 *           (worked out exactly, choosing well every turn), and takes the die that leaves the
 *           fewest: it will stop short of a snake, or line up a ladder for next time. It weighs a
 *           bump too: knocking you back can be worth more than a few squares of its own.
 */
import { landing, BUMP, SNAKES } from './snakes-ladders.js';

const pace = (rng) => 900 + rng() * 1200;

// TURNS[p]: the average number of turns to finish from square p, choosing the better die every
// time. Found by repeating the sum until it settles (bouncing off 100 makes it loop on itself).
const TURNS = new Array(101).fill(0);
for (let k = 0; k < 400; k++) {
  for (let p = 99; p >= 0; p--) {
    let sum = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) sum += Math.min(TURNS[landing(p, a)], TURNS[landing(p, b)]);
    TURNS[p] = 1 + sum / 36;
  }
}
export { TURNS };

export function snakesLaddersBot(view, level, rng = Math.random) {
  if (!view || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const tag = view.round + ':' + view.n;
  if (view.phase === 'roll') return { type: 'roll', botDelayMs: pace(rng), botFor: tag };
  if (view.phase !== 'choose') return null;
  const [a, b] = view.dice;
  const [ta, tb] = view.options;
  let die;
  if (level === 'easy') die = rng() < 0.25 ? (rng() < 0.5 ? 0 : 1) : a >= b ? 0 : 1;
  else if (level === 'normal') {
    const big = a >= b ? 0 : 1;
    const from = view.pos[view.you];
    const snake = (d) => SNAKES[Math.min(from + view.dice[d], 200 - from - view.dice[d])] !== undefined;
    die = snake(big) && !snake(1 - big) ? 1 - big : big;
  }
  else {
    // Turns it saves, plus the turns a bump costs you.
    const them = view.pos[1 - view.you];
    const worth = (t) => -TURNS[t] + (t === them && t > 0 && t < 100 ? TURNS[Math.max(0, them - BUMP)] - TURNS[them] : 0);
    die = worth(ta) >= worth(tb) ? 0 : 1;
  }
  return { type: 'move', die, botDelayMs: pace(rng), botFor: tag };
}
