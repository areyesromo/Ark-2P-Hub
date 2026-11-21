/**
 * The computer for Mine Duel (see `bot` in index.js). It reads the numbers as a player does.
 *   easy:   sees a sure mine most of the time, not always (a number with just as many covered squares round
 *           it); otherwise digs somewhere near the numbers.
 *   normal: always takes a sure mine; otherwise digs where a mine is likeliest, one number at a time.
 *   hard:   also works out mines from two numbers together (what one has that the other hasn't).
 */
import { neighbours, MINE } from './mine-duel.js';

/** What each opened number says: its covered squares and how many mines are left among them. */
function constraints(board) {
  const out = [];
  for (let c = 0; c < board.length; c++) {
    const v = board[c];
    if (v === null || v >= MINE || v === 0) continue;
    const near = neighbours(c);
    const covered = near.filter((n) => board[n] === null);
    if (!covered.length) continue;
    const claimed = near.filter((n) => board[n] !== null && board[n] >= MINE).length;
    out.push({ cells: covered, mines: v - claimed });
  }
  return out;
}

/** Squares that must be mines (and ones that must be safe), from single numbers and, `pairs`, two together. */
function sure(list, pairs) {
  const mines = new Set();
  const safe = new Set();
  for (const k of list) {
    if (k.mines === k.cells.length) k.cells.forEach((c) => mines.add(c));
    if (k.mines === 0) k.cells.forEach((c) => safe.add(c));
  }
  if (pairs) {
    for (const a of list) {
      for (const b of list) {
        if (a === b || a.cells.length >= b.cells.length || !a.cells.every((c) => b.cells.includes(c))) continue;
        const rest = b.cells.filter((c) => !a.cells.includes(c));
        const left = b.mines - a.mines;
        if (left === rest.length) rest.forEach((c) => mines.add(c));
        if (left === 0) rest.forEach((c) => safe.add(c));
      }
    }
  }
  return { mines, safe };
}

export function mineDuelBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const board = view.board;
  const covered = [];
  for (let c = 0; c < board.length; c++) if (board[c] === null) covered.push(c);
  if (!covered.length) return null;
  const pace = 1100 + rng() * 1600;
  const dig = (cell) => ({ type: 'dig', cell, botDelayMs: pace });
  const list = constraints(board);
  const looks = level !== 'easy' || rng() < 0.7;
  const { mines, safe } = looks ? sure(list, level === 'hard') : { mines: new Set(), safe: new Set() };
  if (mines.size) {
    const pick = [...mines];
    return dig(pick[Math.floor(rng() * pick.length)]);
  }
  if (level === 'easy') {
    // Somewhere by the numbers (or anywhere, at first).
    const near = covered.filter((c) => list.some((k) => k.cells.includes(c)));
    const from = near.length && rng() < 0.7 ? near : covered;
    return dig(from[Math.floor(rng() * from.length)]);
  }
  // The likeliest mine: a square's chance from the numbers round it (the highest of them), the rest
  // at the field's average.
  const left = view.mines - view.found[0] - view.found[1];
  const chance = new Map();
  for (const k of list) for (const c of k.cells) chance.set(c, Math.max(chance.get(c) || 0, k.mines / k.cells.length));
  const average = left / covered.length;
  let best = -1;
  let pick = [];
  for (const c of covered) {
    if (safe.has(c)) continue;
    const p = chance.has(c) ? chance.get(c) : average;
    if (p > best + 1e-9) { best = p; pick = [c]; } else if (Math.abs(p - best) < 1e-9) pick.push(c);
  }
  if (!pick.length) pick = covered;
  return dig(pick[Math.floor(rng() * pick.length)]);
}
