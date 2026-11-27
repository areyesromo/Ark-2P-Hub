/**
 * The computer for Shut the Box (see `bot` in index.js).
 *   easy:   shuts any tiles that add up, and always rolls both dice.
 *   normal: the old rule of thumb: shut the biggest tile it can (in as few tiles as it can), and
 *           roll one die whenever it may.
 *   hard:   plays perfectly. It works out, for every way the box could stand, the best choice and
 *           what it's worth. Going first it aims for the lowest score on average; going second it
 *           aims to beat (or at least tie) the score it was set.
 */
import { maskSum, waysToShut, oneDieOk } from './shut-the-box.js';

const pace = (rng, ms) => ms + rng() * ms * 0.8;

// The chance of each total, with two dice and with one.
const TWO = new Map();
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) TWO.set(a + b, (TWO.get(a + b) || 0) + 1 / 36);
const ONE = new Map([1, 2, 3, 4, 5, 6].map((r) => [r, 1 / 6]));

/**
 * The best play for every box state, for a goal: `score(final)` is what a finished box is worth
 * (higher is better). Returns { value(open) before rolling, dice(open): 1 or 2, pick(open, roll) }.
 */
export function plan(score) {
  const memo = new Map();
  const afterRoll = (open, roll) => {
    let best = null;
    for (const m of waysToShut(open, roll)) {
      const v = value(open & ~m);
      if (!best || v > best[0]) best = [v, m];
    }
    return best; // null: stuck
  };
  const byDice = (open, dist) => {
    let v = 0;
    for (const [roll, p] of dist) {
      const b = afterRoll(open, roll);
      v += p * (b ? b[0] : score(maskSum(open)));
    }
    return v;
  };
  function value(open) {
    if (!open) return score(0);
    if (memo.has(open)) return memo.get(open);
    let v = byDice(open, TWO);
    if (oneDieOk(open)) v = Math.max(v, byDice(open, ONE));
    memo.set(open, v);
    return v;
  }
  return {
    value,
    dice: (open) => (oneDieOk(open) && byDice(open, ONE) > byDice(open, TWO) ? 1 : 2),
    pick: (open, roll) => (afterRoll(open, roll) || [0, 0])[1],
  };
}

// Hard's plans, worked out once: the lowest average score, and for each score to beat.
const PLANS = new Map();
function planFor(key, score) {
  if (!PLANS.has(key)) PLANS.set(key, plan(score));
  return PLANS.get(key);
}

const toMask = (list) => list.reduce((m, n) => m | (1 << (n - 1)), 0);
const toTiles = (mask) => {
  const out = [];
  for (let n = 1; mask; n++, mask >>= 1) if (mask & 1) out.push(n);
  return out;
};

export function shutTheBoxBot(view, level, rng = Math.random) {
  if (!view || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const open = toMask(view.open[me]);
  const tag = view.round + ':' + view.n;
  let p = null;
  if (level === 'hard') {
    const target = view.scores[1 - me];
    p = target === null
      ? planFor('avg', (s) => -s)
      : planFor('beat' + target, (s) => (s < target ? 1 : s === target ? 0.5 : 0) - s * 1e-4); // (tie-break: lower is better)
  }
  if (view.phase === 'roll') {
    let dice = 2;
    if (view.oneDie && level === 'normal') dice = 1;
    if (view.oneDie && p) dice = p.dice(open);
    return { type: 'roll', dice, botDelayMs: pace(rng, 700), botFor: tag };
  }
  if (view.phase !== 'shut') return null;
  const ways = waysToShut(open, view.total);
  if (!ways.length) return null;
  let pick;
  if (level === 'easy') pick = ways[Math.floor(rng() * ways.length)];
  else if (level === 'normal') {
    // The biggest tile it can shut, then the fewest tiles.
    const top = (m) => 31 - Math.clz32(m);
    const count = (m) => toTiles(m).length;
    pick = ways.slice().sort((a, b) => top(b) - top(a) || count(a) - count(b))[0];
  } else pick = p.pick(open, view.total);
  return { type: 'shut', tiles: toTiles(pick), botDelayMs: pace(rng, 1100), botFor: tag };
}
