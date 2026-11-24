/**
 * The computer for Nine Men's Morris (see `bot` in index.js). It looks ahead with alpha-beta over
 * whole turns (a move, and the piece it takes when that makes a mill), scoring pieces, mills half
 * made and room to move.
 *   easy:   one turn ahead; one turn in four just any move.
 *   normal: two turns ahead.
 *   hard:   four turns ahead (three while placing, when there's far more to choose from).
 */
import { actions, takeable, MILLS, NEIGHBOURS } from './morris.js';

const DEPTH = { easy: 1, normal: 2, hard: 4 };
const WIN = 1e6;

/** Whole turns for `slot`: each action, with every piece it could then take if it makes a mill. */
function turns(board, inHand, slot) {
  const who = slot + 1;
  const out = [];
  for (const a of actions(board, inHand, slot)) {
    const b = board.slice();
    const h = inHand.slice();
    let p;
    if (a.at !== undefined) { b[a.at] = who; h[slot]--; p = a.at; } else { b[a.from] = 0; b[a.to] = who; p = a.to; }
    const mill = MILLS.some((m) => m.includes(p) && m.every((q) => b[q] === who));
    if (!mill) { out.push({ a, take: null, board: b, inHand: h }); continue; }
    for (const t of takeable(b, 2 - slot)) {
      const bb = b.slice();
      bb[t] = 0;
      out.push({ a, take: t, board: bb, inHand: h });
    }
  }
  return out;
}

function evaluate(board, inHand, slot) {
  const me = slot + 1;
  const them = 3 - me;
  let s = 0;
  const mine = board.filter((v) => v === me).length + inHand[slot];
  const theirs = board.filter((v) => v === them).length + inHand[1 - slot];
  s += (mine - theirs) * 100;
  // Mills half made (two and a gap) and whole ones.
  for (const m of MILLS) {
    const vals = m.map((p) => board[p]);
    const a = vals.filter((v) => v === me).length;
    const b = vals.filter((v) => v === them).length;
    const e = vals.filter((v) => v === 0).length;
    if (a === 2 && e === 1) s += 18;
    if (b === 2 && e === 1) s -= 22;
    if (a === 3) s += 12;
    if (b === 3) s -= 12;
  }
  // Room to move.
  if (!inHand[0] && !inHand[1]) {
    let free = 0;
    for (let p = 0; p < 24; p++) if (board[p]) for (const q of NEIGHBOURS[p]) if (!board[q]) free += board[p] === me ? 1 : -1;
    s += free * 3;
  }
  return s;
}

function lost(board, inHand, slot) {
  if (inHand[slot] === 0 && board.filter((v) => v === slot + 1).length < 3) return true;
  return !actions(board, inHand, slot).length;
}

function search(board, inHand, slot, depth, alpha, beta) {
  if (lost(board, inHand, slot)) return -WIN - depth;
  if (depth === 0) return evaluate(board, inHand, slot);
  let best = -Infinity;
  const list = turns(board, inHand, slot);
  // Mills first: alpha-beta cuts more.
  list.sort((x, y) => (y.take !== null) - (x.take !== null));
  for (const t of list) {
    const v = -search(t.board, t.inHand, 1 - slot, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function morrisBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !DEPTH[level]) return null;
  const slot = view.you;
  const pace = (ms) => ms + rng() * ms * 0.8;
  const tag = view.round + ':' + (view.last ? view.last.n : 0) + view.step;
  // A mill made: take the piece it planned to (or the best one).
  if (view.step === 'take') {
    const t = memory.take !== undefined && view.takeable.includes(memory.take) ? memory.take : view.takeable[0];
    return { type: 'take', at: t, botDelayMs: pace(900), botFor: tag };
  }
  const list = turns(view.board, view.inHand, slot);
  if (!list.length) return null;
  let pick;
  if (level === 'easy' && rng() < 0.25) pick = list[Math.floor(rng() * list.length)];
  else {
    // (Hard: three turns ahead while placing, when there's much more to choose from)
    const depth = level === 'hard' && view.inHand[slot] > 0 ? 3 : DEPTH[level];
    let best = -Infinity;
    for (const t of list) {
      const v = -search(t.board, t.inHand, 1 - slot, depth - 1, -Infinity, Infinity) + rng() * (level === 'easy' ? 30 : 4);
      if (v > best) { best = v; pick = t; }
    }
  }
  memory.take = pick.take === null ? undefined : pick.take;
  const a = pick.a;
  const input = a.at !== undefined ? { type: 'place', at: a.at } : { type: 'move', from: a.from, to: a.to };
  return { ...input, botDelayMs: pace(1100), botFor: tag };
}
