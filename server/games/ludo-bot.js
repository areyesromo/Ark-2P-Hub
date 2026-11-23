/**
 * The computer for Ludo (see `bot` in index.js). It rolls, and picks which pawn to move:
 *   easy:   brings a pawn out on a 6, takes a pawn and gets one home when it can; otherwise much
 *           the pawn furthest on (one move in ten just any at all).
 *   normal: also gets pawns home and onto safe squares, and moves the pawn furthest on.
 *   hard:   also keeps out of reach of your pawns behind it (and away from your start square).
 */
import { target, squareOf, SAFE, STARTS, HOME } from './ludo.js';

/** How many of the other's pawns could reach `sq` next roll (1 to 6 squares behind it on their way). */
function danger(pawns, slot, sq) {
  if (sq === null || SAFE.includes(sq)) return 0;
  const other = 1 - slot;
  let n = 0;
  for (const p of pawns[other]) {
    const at = squareOf(other, p);
    if (at === null) continue;
    const behind = (sq - at + 52) % 52;
    if (behind >= 1 && behind <= 6 && p + behind <= 50) n++;
  }
  // A pawn in their yard comes out on their start square: the squares just past it are in reach.
  if (pawns[other].some((p) => p < 0)) {
    const d = (sq - STARTS[other] + 52) % 52;
    if (d >= 1 && d <= 5) n += 0.3;
  }
  return n;
}

export function ludoBot(view, level, rng = Math.random) {
  if (!view || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const pace = (ms) => ms + rng() * ms * 0.7;
  if (view.phase === 'roll') return { type: 'roll', botDelayMs: pace(800), botFor: 'r' + view.game + ':' + view.rollNo };
  if (view.phase !== 'move' || !view.movable.length) return null;
  const pawns = view.pawns;
  const d = view.die;
  const score = (i) => {
    const from = pawns[me][i];
    const to = target(pawns, me, i, d);
    const sq = squareOf(me, to);
    let s = 0;
    const other = 1 - me;
    const hits = sq !== null && !SAFE.includes(sq) && pawns[other].filter((p) => squareOf(other, p) === sq).length === 1;
    if (hits) s += 100 + pawns[other].find((p) => squareOf(other, p) === sq) * (level === 'easy' ? 0 : 1);
    if (from < 0) s += 60; // a pawn out
    if (to === HOME) s += 80;
    if (level === 'easy') return s + from * 0.3 + rng() * 10;
    if (to > 50 && from <= 50) s += 40; // onto the home path: safe
    if (sq !== null && SAFE.includes(sq)) s += 15;
    s += from * 0.3; // the one furthest on
    if (level === 'hard') {
      s -= danger(pawns, me, sq) * 35; // where it lands
      s += danger(pawns, me, squareOf(me, from)) * 25; // where it leaves
    }
    return s + rng() * 2;
  };
  let pick;
  if (level === 'easy' && rng() < 0.1) pick = view.movable[Math.floor(rng() * view.movable.length)];
  else pick = view.movable.slice().sort((a, b) => score(b) - score(a))[0];
  return { type: 'move', pawn: pick, botDelayMs: pace(900), botFor: 'm' + view.game + ':' + view.rollNo };
}
