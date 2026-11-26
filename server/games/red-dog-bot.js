/**
 * The computer for Red Dog (see `bot` in index.js). The spread and what it pays give the odds: with
 * k cards left that fall inside and n cards left in all, a raise of one ante wins (pay x k / n) and
 * loses (n - k) / n of it. It raises when that's in its favour.
 *   easy:   goes by feel: raises on a wide spread, and is tempted by the big pay-outs on a narrow
 *           one (5 to 1!), which lose more often than not.
 *   normal: works the odds for a fresh deck, and plays it safe: one ante on a clear edge, two only on
 *           a very big one.
 *   hard:   counts every card gone since the shuffle for the true odds, and plays the match: bolder
 *           when behind near the end, careful when ahead.
 */
import { between, payFor } from './red-dog.js';

const pace = (rng) => 1300 + rng() * 2200;
const FULL = [];
for (const r of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) for (const s of 'SHDC') FULL.push(r + s);

export function redDogBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'raise' || view.raises[view.you] !== null || !['easy', 'normal', 'hard'].includes(level)) return null;
  const raise = (n) => ({ type: 'raise', raise: n, botDelayMs: pace(rng), botFor: 'h' + view.hand });
  const s = view.spread;
  if (level === 'easy') {
    if (s >= 9) return raise(2);
    if (s >= 7) return raise(rng() < 0.6 ? 1 : 2);
    if (s <= 3) return raise(rng() < 0.35 ? 1 : 0); // (5 to 1 sounds good)
    return raise(rng() < 0.3 ? 1 : 0);
  }
  // The chance of a card inside: a fresh deck less the two posts, or (Hard) what's really left.
  const k = level === 'hard' ? view.inside : between(view.posts, FULL.filter((c) => !view.posts.includes(c)));
  const n = level === 'hard' ? view.packLeft || 52 : 50;
  const p = k / n;
  const edge = p * payFor(s) - (1 - p); // won or lost for each chip raised
  if (level === 'normal') return raise(edge > 0.4 ? 2 : edge > 0.15 ? 1 : 0);
  const me = view.you;
  const lead = view.chips[me] - view.chips[1 - me];
  const late = view.hands - view.hand < 3;
  if (late && lead < 0) return raise(edge > -0.1 ? 2 : 0); // behind at the end: swing
  if (late && lead > 0) {
    // Ahead at the end: shadow them; a raise only helps on a strong edge.
    return raise(edge > 0.25 ? 1 : 0);
  }
  return raise(edge > 0.02 ? 2 : edge > 0 ? 1 : 0);
}
