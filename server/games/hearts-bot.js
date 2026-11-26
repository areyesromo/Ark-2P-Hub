/**
 * The computer for Hearts (see `bot` in index.js). It sees its own hand, the card it's offered, and
 * the tricks as they're played. In Hearts high cards are trouble: they take tricks.
 *   easy:   keeps the low cards it's shown (mostly), ducks under the card led when it can, and
 *           plays any card now and then; it forgets to throw away trouble.
 *   normal: keeps low cards, never the queen of spades; ducks under the card led, and when it
 *           can't follow, throws the queen, then its highest heart, then its highest card.
 *   hard:   as Normal, and it keeps track: the cards it passed when drawing (out of play), every
 *           card played, and the suits you've shown you're out of. When it leads, it deals you
 *           the hands you could hold, many times over, and leads what costs it least.
 */
import { QUEEN, rankOf, suitOf, pointsOf, trickWinner } from './hearts.js';

const RANKS = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const FULL = [];
for (const s of 'SHDC') for (const r of RANKS.slice(2)) FULL.push(r + s);

/** How much trouble a card is to hold (a guide for keeping it when drawing). */
function danger(c, hand) {
  if (c === QUEEN) return 20;
  const r = rankOf(c);
  if (suitOf(c) === 'S' && r > 12) {
    // The ace or king of spades catch the queen, unless there are low spades to hide behind.
    const low = hand.filter((x) => suitOf(x) === 'S' && rankOf(x) < 12).length;
    return low >= 4 ? r - 6 : 16;
  }
  return r + (suitOf(c) === 'H' ? 2 : 0);
}

/** Normal's reply to a lead (see below), for Hard's look ahead. */
function reply(lead, hand) {
  const follow = hand.filter((c) => suitOf(c) === suitOf(lead)).sort((a, b) => rankOf(a) - rankOf(b));
  if (follow.length) {
    const under = follow.filter((c) => rankOf(c) < rankOf(lead));
    if (under.length) return under[under.length - 1];
    const over = follow.filter((c) => c !== QUEEN);
    return over.length ? over[over.length - 1] : follow[0];
  }
  if (hand.includes(QUEEN)) return QUEEN;
  return hand.slice().sort((a, b) => (suitOf(b) === 'H') - (suitOf(a) === 'H') || rankOf(b) - rankOf(a))[0];
}

/** Hard's lead: for each card it might lead, the points it expects to take (less yours) over sampled hands of yours. */
function bestLead(view, options, memory, rng) {
  const known = new Set([...view.hand, ...(view.playedCards || []), ...(memory.passed || [])]);
  const pool = FULL.filter((c) => !known.has(c) && !(memory.void || []).includes(suitOf(c)));
  const theirs = view.handCounts[1 - view.you];
  let best = null;
  for (const c of options) {
    let cost = 0;
    for (let k = 0; k < 60; k++) {
      // Their hand: a random draw from what they could hold. (Two of three cards out there were
      // thrown away unseen, so most of the pool isn't theirs.)
      const p = pool.slice();
      for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
      const hand = p.slice(0, theirs);
      if (!hand.length) continue;
      const r = reply(c, hand);
      const pts = pointsOf(c) + pointsOf(r);
      cost += trickWinner(c, r) === 0 ? pts : -pts;
    }
    // Ties: shed the higher card.
    if (!best || cost < best[0] || (cost === best[0] && rankOf(c) > rankOf(best[1]))) best = [cost, c];
  }
  return best[1];
}

export function heartsBot(view, level, rng = Math.random, _retries = 0, memory = {}) {
  if (!view || !view.hand || !['easy', 'normal', 'hard'].includes(level)) return null;
  // Hard's notes for this deal: the cards it passed, and the suits you're out of.
  if (memory.deal !== view.deal) Object.assign(memory, { deal: view.deal, passed: [], void: [] });
  if (view.lastTrick && view.lastTrick.cards[1].by !== view.you) {
    const [a, b] = view.lastTrick.cards;
    if (suitOf(b.card) !== suitOf(a.card) && !memory.void.includes(suitOf(a.card))) memory.void.push(suitOf(a.card));
  }
  if (view.turn !== view.you) return null;
  const pace = (ms) => ({ botDelayMs: ms + rng() * ms * 0.8, botFor: view.deal + ':' + view.n });
  const hand = view.hand;
  if (view.phase === 'draw' && view.offer) {
    const c = view.offer;
    let keep;
    if (level === 'easy') keep = rankOf(c) <= 9 ? rng() < 0.8 : rng() < 0.35;
    else keep = c !== QUEEN && rankOf(c) <= 8;
    if (!keep) memory.passed.push(c);
    return { type: 'draw', keep, ...pace(700) };
  }
  if (view.phase !== 'play' || !view.legal || !view.legal.length) return null;
  const legal = view.legal.slice().sort((a, b) => rankOf(a) - rankOf(b));
  const lead = view.trick.length ? view.trick[0].card : null;
  const play = (c) => ({ type: 'play', card: c, ...pace(800) });
  if (level === 'easy') {
    // Ducks when it can follow (else its lowest card), and plays any card now and then.
    if (rng() < 0.3) return play(legal[Math.floor(rng() * legal.length)]);
    const under = lead ? legal.filter((c) => suitOf(c) === suitOf(lead) && rankOf(c) < rankOf(lead)) : [];
    return play(under.length ? under[under.length - 1] : legal[0]);
  }

  const seen = new Set(view.playedCards || []);
  const queenOut = !seen.has(QUEEN) && !hand.includes(QUEEN);
  if (lead) {
    const follow = legal.filter((c) => suitOf(c) === suitOf(lead));
    if (follow.length) {
      // Duck: the highest card under theirs; else (we must take it) the highest, but not our queen.
      const under = follow.filter((c) => rankOf(c) < rankOf(lead));
      if (under.length) return play(under[under.length - 1]);
      const over = follow.filter((c) => c !== QUEEN);
      return play(over.length ? over[over.length - 1] : follow[0]);
    }
    // Can't follow: off-load trouble.
    if (legal.includes(QUEEN)) return play(QUEEN);
    const hearts = legal.filter((c) => suitOf(c) === 'H');
    if (hearts.length) return play(hearts[hearts.length - 1]);
    const big = legal.filter((c) => !(queenOut && suitOf(c) === 'S' && rankOf(c) > 12));
    return play((big.length ? big : legal).sort((a, b) => danger(b, hand) - danger(a, hand))[0]);
  }
  // Leading. Never the ace or king of spades while the queen's out there.
  let options = legal.filter((c) => !(queenOut && suitOf(c) === 'S' && rankOf(c) > 12) && c !== QUEEN);
  if (!options.length) options = legal;
  if (level === 'hard') return play(bestLead(view, options, memory, rng));
  // The lowest card of our shortest suit (to empty it, so we can throw trouble later).
  const count = {};
  for (const c of hand) count[suitOf(c)] = (count[suitOf(c)] || 0) + 1;
  options.sort((a, b) => count[suitOf(a)] - count[suitOf(b)] || rankOf(a) - rankOf(b));
  return play(options[0]);
}
