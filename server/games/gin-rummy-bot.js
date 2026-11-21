/**
 * The computer for Gin Rummy (see `bot` in index.js). It sees its own hand, the discard pile and
 * what you've taken from it (as a player does), never your hand.
 *   easy:   takes the discard only when it makes a meld; throws away its worst card, though now and
 *           then not quite the worst; knocks once it's down to 7.
 *   normal: takes the discard when it cuts its deadwood; knocks as soon as it can.
 *   hard:   also keeps the cards with the most ways to become a meld, and won't throw you one that
 *           fits the cards you took.
 */
import { best, deck, rankOf, suitOf, valueOf, KNOCK } from './gin-rummy.js';

/** Whether card `c` would help someone who took the cards `theirs` (same rank, or next to one in its suit). */
const feeds = (c, theirs) => theirs.some((t) => rankOf(t) === rankOf(c) || (suitOf(t) === suitOf(c) && Math.abs(rankOf(t) - rankOf(c)) <= 2));

export function ginRummyBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !view.pile || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  if (memory.hand !== view.hand) { memory.hand = view.hand; memory.theirs = []; memory.gone = []; }
  const l = view.last;
  if (l && l.by !== me && l.what === 'pile' && !memory.theirs.includes(l.card)) memory.theirs.push(l.card);
  for (const c of view.pile) if (!memory.gone.includes(c)) memory.gone.push(c);
  const pace = (ms) => ms + rng() * ms * 0.7;
  if (view.phase === 'show') return view.ready && !view.ready[me] ? { type: 'next', botDelayMs: pace(2500) } : null;
  if (view.turn !== me) return null;
  const hand = view.cards;
  if (view.phase === 'draw') {
    const top = view.pile[view.pile.length - 1];
    let take = false;
    if (top) {
      const withTop = hand.concat(top);
      const b = best(withTop);
      const inMeld = b.melds.some((m) => m.includes(top));
      if (level === 'easy') take = inMeld;
      else {
        // The best it could do throwing something else away after taking it.
        let after = Infinity;
        for (const c of withTop) if (c !== top) after = Math.min(after, best(withTop.filter((x) => x !== c)).points);
        take = inMeld || after <= view.points - 6;
      }
    }
    return { type: 'draw', from: take ? 'pile' : 'stock', botDelayMs: pace(1300), botFor: view.hand + ':' + view.stock };
  }
  if (view.phase !== 'discard') return null;
  const options = Object.entries(view.after || {}).map(([card, points]) => ({ card, points }));
  if (!options.length) return null;
  // Least deadwood left, then the highest card thrown (and, for Hard, nothing that feeds you).
  options.sort((a, b) => a.points - b.points || valueOf(b.card) - valueOf(a.card));
  let pick = options[0];
  if (level === 'hard') {
    // Hard also counts what each keeps in play: the unseen cards that would join a meld (outs), and
    // gives you nothing that fits what you took.
    const unseen = deck().filter((c) => !hand.includes(c) && !memory.gone.includes(c) && !memory.theirs.includes(c));
    let top = Infinity;
    for (const o of options.slice(0, 6)) {
      const kept = hand.filter((c) => c !== o.card);
      const melded = new Set(best(kept).melds.flat());
      let outs = 0;
      for (const u of unseen) if (best(kept.concat(u)).melds.some((m) => m.includes(u) && m.some((x) => !melded.has(x) && x !== u))) outs++;
      const score = o.points - outs * 0.8 + (feeds(o.card, memory.theirs) ? 4 : 0);
      if (score < top) { top = score; pick = o; }
    }
    if (pick.points > KNOCK && options[0].points <= KNOCK) pick = options[0]; // (a knock beats keeping outs)
  }
  if (level === 'easy' && rng() < 0.25) pick = options[Math.min(options.length - 1, 1 + Math.floor(rng() * 2))];
  const knockAt = level === 'easy' ? 7 : KNOCK;
  const knock = pick.points <= knockAt;
  return { type: knock ? 'knock' : 'discard', card: pick.card, botDelayMs: pace(1500), botFor: view.hand + ':' + view.stock };
}
