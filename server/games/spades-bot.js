/**
 * The computer for Spades (see `bot` in index.js). It sees its own hand, the card it's offered, and
 * the tricks as they're played.
 *   easy:   keeps any high card it's shown, bids a rough guess, and grabs every trick it can (bags
 *           and all), or just plays any card.
 *   normal: keeps what will take tricks, counts its winners to bid, plays to make its bid and
 *           ducks once it has (no bags if it can help it).
 *   hard:   as Normal, and it remembers every card played, so it knows when a card is the best
 *           left in its suit; and it goes nil with a hand that can't take a trick.
 */
import { trickWinner, rankOf, suitOf } from './spades.js';

/** Tricks a hand should take: aces and guarded kings, and spades (high ones, and length past three). */
function estimate(hand) {
  let t = 0;
  const bySuit = { S: [], H: [], D: [], C: [] };
  for (const c of hand) bySuit[suitOf(c)].push(rankOf(c));
  for (const s of ['H', 'D', 'C']) {
    const r = bySuit[s];
    if (r.includes(14)) t += 1;
    if (r.includes(13) && r.length >= 2) t += 0.7;
    if (r.includes(12) && r.length >= 3) t += 0.3;
  }
  const sp = bySuit.S.sort((a, b) => b - a);
  sp.forEach((r, i) => { if (r >= 12 || i >= 3) t += r >= 12 ? 0.9 : 0.8; else if (r >= 10) t += 0.4; });
  return t;
}

const keepWorth = (c) => (suitOf(c) === 'S' ? rankOf(c) >= 8 : rankOf(c) >= 12);

export function spadesBot(view, level, rng = Math.random, retries = 0) {
  if (!view || view.turn !== view.you || !view.hand || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const pace = (ms) => ({ botDelayMs: ms + rng() * ms * 0.8, botFor: view.deal + ':' + view.n });
  if (view.phase === 'draw' && view.offer) {
    const c = view.offer;
    let keep = keepWorth(c) || (level !== 'easy' && suitOf(c) === 'S' && rankOf(c) >= 6);
    if (level === 'easy' && rng() < 0.2) keep = !keep;
    return { type: 'draw', keep, ...pace(700) };
  }
  if (view.phase === 'bid') {
    const t = estimate(view.hand);
    let bid = Math.max(1, Math.round(t + (level === 'easy' ? rng() * 4 - 1.5 : -0.2)));
    if (level === 'hard' && t < 0.6 && !view.hand.some((c) => rankOf(c) >= 13)) bid = 0; // nil
    return { type: 'bid', bid: Math.min(13, bid), ...pace(1500) };
  }
  if (view.phase !== 'play' || !view.legal || !view.legal.length) return null;
  const legal = view.legal.slice().sort((a, b) => rankOf(a) - rankOf(b));
  const need = view.bids[me] === 0 ? -1 : view.bids[me] - view.tricks[me]; // tricks still wanted (−1: nil)
  const lead = view.trick.length ? view.trick[0].card : null;
  const play = (c) => ({ type: 'play', card: c, ...pace(800) });
  // Cards gone: what's been played (Hard remembers; the others only see the trick on the table).
  const seen = new Set();
  if (level === 'hard' && view.playedCards) view.playedCards.forEach((c) => seen.add(c));
  const bestLeft = (c) => {
    // No higher card of its suit still out (not ours, not seen).
    for (let r = rankOf(c) + 1; r <= 14; r++) {
      const name = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'][r] + suitOf(c);
      if (!seen.has(name) && !view.hand.includes(name)) return false;
    }
    return true;
  };
  if (level === 'easy') {
    // Easy grabs every trick it can (and so collects bags), or just plays any card.
    if (rng() < 0.4) return play(legal[Math.floor(rng() * legal.length)]);
    const win = lead ? legal.filter((c) => trickWinner(lead, c) === 1) : [];
    return play(win.length ? win[0] : lead ? legal[0] : legal[legal.length - 1]);
  }
  if (lead) {
    const winners = legal.filter((c) => trickWinner(lead, c) === 1);
    if (need > 0 && winners.length) return play(winners[0]); // the cheapest card that takes it
    // Don't want it (bid made, or nil): the highest card that still loses, else the lowest.
    const losers = legal.filter((c) => trickWinner(lead, c) === 0);
    return play(losers.length ? losers[losers.length - 1] : legal[0]);
  }
  // Leading.
  if (need > 0) {
    const sure = level === 'hard' ? legal.filter(bestLeft) : legal.filter((c) => rankOf(c) === 14);
    if (sure.length) return play(sure[sure.length - 1]);
    return play(legal[legal.length - 1]);
  }
  return play(legal[0]); // (nothing wanted: lead low)
}
