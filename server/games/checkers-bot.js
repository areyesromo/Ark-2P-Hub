/**
 * The computer opponent for Checkers (see `bot` in index.js): it looks ahead (alpha-beta) one
 * step at a time, a multi-jump's steps included, and counts pieces (a king is worth more) and how
 * far its men have come.
 *   easy:   one step ahead, and now and then any legal move.
 *   normal: three steps ahead.
 *   hard:   five steps ahead, and it keeps its back row and the middle.
 */
import { SIZE, legalMoves } from './checkers.js';

const DEPTH = { easy: 1, normal: 3, hard: 5 };
const owner = (x) => (x ? (x - 1) % 2 : -1);
const isKing = (x) => x > 2;

export function checkersBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !DEPTH[level] || !view.legal || !view.legal.length) return null;
  const me = view.you;
  const pace = 800 + rng() * 900;
  const pick = (m) => ({ type: 'move', from: m.from, to: m.to, botDelayMs: pace });
  if (level === 'easy' && rng() < 0.3) return pick(view.legal[Math.floor(rng() * view.legal.length)]);
  let best = null;
  let bestScore = -Infinity;
  for (const m of view.legal) {
    const next = apply({ b: view.board, turn: me }, m);
    const s = search(next, DEPTH[level] - 1, -Infinity, Infinity, me, level) + rng() * 0.01;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return pick(best);
}

/** One step on a copy of the board: the jump, the crown, and whose move it is after. */
function apply(state, m) {
  const b = state.b.map((r) => r.slice());
  const [fc, fr] = m.from;
  const [tc, tr] = m.to;
  let x = b[fr][fc];
  const slot = owner(x);
  b[fr][fc] = 0;
  const jump = Math.abs(tc - fc) === 2;
  if (jump) b[(fr + tr) / 2][(fc + tc) / 2] = 0;
  const crowned = !isKing(x) && tr === (slot === 0 ? 0 : SIZE - 1);
  if (crowned) x += 2;
  b[tr][tc] = x;
  if (jump && !crowned && legalMoves(b, slot, [tc, tr]).length) return { b, turn: slot, chain: [tc, tr] };
  return { b, turn: 1 - slot, chain: null };
}

/** How good `state` is for `me`, looking `depth` steps on (minimax: `me` maximises). */
function search(state, depth, alpha, beta, me, level) {
  const moves = legalMoves(state.b, state.turn, state.chain);
  if (!moves.length) return state.turn === me ? -1e5 - depth : 1e5 + depth; // stuck (or no pieces): that side loses
  if (depth <= 0) return evaluate(state.b, me, level);
  const maxing = state.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const s = search(apply(state, m), depth - 1, alpha, beta, me, level);
    if (maxing) { best = Math.max(best, s); alpha = Math.max(alpha, s); } else { best = Math.min(best, s); beta = Math.min(beta, s); }
    if (alpha >= beta) break;
  }
  return best;
}

function evaluate(b, me, level) {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = b[r][c];
      if (!x) continue;
      const who = owner(x);
      let v = isKing(x) ? 160 : 100;
      if (!isKing(x)) v += (who === 0 ? SIZE - 1 - r : r) * 4; // further along
      if (level === 'hard') {
        if (!isKing(x) && r === (who === 0 ? SIZE - 1 : 0)) v += 8; // the back row keeps kings out
        if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 5; // the middle
      }
      score += who === me ? v : -v;
    }
  }
  return score;
}
