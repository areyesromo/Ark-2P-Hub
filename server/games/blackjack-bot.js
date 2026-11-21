/**
 * The computer for Blackjack (see `bot` in index.js). It sees what a player sees: its own hand, the
 * dealer's up card, the chips.
 *   easy:   the book for hitting and standing, but never doubles or splits.
 *   normal: the book (basic strategy) for hitting, standing and doubling; splits only aces and 8s.
 *   hard:   the whole book, splits included.
 * It bets to the match: what you bet when it's level or ahead (so the same cards keep it there);
 * behind, Normal bets 100 and Hard works out enough to catch up in the hands left.
 */
import { total } from './blackjack.js';

const up = (card) => {
  const r = card.slice(0, -1);
  return r === 'A' ? 11 : r === 'J' || r === 'Q' || r === 'K' ? 10 : Number(r);
};
const val = (card) => Math.min(10, up(card) === 11 ? 1 : up(card));

/** The book's play for these cards against the dealer's up card `d` (2..11): hit, stand, double or split. */
export function book(cards, d, canDouble, canSplit, splits = 'all') {
  const { total: t, soft } = total(cards);
  if (canSplit && cards.length === 2) {
    const v = val(cards[0]);
    const pairs = {
      1: true, 8: true, 10: false, 5: false,
      9: d !== 7 && d <= 9, 7: d <= 7, 6: d <= 6, 4: d === 5 || d === 6, 3: d <= 7, 2: d <= 7,
    };
    if (pairs[v] && (splits === 'all' || v === 1 || v === 8)) return 'split';
  }
  const dbl = (yes) => (yes && canDouble && cards.length === 2 ? 'double' : 'hit');
  if (soft) {
    if (t >= 19) return 'stand';
    if (t === 18) return d >= 3 && d <= 6 ? dbl(true) : d <= 8 ? 'stand' : 'hit';
    if (t === 17) return dbl(d >= 3 && d <= 6);
    if (t >= 15) return dbl(d >= 4 && d <= 6);
    return dbl(d === 5 || d === 6);
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return d <= 6 ? 'stand' : 'hit';
  if (t === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  if (t === 11) return dbl(true);
  if (t === 10) return dbl(d <= 9);
  if (t === 9) return dbl(d >= 3 && d <= 6);
  return 'hit';
}

/** What to bet: a chip from the choices (or all it has, if that's less than the smallest). */
function betFor(view, level, rng) {
  const me = view.you;
  const chips = view.chips[me];
  const choices = view.betChoices.filter((b) => b <= chips);
  if (!choices.length) return chips;
  const pick = (want) => choices.filter((b) => b <= want).pop() || choices[0];
  // You both get the same cards, so a bet only matters against the other's. Ahead or level: bet
  // what they bet last time (the same cards with the same bet keep you ahead). Behind: enough to
  // catch up in the hands left.
  const lead = chips - view.chips[1 - me];
  if (lead >= 0) return pick(view.lastBet[1 - me]);
  if (level === 'normal') return pick(100); // (behind: a bigger bet, not worked out)
  const left = view.hands - view.hand + 1;
  const need = Math.ceil(-lead / left) + 25;
  return choices.find((b) => b >= need) || (left === 1 ? chips : choices[choices.length - 1]);
}

export function blackjackBot(view, level, rng = Math.random) {
  if (!view || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  if (view.phase === 'bet' && view.bets[me] === null) {
    return { type: 'bet', amount: betFor(view, level, rng), botDelayMs: 1200 + rng() * 1800 };
  }
  if (view.phase !== 'play' || !view.can) return null;
  const seat = view.seats[me];
  const hand = seat.hands[seat.at];
  const key = seat.at + ':' + hand.cards.length + ':' + seat.hands.length;
  const pace = 1000 + rng() * 1300;
  let move;
  if (level === 'easy') move = book(hand.cards, up(view.dealer.cards[0]), false, false);
  else move = book(hand.cards, up(view.dealer.cards[0]), view.can.double, view.can.split, level === 'hard' ? 'all' : 'aces-eights');
  return { type: move, botDelayMs: pace, botFor: key };
}
