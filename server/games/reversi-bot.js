/**
 * The computer opponent for Reversi (see `bot` in index.js). It scores a board by where the discs
 * are (corners are gold, the squares next to an empty corner give it away) and by how many moves
 * each side has, and looks ahead with alpha-beta.
 *   easy:   one move ahead, by where the disc goes; now and then (one move in ten) just any move.
 *   normal: three moves ahead.
 *   hard:   four moves ahead, and the last nine empty squares played out to the end (most discs).
 */
import { SIZE, flipsFor, legalMoves } from './reversi.js';

const DEPTH = { easy: 1, normal: 3, hard: 4 };
const END = 1e5;

// Where a disc is worth having: corners best, the squares touching a corner worst.
const W = [
  100, -25, 10, 5, 5, 10, -25, 100,
  -25, -40, -2, -2, -2, -2, -40, -25,
  10, -2, 2, 1, 1, 2, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 2, 1, 1, 2, -2, 10,
  -25, -40, -2, -2, -2, -2, -40, -25,
  100, -25, 10, 5, 5, 10, -25, 100,
];
const CORNERS = [[0, 1, 8, 9], [7, 6, 15, 14], [56, 57, 48, 49], [63, 62, 55, 54]];

export function reversiBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !DEPTH[level] || !view.legal || !view.legal.length) return null;
  const board = view.board.slice();
  const me = view.you + 1;
  const moves = view.legal.slice();
  const empty = board.filter((v) => !v).length;
  const pace = (level === 'easy' ? 900 : 700) + rng() * 1100;
  if (level === 'easy' && rng() < 0.1) return { type: 'place', cell: moves[Math.floor(rng() * moves.length)], botDelayMs: pace };
  const depth = level === 'hard' && empty <= 9 ? empty : DEPTH[level];
  const exact = level === 'hard' && empty <= 9;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const c of order(moves)) {
    const flips = play(board, c, me);
    const score = -negamax(board, depth - 1, 3 - me, -Infinity, Infinity, exact, false);
    undo(board, c, flips, me);
    const s = score + rng() * (level === 'easy' ? 6 : 0.5);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return { type: 'place', cell: best, botDelayMs: pace };
}

/** Corners first, then the rest by the table: good moves first make alpha-beta cut more. */
function order(moves) {
  return moves.slice().sort((a, b) => W[b] - W[a]);
}

function play(board, c, who) {
  const flips = flipsFor(board, c, who);
  board[c] = who;
  for (const f of flips) board[f] = who;
  return flips;
}

function undo(board, c, flips, who) {
  board[c] = 0;
  for (const f of flips) board[f] = 3 - who;
}

/** The best `who` can make of this board, `depth` moves on (`passed`: the last turn was a pass). */
function negamax(board, depth, who, alpha, beta, exact, passed) {
  const moves = legalMoves(board, who);
  if (!moves.length) {
    if (passed) return final(board, who); // neither can move: the game's over
    return -negamax(board, depth, 3 - who, -beta, -alpha, exact, true);
  }
  if (depth <= 0) return exact ? final(board, who) : evaluate(board, who, moves.length);
  let best = -Infinity;
  for (const c of order(moves)) {
    const flips = play(board, c, who);
    const score = -negamax(board, depth - 1, 3 - who, -beta, -alpha, exact, false);
    undo(board, c, flips, who);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** A finished board: a win is worth more than anything, by how many discs. */
function final(board, who) {
  let d = 0;
  for (const v of board) if (v) d += v === who ? 1 : -1;
  return d > 0 ? END + d : d < 0 ? -END + d : 0;
}

function evaluate(board, who, myMoves) {
  let s = 0;
  for (let c = 0; c < SIZE * SIZE; c++) {
    const v = board[c];
    if (!v) continue;
    let w = W[c];
    // Once a corner is taken, the squares next to it are no longer a giveaway.
    for (const [corner, ...near] of CORNERS) if (board[corner] && near.includes(c)) w = 4;
    s += v === who ? w : -w;
  }
  // Having moves (and leaving them few) matters as much as where the discs are.
  const theirs = legalMoves(board, 3 - who).length;
  return s + 6 * (myMoves - theirs);
}
