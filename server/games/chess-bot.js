/**
 * The computer for Chess (see `bot` in index.js). It looks ahead with alpha-beta, scoring a position
 * by its material and where the pieces stand, and follows captures to the end so it doesn't hang a
 * piece in the middle of a swap.
 *   easy:   one move ahead (and the captures after it); now and then a casual move instead.
 *   normal: two moves ahead.
 *   hard:   three moves ahead, then a fourth if there's time.
 * It takes a person's pause to think, a little longer on a busy board.
 */
import { legalMoves, makeMove, inCheck, isWhite } from './chess-rules.js';

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Where each piece likes to stand (white's side, a1 first; black reads it mirrored).
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
};
// The king in the ending: to the middle.
const KING_END = [-50, -30, -30, -30, -30, -30, -30, -50, -30, -30, 0, 0, 0, 0, -30, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -20, -10, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50];
const MATE = 100000;
const LEVEL = { easy: { depth: 1, casual: 0.22, noise: 40 }, normal: { depth: 2, casual: 0, noise: 12 }, hard: { depth: 3, deeper: 4, casual: 0, noise: 4 } };
const BUDGET = 30000; // positions looked at, at most, per move (it keeps the server quick)

/** How good the position is for the side to move. */
export function evaluate(pos) {
  let score = 0;
  let queens = 0;
  let minors = 0;
  for (const p of pos.board) if (p) { const k = p.toLowerCase(); if (k === 'q') queens++; if (k === 'n' || k === 'b' || k === 'r') minors++; }
  const ending = queens === 0 || (queens <= 2 && minors <= 2);
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (!p) continue;
    const k = p.toLowerCase();
    const white = isWhite(p);
    const at = white ? sq : (7 - (sq >> 3)) * 8 + (sq & 7);
    const v = VALUE[k] + (k === 'k' && ending ? KING_END[at] : PST[k][at]);
    score += white ? v : -v;
  }
  return pos.turn === 'w' ? score : -score;
}

/** Captures first, the biggest prize by the smallest piece; then promotions. */
function order(pos, moves) {
  const key = (m) => {
    const victim = pos.board[m.to];
    let s = 0;
    if (victim || m.ep) s += 10 * VALUE[(victim || 'p').toLowerCase()] - VALUE[pos.board[m.from].toLowerCase()] / 10;
    if (m.promo) s += VALUE[m.promo];
    return s;
  };
  return moves.map((m) => [key(m), m]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

function search(pos, depth, alpha, beta, ply, st) {
  if (++st.nodes > st.budget) st.abort = true;
  if (st.abort) return 0;
  if (depth <= 0) return quiesce(pos, alpha, beta, 0, st);
  const moves = legalMoves(pos);
  if (!moves.length) return inCheck(pos) ? -MATE + ply : 0;
  if (pos.half >= 100) return 0;
  let best = -Infinity;
  for (const m of order(pos, moves)) {
    const v = -search(makeMove(pos, m), depth - 1, -beta, -alpha, ply + 1, st);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta || st.abort) break;
  }
  return best;
}

/** Only the captures, till it's quiet (so a half-finished swap isn't scored). */
function quiesce(pos, alpha, beta, d, st) {
  if (++st.nodes > st.budget) st.abort = true;
  const stand = evaluate(pos);
  if (stand >= beta || st.abort) return stand;
  if (stand > alpha) alpha = stand;
  if (d >= 4) return stand;
  const caps = legalMoves(pos).filter((m) => pos.board[m.to] || m.ep || m.promo);
  for (const m of order(pos, caps)) {
    const v = -quiesce(makeMove(pos, m), -beta, -alpha, d + 1, st);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/** The best move from `pos` at `level`, with how sure it is. */
export function bestMove(pos, level, rng = Math.random) {
  const L = LEVEL[level];
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  if (L.casual && rng() < L.casual) {
    // A casual move: any that doesn't just give a piece away for nothing.
    const st = { nodes: 0, budget: Infinity };
    const safe = moves.filter((m) => -quiesce(makeMove(pos, m), -Infinity, Infinity, 0, st) > evaluate(pos) - 150);
    const from = safe.length ? safe : moves;
    return from[Math.floor(rng() * from.length)];
  }
  // One move deeper at a time, best moves first; a search cut short by the budget is dropped and
  // the last whole one stands.
  const st = { nodes: 0, budget: BUDGET, abort: false };
  let list = order(pos, moves);
  for (let depth = 1; depth <= (L.deeper || L.depth); depth++) {
    const scored = [];
    let alpha = -Infinity;
    for (const m of list) {
      // (the window takes in every move within the noise of the best, so those get exact scores;
      // the rest only need to be shown worse)
      const v = -search(makeMove(pos, m), depth - 1, -Infinity, -(alpha - L.noise - 1), 1, st);
      if (st.abort) break;
      scored.push([v, m]);
      if (v > alpha) alpha = v;
    }
    if (st.abort) break;
    // (the noise only breaks near-ties: it never turns down a real gain)
    scored.forEach((x) => { x[0] += (rng() - 0.5) * L.noise; });
    scored.sort((a, b) => b[0] - a[0]);
    list = scored.map((x) => x[1]);
    if (depth >= L.depth && st.nodes > BUDGET / 4) break;
  }
  return list[0];
}

export function chessBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turnSlot !== view.you || !LEVEL[level] || !view.legal || !view.legal.length) return null;
  const pos = { board: view.board, turn: view.turn, castle: view.castle, ep: view.ep, half: view.half };
  const m = bestMove(pos, level, rng);
  if (!m) return null;
  // A person's pause: longer with more on the board, shorter with the clock low.
  const pieces = view.board.filter(Boolean).length;
  let pause = 900 + rng() * 1800 + pieces * 25;
  if (view.timed && view.banks[view.you] < 60000) pause = 400 + rng() * 600;
  const input = { type: 'move', from: m.from, to: m.to, botDelayMs: pause, botFor: view.game + ':' + view.moveCount };
  if (m.promo) input.promo = m.promo;
  return input;
}
