/**
 * The computer for Cribbage (see `bot` in index.js). It only sees its own cards and what's on the
 * table.
 *   easy:   keeps the four that count best as they are (no thought for the starter or the crib),
 *           and in the play often just lays any card.
 *   normal: keeps the four that count best on average over every starter, and pegs well.
 *   hard:   as Normal, and minds the crib (its own: give it good cards; theirs: give it bad ones),
 *           and in the play doesn't leave the count on 5 or 21 for an easy 15 or 31.
 */
import { scoreHand, pegPoints, valueOf, rankOf } from './cribbage.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
const ALL = SUITS.flatMap((s) => RANKS.map((r) => r + s));

function pickDiscard(hand, level, mine, rng) {
  let best = null;
  for (let a = 0; a < 6; a++) {
    for (let b = a + 1; b < 6; b++) {
      const keep = hand.filter((_, i) => i !== a && i !== b);
      let v;
      if (level === 'easy') v = scoreHand(keep, null).total + rng() * 3;
      else {
        const starters = ALL.filter((c) => !hand.includes(c));
        v = starters.reduce((t, c) => t + scoreHand(keep, c).total, 0) / starters.length;
        if (level === 'hard') {
          // The two going in: what they're worth together (a 15, a pair, a 5).
          const [x, y] = [hand[a], hand[b]];
          let crib = 0;
          if (valueOf(x) + valueOf(y) === 15) crib += 2;
          if (rankOf(x) === rankOf(y)) crib += 2;
          if (Math.abs(rankOf(x) - rankOf(y)) === 1) crib += 1;
          crib += (rankOf(x) === 5) + (rankOf(y) === 5);
          v += mine ? crib * 0.8 : -crib * 0.8;
        }
        v += rng() * 0.05;
      }
      if (!best || v > best.v) best = { v, cards: [a, b] };
    }
  }
  return best.cards;
}

function pickLay(view, level, rng) {
  const hand = view.hand;
  const seq = view.seq.map((x) => x.card);
  const options = hand.map((c, i) => ({ c, i })).filter((o) => view.count + valueOf(o.c) <= 31);
  if (!options.length) return null;
  if (level === 'easy' && rng() < 0.4) return options[Math.floor(rng() * options.length)].i;
  let best = null;
  for (const o of options) {
    let v = pegPoints(seq.concat(o.c)).pts;
    const after = view.count + valueOf(o.c);
    if (level === 'hard') {
      if (after === 5 || after === 21) v -= 1.5; // (a ten-card next makes 15 or 31)
      if (after < 15 && after + 10 >= 15 && after !== 5) v += 0.2;
      v -= valueOf(o.c) * 0.02; // (keep the low cards for later: they slip in under 31)
    }
    v += rng() * 0.01;
    if (!best || v > best.v) best = { v, i: o.i };
  }
  return best.i;
}

export function cribbageBot(view, level, rng = Math.random) {
  if (!view || !view.hand || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const pace = (ms) => ms + rng() * ms;
  if (view.phase === 'discard' && !view.discarded[me] && view.hand.length === 6) {
    return { type: 'discard', cards: pickDiscard(view.hand, level, view.dealer === me, rng), botDelayMs: pace(2500), botFor: 'd' + view.deal };
  }
  if (view.phase === 'play' && view.turn === me) {
    const i = pickLay(view, level, rng);
    if (i === null) return null;
    return { type: 'lay', card: i, botDelayMs: pace(1100), botFor: view.deal + ':' + view.seq.length + ':' + view.hand.length };
  }
  return null;
}
