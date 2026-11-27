/**
 * The computer for Farkle (see `bot` in index.js).
 *   easy:   sets aside every scoring die and banks by feel: wherever the mood takes it, from a
 *           couple of hundred to over a thousand, however many dice are left.
 *   normal: sets aside every scoring die, and banks by the usual table: the fewer dice left, the
 *           less it risks.
 *   hard:   knows the odds of a farkle with each number of dice and what a roll scores on average.
 *           It weighs every way to set dice aside (fewer kept can mean more dice to roll) against
 *           banking, and plays the match: rolls on in the last turn until it's ahead, and pushes
 *           harder when you're close to the finish.
 */
import { scoreOf } from './farkle.js';

const pace = (rng, ms) => ms + rng() * ms * 0.8;

// For 1 to 6 dice: the chance of a farkle, and the average best score when it isn't one (worked
// out over every roll; test/farkle.test.js checks them).
export const ODDS = [null,
  { farkle: 0.6667, avg: 75 }, { farkle: 0.4444, avg: 90 }, { farkle: 0.2778, avg: 120 },
  { farkle: 0.1574, avg: 170 }, { farkle: 0.0772, avg: 245 }, { farkle: 0.0231, avg: 435 }];

/** Every way to set dice aside that scores: { idx, points }. */
function keeps(dice) {
  const out = [];
  for (let m = 1; m < 1 << dice.length; m++) {
    const idx = [];
    for (let i = 0; i < dice.length; i++) if (m & (1 << i)) idx.push(i);
    const points = scoreOf(idx.map((i) => dice[i]));
    if (points) out.push({ idx, points });
  }
  return out;
}

/** Hard's look one roll ahead: what rolling `n` dice with `t` on the table is worth. */
const rollWorth = (t, n) => (1 - ODDS[n].farkle) * (t + ODDS[n].avg);

export function farkleBot(view, level, rng = Math.random) {
  if (!view || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const tag = view.n;
  if (view.phase === 'roll') return { type: 'roll', botDelayMs: pace(rng, 700), botFor: tag };
  if (view.phase !== 'pick') return null;
  const me = view.you;
  const options = keeps(view.dice);
  const left = (o) => view.dice.length - o.idx.length || 6; // dice left after keeping (hot dice: 6)
  const behind = view.lastTurn === me ? view.scores[1 - me] - view.scores[me] : null; // last turn: what to beat
  const move = (o, then) => ({ type: 'keep', dice: o.idx, then, botDelayMs: pace(rng, 1000), botFor: tag });
  if (level !== 'hard') {
    // Every scoring die set aside.
    const best = options.reduce((a, b) => (b.points > a.points || (b.points === a.points && b.idx.length > a.idx.length) ? b : a));
    const t = view.turnPoints + best.points;
    const n = left(best);
    if (behind !== null && t <= behind) return move(best, 'roll'); // the last turn: roll on till ahead
    const bankAt = level === 'easy' ? 150 + Math.floor(rng() * 8) * 150 : [0, 300, 300, 400, 1000, 2500, 1e9][n];
    return move(best, t >= bankAt ? 'bank' : 'roll');
  }
  // Hard: the best of keeping each option and banking or rolling on.
  const close = view.scores[1 - me] >= view.target - 1500; // they're nearly there: push on
  let best = null;
  for (const o of options) {
    const t = view.turnPoints + o.points;
    const n = left(o);
    let bank = t;
    let roll = rollWorth(t, n) * (close ? 1.15 : 1);
    if (behind !== null) {
      bank = t > behind ? 1e6 + t : -1; // banking only counts if it wins
      roll = t > behind ? 1e6 : (1 - ODDS[n].farkle) * 1000;
    } else if (view.scores[me] + t >= view.target && !close) bank += 400; // reaching the target forces their last turn
    const choice = bank >= roll ? ['bank', bank] : ['roll', roll];
    if (!best || choice[1] > best[2] || (choice[1] === best[2] && o.idx.length < best[0].idx.length)) best = [o, choice[0], choice[1]];
  }
  return move(best[0], best[1]);
}
