/**
 * The computer for Pawn Race (see `bot` in index.js). Its three cards offer a handful of moves; it
 * scores the board each would leave: how far round its pawns are, against how far round yours are.
 *   easy:   mostly the move that goes furthest, now and then any move at all.
 *   normal: the move that leaves it furthest ahead of you (a bump counts: it sets you back), but
 *           with no thought for what you might do next.
 *   hard:   looks a move ahead: your hand is face up, so for each move it could make it finds your
 *           best reply with the cards you hold, and takes the move that leaves it furthest ahead
 *           after it. So it keeps its pawns out of your reach, and doesn't leave one sitting on
 *           your way out of Start. It also keeps a card back for later when it can.
 */
import { HOME, LOOP, movesFor, applyMove } from './pawn-race.js';

const pace = (rng) => 1100 + rng() * 1500;

/** How far round a player's pawns are (a pawn Home, or safe in the stretch, counts a little extra). */
function progress(pawns) {
  return pawns.reduce((t, p) => t + p + (p === HOME ? 8 : p > LOOP ? 3 : 0), 0);
}

const after = (pawns, s, m) => applyMove(pawns, s, m).pawns;

/** Hard's look a move ahead: the lead left after the other's best reply from the hand they hold. */
function lookAhead(s, pawns, hand) {
  const o = 1 - s;
  let worst = progress(pawns[s]) - progress(pawns[o]);
  for (const card of hand) {
    for (const m of movesFor(pawns, o, card)) {
      const p = after(pawns, o, m);
      const lead = progress(p[s]) - progress(p[o]);
      if (lead < worst) worst = lead;
    }
  }
  return worst;
}

export function pawnRaceBot(view, level, rng = Math.random) {
  if (!view || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const tag = view.round + ':' + view.n;
  if (view.phase !== 'move' || !view.options.length) return null;
  const s = view.you;
  const move = (i) => ({ type: 'move', option: i, botDelayMs: pace(rng), botFor: tag });
  // Nothing to move: throw away the card it likes least (Hard and Normal keep the 1s, 2s and Bumps).
  if (view.options[0].kind === 'discard') {
    const hand = view.hands[s];
    const keep = (c) => (level === 'easy' ? 0 : c === 'bump' ? 3 : c === 1 || c === 2 ? 2 : c === 11 ? 1 : 0);
    let pick = 0;
    hand.forEach((c, i) => { if (keep(c) < keep(hand[pick])) pick = i; });
    return move(view.options.findIndex((o) => o.card === pick));
  }
  if (level === 'easy') {
    if (rng() < 0.3) return move(Math.floor(rng() * view.options.length));
    let best = 0;
    view.options.forEach((m, i) => { if (m.to - view.pawns[s][m.pawn] > view.options[best].to - view.pawns[s][view.options[best].pawn]) best = i; });
    return move(best);
  }
  if (level === 'normal') {
    // The move that leaves it furthest ahead of you (a bump counts: it sets you back).
    let best = null;
    view.options.forEach((m, i) => {
      const p = after(view.pawns, s, m);
      const value = progress(p[s]) - progress(p[1 - s]) + rng() * 0.01;
      if (!best || value > best[0]) best = [value, i];
    });
    return move(best[1]);
  }
  let best = null;
  view.options.forEach((m, i) => {
    const p = after(view.pawns, s, m);
    // (keeping the precious cards counts a little: a Bump, a 1 or 2 with pawns still in Start)
    const card = view.hands[s][m.card];
    const spend = card === 'bump' ? 2 : (card === 1 || card === 2) && view.pawns[s].includes(0) && m.kind !== 'out' ? 1.5 : 0;
    const value = lookAhead(s, p, view.hands[1 - s]) - spend + rng() * 0.01;
    if (!best || value > best[0]) best = [value, i];
  });
  return move(best[1]);
}
