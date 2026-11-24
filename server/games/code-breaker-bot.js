/**
 * The computer for Code Breaker (see `bot` in index.js). It sets a random code and keeps a list of
 * the codes that still fit every answer it has had. Like a person it takes a while over each guess.
 *   easy:   guesses a code that fits, but now and then forgets the cows and only follows the bulls;
 *           slow.
 *   normal: a code that fits everything.
 *   hard:   of a sample of codes, the guess that leaves the fewest on average, whatever the answer.
 */
import { allCodes, score } from './code-breaker.js';

const ALL = allCodes();
const THINK = { easy: [9000, 9000], normal: [6000, 7000], hard: [4500, 5000] };

export function codeBreakerBot(view, level, rng = Math.random) {
  if (!view || !THINK[level]) return null;
  const me = view.you;
  const pace = (k) => ({ botDelayMs: THINK[level][0] + rng() * THINK[level][1] * k });
  if (view.phase === 'set' && !view.ready[me]) {
    return { type: 'code', code: ALL[Math.floor(rng() * ALL.length)], botDelayMs: 2500 + rng() * 3000 };
  }
  if (view.phase !== 'guess' || view.turn !== me) return null;
  const mine = view.guesses[me];
  const bullsOnly = level === 'easy' && rng() < 0.3;
  const fits = ALL.filter((c) => mine.every((g) => {
    const r = score(g.guess, c);
    return bullsOnly ? r.bulls === g.bulls : r.bulls === g.bulls && r.cows === g.cows;
  }) && !mine.some((g) => g.guess === c));
  const pool = fits.length ? fits : ALL;
  let guess = pool[Math.floor(rng() * pool.length)];
  if (level === 'hard' && pool.length > 2) {
    // Fewest left on average, from a sample of guesses (mostly codes that fit).
    const tries = (pool.length > 80 ? Array.from({ length: 80 }, () => pool[Math.floor(rng() * pool.length)]) : pool).concat(Array.from({ length: 20 }, () => ALL[Math.floor(rng() * ALL.length)]));
    const sample = pool.length > 600 ? Array.from({ length: 600 }, () => pool[Math.floor(rng() * pool.length)]) : pool;
    let best = Infinity;
    for (const t of tries) {
      const buckets = new Map();
      for (const c of sample) {
        const r = score(t, c);
        const k = r.bulls * 10 + r.cows;
        buckets.set(k, (buckets.get(k) || 0) + 1);
      }
      // (how many it expects to be left: the sizes squared, over the sample)
      let left = 0;
      for (const n of buckets.values()) left += n * n;
      left -= pool.includes(t) ? sample.length * 0.6 : 0; // (one that could be it gets a chance to win now)
      if (left < best) { best = left; guess = t; }
    }
  }
  return { type: 'guess', guess, ...pace(Math.min(1, mine.length / 3)), botFor: view.round + ':' + mine.length };
}
