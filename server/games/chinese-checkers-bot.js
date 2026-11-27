/**
 * The computer for Chinese Checkers (see `bot` in index.js). It measures the race: the steps all
 * its pieces still have to go to the far point (and yours).
 *   easy:   takes a move that gains it ground, often the longest hop it sees, now and then any.
 *   normal: the move that gains the most ground, with an eye on stragglers (a piece left far
 *           behind costs a lot of moves at the end).
 *   hard:   the same measure, but it looks at your best reply to each of its strongest moves:
 *           it won't open a long hop for you, and it likes moves that build ladders for itself.
 */
import { movesFrom, hexDistance, TIPS, GOALS } from './chinese-checkers.js';

const pace = (rng) => 900 + rng() * 1400;

/** How far player `s` is from done: steps to go, stragglers counted extra; a full point is 0. */
function far(board, s) {
  let d = 0;
  let worst = 0;
  board.forEach((v, c) => {
    if (v !== s + 1) return;
    const k = hexDistance(c, TIPS[s]);
    d += k;
    if (k > worst) worst = k;
  });
  // Pieces already home but not packed in deep: fill the point from the tip.
  const home = GOALS[s].filter((c) => board[c] === s + 1).length;
  return d + worst * 0.6 - home * 0.5;
}

/** Every move for `s`: [from, to]. */
function allMoves(board, s) {
  const out = [];
  board.forEach((v, c) => { if (v === s + 1) for (const to of movesFrom(board, c)) out.push([c, to]); });
  return out;
}

function after(board, s, [from, to]) {
  const b = board.slice();
  b[from] = 0;
  b[to] = s + 1;
  return b;
}

export function chineseCheckersBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const board = view.board;
  const tag = view.round + ':' + (view.lastMove ? view.lastMove.n : 0);
  const moves = allMoves(board, me);
  if (!moves.length) return null;
  const done = ([from, to]) => ({ type: 'move', from, to, botDelayMs: pace(rng), botFor: tag });
  const gain = ([from, to]) => hexDistance(from, TIPS[me]) - hexDistance(to, TIPS[me]);
  if (level === 'easy') {
    if (rng() < 0.2) return done(moves[Math.floor(rng() * moves.length)]);
    const best = Math.max(...moves.map(gain));
    const good = moves.filter((m) => gain(m) >= best - 1 && gain(m) > 0);
    return done((good.length ? good : moves)[Math.floor(rng() * (good.length || moves.length))]);
  }
  const base = far(board, me);
  const ranked = moves.map((m) => [base - far(after(board, me, m), me) + rng() * 0.01, m]).sort((a, b) => b[0] - a[0]);
  if (level === 'normal') return done(ranked[0][1]);
  // Hard: of its best dozen, the one that leaves it furthest ahead after your best reply.
  let best = null;
  for (const [, m] of ranked.slice(0, 12)) {
    const b = after(board, me, m);
    const mine = far(b, me);
    let theirs = Infinity;
    for (const r of allMoves(b, 1 - me)) {
      const f = far(after(b, 1 - me, r), 1 - me);
      if (f < theirs) theirs = f;
    }
    const value = theirs - mine;
    if (!best || value > best[0]) best = [value, m];
  }
  return done(best[1]);
}
