/**
 * The computer for Hex (see `bot` in index.js). Hex has a lovely property: fill the board at random
 * and exactly one player has joined their edges. So the computer plays many random games from here
 * (fill every empty hexagon, turn about) and asks, for each empty hexagon, how often the games where
 * it got that hexagon were games it won. The best of those is its move.
 *   easy:   a few dozen random games, and now and then just a move near the middle.
 *   normal: a hundred or two; takes the swap when the first stone is well in from the edges.
 *   hard:   thousands; wins at once when it can, stops your winning stone, and keeps its
 *           "bridges" (two stones with two shared neighbours: if you take one, it takes the other).
 */
import { neighbours } from './hex.js';

const pace = (rng) => 900 + rng() * 1500;
const PLAYOUTS = { easy: 40, normal: 160, hard: 8000 };

/** Does `who` join their edges on a full board? (1: top to bottom, 2: left to right.) */
function joins(board, n, who, adj, seen, queue) {
  seen.fill(0);
  let tail = 0;
  for (let k = 0; k < n; k++) {
    const c = who === 1 ? k : k * n;
    if (board[c] === who) { seen[c] = 1; queue[tail++] = c; }
  }
  for (let i = 0; i < tail; i++) {
    const c = queue[i];
    if (who === 1 ? c >= n * (n - 1) : c % n === n - 1) return true;
    for (const m of adj[c]) if (!seen[m] && board[m] === who) { seen[m] = 1; queue[tail++] = m; }
  }
  return false;
}

/** For each empty cell: how often `me` won the random games in which `me` held it. */
export function rates(board, n, me, count, rng) {
  const adj = [];
  for (let c = 0; c < n * n; c++) adj.push(neighbours(c, n));
  const empty = [];
  board.forEach((v, c) => { if (!v) empty.push(c); });
  const held = new Float64Array(n * n);
  const won = new Float64Array(n * n);
  const b = new Int8Array(n * n);
  const seen = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  const order = empty.slice();
  for (let g = 0; g < count; g++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    for (let c = 0; c < n * n; c++) b[c] = board[c];
    order.forEach((c, i) => { b[c] = i % 2 === 0 ? me : 3 - me; }); // (we move first from here)
    const win = joins(b, n, me, adj, seen, queue);
    for (let i = 0; i < order.length; i += 2) {
      held[order[i]]++;
      if (win) won[order[i]]++;
    }
  }
  return empty.map((c) => [held[c] ? won[c] / held[c] : 0, c]);
}

/** A cell that wins for `who` at once, or null. */
function winning(board, n, who) {
  const adj = [];
  for (let c = 0; c < n * n; c++) adj.push(neighbours(c, n));
  const seen = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  for (let c = 0; c < n * n; c++) {
    if (board[c]) continue;
    board[c] = who;
    const w = joins(board, n, who, adj, seen, queue);
    board[c] = 0;
    if (w) return c;
  }
  return null;
}

/** If their last stone broke into one of our bridges, the other hexagon of it (else null). */
function saveBridge(board, n, me, last) {
  if (last === null || last === undefined) return null;
  const around = neighbours(last, n);
  for (const a of around) {
    if (board[a] !== me) continue;
    for (const b of around) {
      if (b === a || board[b] !== me || neighbours(a, n).includes(b)) continue;
      // a and b are ours, both touching their stone, not touching each other: the other shared
      // neighbour of a and b completes the bridge.
      const shared = neighbours(a, n).filter((c) => c !== last && neighbours(b, n).includes(c));
      if (shared.length === 1 && !board[shared[0]]) return shared[0];
    }
  }
  return null;
}

export function hexBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !PLAYOUTS[level]) return null;
  const n = view.size;
  const board = view.board.slice();
  const me = view.you + 1;
  const tag = view.round + ':' + (view.lastMove ? view.lastMove.n : 0);
  const move = (cell) => ({ type: 'place', cell, botDelayMs: pace(rng), botFor: tag });
  if (view.canSwap && level !== 'easy') {
    const c = view.lastMove.cell;
    const x = c % n;
    const y = Math.floor(c / n);
    if (Math.min(x, y, n - 1 - x, n - 1 - y) >= 2) return { type: 'swap', botDelayMs: pace(rng), botFor: tag };
  }
  if (level === 'hard') {
    const now = winning(board, n, me);
    if (now !== null) return move(now);
    const theirs = winning(board, n, 3 - me);
    if (theirs !== null) return move(theirs);
    const keep = saveBridge(board, n, me, view.lastMove && view.lastMove.by !== view.you ? view.lastMove.cell : null);
    if (keep !== null) return move(keep);
  }
  if (level === 'easy' && rng() < 0.2) {
    // A hunch: any empty hexagon near the middle.
    const mid = (n - 1) / 2;
    const near = [];
    board.forEach((v, c) => { if (!v && Math.abs((c % n) - mid) + Math.abs(Math.floor(c / n) - mid) <= n / 2) near.push(c); });
    if (near.length) return move(near[Math.floor(rng() * near.length)]);
  }
  const list = rates(board, n, me, PLAYOUTS[level], rng);
  let best = list[0];
  for (const x of list) if (x[0] > best[0] || (x[0] === best[0] && rng() < 0.3)) best = x;
  return move(best[1]);
}
