/**
 * The computer for Lucky Seven (see `bot` in index.js). The cards are all face up, so it counts
 * them: what's left in the deck is the full deck less what's been drawn since the shuffle. It flips
 * while the chance of going bust is worth what it stands to gain.
 *   easy:   stops at a fixed total (about 15), whatever the cards left.
 *   normal: counts the deck: flips while the gain it expects is bigger than what it risks.
 *   hard:   looks three flips ahead, pushes harder when it's behind and the other is near the
 *           target, and takes no risk once banking would win it.
 */
import { fullDeck, bank, isNumber } from './lucky-seven.js';

export function luckySevenBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const hand = view.hands[me];
  const now = bank(hand);
  const pace = { botDelayMs: 900 + rng() * 1100, botFor: view.round + ':' + view.n };
  const decide = (flip) => ({ type: flip || !view.flipped[me] ? 'flip' : 'stop', ...pace });
  if (level === 'easy') return decide(now < 13 + rng() * 6);
  // The deck as it stands.
  const left = fullDeck();
  for (const c of view.gone) { const k = left.indexOf(c); if (k >= 0) left.splice(k, 1); }
  const pool = left.length ? left : fullDeck();
  const have = new Set(hand.filter(isNumber));
  const shielded = hand.includes('S');
  let bust = 0;
  let gain = 0;
  for (const c of pool) {
    if (isNumber(c) && have.has(c)) { if (!shielded) bust++; continue; }
    gain += bank(hand.concat(c)) - now;
  }
  const p = bust / pool.length;
  const expected = gain / pool.length; // (what a safe card adds, on average over every card)
  let flip = expected > p * now;
  if (level === 'hard') {
    // Three flips ahead: at each step the better of stopping and flipping, over every card left.
    const counts = new Map();
    for (const c of pool) counts.set(c, (counts.get(c) || 0) + 1);
    const best = (h, depth) => {
      const stopNow = bank(h);
      if (!depth) return stopNow;
      const nums = new Set(h.filter(isNumber));
      if (nums.size >= 7) return stopNow;
      let ev = 0;
      for (const [c, k] of counts) {
        if (isNumber(c) && nums.has(c)) {
          if (h.includes('S')) { const i = h.indexOf('S'); ev += k * best(h.slice(0, i).concat(h.slice(i + 1)), depth - 1); }
          continue; // bust: 0
        }
        ev += k * best(h.concat(c), depth - 1);
      }
      return Math.max(stopNow, ev / pool.length);
    };
    flip = best(hand, 3) > now + 0.01;
    const them = view.scores[1 - me];
    const mine = view.scores[me];
    if (mine + now >= view.target && mine + now > them) flip = false; // banking wins it
    else if (them >= view.target - 25 && mine + now < them) flip = flip || p < 0.6; // behind at the end: push
  }
  return decide(flip);
}
