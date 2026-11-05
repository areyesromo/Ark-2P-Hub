/**
 * The computer opponent for Liar's Dice (see `bot` in index.js). It only knows its own dice (as
 * you do) and plays the odds, like a good player: each of your hidden dice shows a given face one
 * time in six (one in three with wild ones), so it works out how likely a bid is from what it
 * holds. It calls "Liar!" when a bid looks unlikely, and otherwise raises on the faces it has.
 *   easy:   rough sums: calls late or early, and picks among the safe raises at random.
 *   normal: the odds, and it reads a little into your bids (you probably hold what you bid).
 *   hard:   the odds, reads more into your bids, and now and then bluffs on a face it doesn't hold.
 */
import { isRaise } from './liars-dice.js';

const LEVEL = {
  easy: { call: 0.3, noise: 0.15, read: 0, pick: 4, bluff: 0, think: [1800, 4500] },
  normal: { call: 0.4, noise: 0.05, read: 0.3, pick: 1, bluff: 0, think: [1400, 3500] },
  hard: { call: 0.45, noise: 0, read: 0.5, pick: 1, bluff: 0.15, think: [1200, 3000] },
};

/** P(at least k of n dice show the face), each with chance p. */
export function atLeast(k, n, p) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let sum = 0;
  let c = 1; // n choose i
  for (let i = 0; i <= n; i++) {
    if (i >= k) sum += c * p ** i * (1 - p) ** (n - i);
    c = (c * (n - i)) / (i + 1);
  }
  return sum;
}

export function liarsDiceBot(view, level, rng = Math.random) {
  const L = LEVEL[level];
  if (!view || !L) return null;
  const wait = L.think[0] + rng() * (L.think[1] - L.think[0]);
  if (view.phase === 'howto') return view.ready && !view.ready[view.you] ? { type: 'ready', botDelayMs: wait } : null;
  if (view.phase !== 'bidding' || view.turn !== view.you || !Array.isArray(view.mine)) return null;
  const mine = view.mine;
  const unseen = view.counts[1 - view.you];
  const wild = view.wild;
  const held = (face) => mine.filter((d) => d === face || (wild && d === 1)).length;
  const chance = (face) => (wild && face !== 1 ? 2 / 6 : 1 / 6);
  // You bid on a face: you probably hold at least one (Normal and Hard read that in).
  const yours = new Set(view.bids.filter((b) => b.by !== view.you).map((b) => b.face));
  /** How likely it is that there are at least `qty` of `face` in all, as far as it can tell. */
  const odds = (qty, face) => {
    const need = qty - held(face);
    const plain = atLeast(need, unseen, chance(face));
    if (!L.read || !yours.has(face) || unseen < 1) return plain;
    return L.read * atLeast(need - 1, unseen - 1, chance(face)) + (1 - L.read) * plain;
  };
  const bid = view.bid;
  const noise = () => (rng() * 2 - 1) * L.noise;
  // Liar? When the bid looks unlikely.
  if (bid && bid.by !== view.you && odds(bid.qty, bid.face) + noise() < L.call) return { type: 'liar', botDelayMs: wait };
  // Otherwise a raise: the small ones (a bid much higher than needed only helps you), on faces it
  // holds, as safe as can be.
  const low = bid ? bid.qty : 1;
  const raises = [];
  for (let qty = low; qty <= Math.min(view.total, low + 2); qty++) {
    for (let face = wild ? 2 : 1; face <= 6; face++) {
      if (!isRaise(bid, { qty, face }, view.total, wild)) continue;
      const p = odds(qty, face);
      raises.push({ qty, face, p, v: p - 0.08 * (qty - low) + (held(face) ? 0.05 : 0) + noise() });
    }
  }
  if (!raises.length) return bid && bid.by !== view.you ? { type: 'liar', botDelayMs: wait } : null;
  raises.sort((a, b) => b.v - a.v);
  // Every raise is a long shot and there's a bid to doubt: call it instead.
  if (bid && bid.by !== view.you && raises[0].p < 0.3 && odds(bid.qty, bid.face) < 0.6) return { type: 'liar', botDelayMs: wait };
  let pick = raises[Math.floor(rng() * Math.min(L.pick, raises.length))];
  // A bluff now and then (Hard): a face it doesn't hold, if the bid's still fair.
  if (rng() < L.bluff) {
    const bluff = raises.find((r) => !held(r.face) && r.p >= 0.45);
    if (bluff) pick = bluff;
  }
  return { type: 'bid', qty: pick.qty, face: pick.face, botDelayMs: wait };
}
