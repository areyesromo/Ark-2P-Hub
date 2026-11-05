/**
 * The computer opponent for Crazy Eights (see `bot` in index.js). It only knows its own hand (as
 * you do) and plays it the way good players do: it keeps its 8s for when nothing else fits (or
 * to go out), plays into the suit it holds most of so it has something next time, gets rid of
 * its high cards first, answers a 2 with a 2, and calls the suit it's longest in.
 *   easy:   any card that fits, 8s whenever, and a suit call that's sometimes a guess.
 *   normal: the above.
 *   hard:   the above, and saves its 2s and Q♠ for when you're close to going out.
 */
import { SUITS, rankOf, suitOf, value } from './crazy-eights.js';

const THINK = { easy: [1600, 3200], normal: [1200, 2600], hard: [1000, 2200] };

export function crazyEightsBot(view, level, rng = Math.random) {
  if (!view || !THINK[level] || view.turn !== view.you || !Array.isArray(view.cards)) return null;
  const [lo, hi] = THINK[level];
  const wait = lo + rng() * (hi - lo);
  const hand = view.cards;
  const longest = () => {
    const count = (s) => hand.filter((c) => suitOf(c) === s && rankOf(c) !== '8').length;
    return SUITS.reduce((best, s) => (count(s) > count(best) ? s : best), SUITS[0]);
  };
  if (view.phase === 'suit') {
    const suit = level === 'easy' && rng() < 0.3 ? SUITS[Math.floor(rng() * 4)] : longest();
    return { type: 'suit', suit, botDelayMs: wait };
  }
  if (view.phase !== 'play') return null;
  const play = (card) => ({ type: 'play', card, botDelayMs: wait });
  const playable = view.playable || [];
  // After drawing: play the card if it fits (Hard keeps an 8 back while it has plenty of cards), else pass.
  if (view.drew) {
    if (playable.length && !(level === 'hard' && rankOf(playable[0]) === '8' && hand.length > 3)) return play(playable[0]);
    return view.canPass ? { type: 'pass', botDelayMs: wait } : null;
  }
  // Owed cards (a 2): pass it back with a 2 of its own, or take them.
  if (view.pending) return playable.length && !(level === 'easy' && rng() < 0.3) ? play(playable[0]) : { type: 'draw', botDelayMs: wait };
  if (!playable.length) return { type: 'draw', botDelayMs: wait };
  if (level === 'easy') return play(playable[Math.floor(rng() * playable.length)]);
  const foeCards = view.counts[1 - view.you];
  const plain = playable.filter((c) => rankOf(c) !== '8');
  // Nothing else fits, or it's the last card: an 8.
  if (!plain.length) return play(playable[0]);
  const inSuit = (s) => hand.filter((c) => suitOf(c) === s && rankOf(c) !== '8').length;
  const scored = plain.map((c) => {
    const r = rankOf(c);
    let v = inSuit(suitOf(c)) * 2 + value(c) / 10; // stay in its long suit; shed points
    if (view.actions && (r === '2' || c === 'QS')) v += level === 'hard' ? (foeCards <= 3 ? 6 : -2) : 1; // (Hard: kept for your last cards)
    if (view.actions && r === 'J' && plain.length > 1) v += 2; // (a Jack: another go, with something to follow)
    return { c, v: v + rng() * 0.5 };
  });
  scored.sort((a, b) => b.v - a.v);
  return play(scored[0].c);
}
