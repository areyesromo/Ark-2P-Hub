/**
 * The computer for Speed (see `bot` in index.js). It only sees its own hand and the two middle
 * cards. It spots a card that fits, as quick as a person's hands go:
 *   easy:   slow to spot one, and plays the first it sees.
 *   normal: quicker.
 *   hard:   quick, and plays the card that leaves it another one to follow (a chain).
 */
import { fits } from './speed.js';

const PACE = { easy: [1400, 900], normal: [850, 500], hard: [520, 300] };

export function speedBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || !view.hand || !PACE[level]) return null;
  const moves = [];
  view.hand.forEach((c, i) => view.tops.forEach((t, p) => { if (fits(c, t)) moves.push({ i, p, c }); }));
  if (!moves.length) return null;
  let pick = moves[0];
  if (level === 'normal') pick = moves[Math.floor(rng() * moves.length)];
  if (level === 'hard') {
    // The move after which another card of ours goes on that pile (or the other).
    const next = (m) => {
      const rest = view.hand.filter((_, k) => k !== m.i);
      const tops = view.tops.slice();
      tops[m.p] = m.c;
      return rest.some((c) => fits(c, tops[0]) || fits(c, tops[1])) ? 1 : 0;
    };
    pick = moves.slice().sort((a, b) => next(b) - next(a))[0];
  }
  const [base, spread] = PACE[level];
  return { type: 'play', card: pick.i, pile: pick.p, botDelayMs: base + rng() * spread, botFor: view.round + ':' + view.n };
}
