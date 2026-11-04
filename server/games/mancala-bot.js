/**
 * The computer opponent for Mancala (see `bot` in index.js): it looks ahead (alpha-beta, a free
 * turn keeps the same player going) and counts the stones in each store (and, on Hard, on each
 * side).
 *   easy:   one move ahead, and now and then any pit.
 *   normal: three moves ahead.
 *   hard:   seven moves ahead.
 */
import { PITS, STORE, sow, legalPits } from './mancala.js';

const DEPTH = { easy: 1, normal: 3, hard: 7 };

export function mancalaBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !DEPTH[level]) return null;
  const me = view.you;
  const legal = legalPits(view.pits, me);
  if (!legal.length) return null;
  const pace = 700 + rng() * 900;
  if (level === 'easy' && rng() < 0.3) return { type: 'sow', pit: legal[Math.floor(rng() * legal.length)], botDelayMs: pace };
  let best = null;
  let bestScore = -Infinity;
  for (const pit of legal) {
    const pits = view.pits.slice();
    const r = sow(pits, me, pit);
    const s = search(pits, r.again ? me : 1 - me, DEPTH[level] - 1, -Infinity, Infinity, me, level) + rng() * 0.01;
    if (s > bestScore) { bestScore = s; best = pit; }
  }
  return { type: 'sow', pit: best, botDelayMs: pace };
}

/** A side out of stones ends the round: everything left goes to its owner's store. */
function ended(pits) {
  return !legalPits(pits, 0).length || !legalPits(pits, 1).length;
}

function finalDiff(pits, me) {
  const side = (s) => pits.slice(s * (PITS + 1), s * (PITS + 1) + PITS).reduce((a, b) => a + b, 0);
  return (pits[STORE[me]] + side(me)) - (pits[STORE[1 - me]] + side(1 - me));
}

function search(pits, turn, depth, alpha, beta, me, level) {
  if (ended(pits)) return finalDiff(pits, me) * 100;
  if (depth <= 0) {
    const stores = pits[STORE[me]] - pits[STORE[1 - me]];
    return level === 'hard' ? stores * 3 + finalDiff(pits, me) : stores;
  }
  const maxing = turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const pit of legalPits(pits, turn)) {
    const next = pits.slice();
    const r = sow(next, turn, pit);
    const s = search(next, r.again ? turn : 1 - turn, depth - 1, alpha, beta, me, level);
    if (maxing) { best = Math.max(best, s); alpha = Math.max(alpha, s); } else { best = Math.min(best, s); beta = Math.min(beta, s); }
    if (alpha >= beta) break;
  }
  return best;
}
