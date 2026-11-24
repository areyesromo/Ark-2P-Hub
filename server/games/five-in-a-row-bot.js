/**
 * The computer for Five in a Row (see `bot` in index.js). For each empty square near the stones it
 * scores the lines it would make for itself (attack) and the lines it would stop of yours (defence):
 * a five, an open four, a four, an open three and so on, a square making two threats at once worth
 * more than either. Then it plays the best square.
 *   easy:   wins when it can and stops your five, but now and then misses your open fours and
 *           threes coming; a bit of chance in its choice.
 *   normal: makes and stops open fours (two ways to finish: unstoppable), then the best square.
 *   hard:   weighs defence fully, and checks its move leaves you no unstoppable four.
 */
import { SIZE, capturesAt, lineAt } from './five-in-a-row.js';


const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
// A window of five squares in a line holding n of one player's stones (and none of the other's).
const WINDOW = [0, 4, 60, 1500, 40000, 1e7];
const FOUR = WINDOW[4];

/**
 * How good `cell` would be for `who`: every five-square window through it that `who` could still
 * fill, scored by how many of `who`'s stones it would then hold. Split shapes (X X _ X) count, and
 * a square that builds in two directions scores in both.
 */
export function shapeScore(board, cell, who) {
  const x0 = cell % SIZE;
  const y0 = Math.floor(cell / SIZE);
  let total = 0;
  let threats = 0;
  for (const [dx, dy] of DIRS) {
    let best = 0;
    for (let start = -4; start <= 0; start++) {
      let mine = 1;
      let ok = true;
      for (let k = 0; k < 5; k++) {
        const x = x0 + dx * (start + k);
        const y = y0 + dy * (start + k);
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) { ok = false; break; }
        const v = board[y * SIZE + x];
        if (start + k === 0) continue;
        if (v === who) mine++;
        else if (v !== 0) { ok = false; break; }
      }
      if (!ok) continue;
      total += WINDOW[mine];
      if (mine > best) best = mine;
    }
    if (best >= 3) threats++;
  }
  if (threats >= 2) total += FOUR * 0.5; // (two lines growing at once: hard to stop both)
  return total;
}

/** Empty squares within two of a stone. */
function candidates(board) {
  const out = [];
  let any = false;
  for (let c = 0; c < board.length; c++) {
    if (board[c]) { any = true; continue; }
    const x = c % SIZE;
    const y = Math.floor(c / SIZE);
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny * SIZE + nx]) near = true;
    }
    if (near) out.push(c);
  }
  return any ? out : [Math.floor((SIZE * SIZE) / 2)];
}

/** The squares worth trying for the side to move, best first: attack plus defence. */
function ranked(board, who, rng, level, sees) {
  const them = 3 - who;
  const defence = level === 'easy' ? 0.5 : level === 'normal' ? 0.85 : 1;
  return candidates(board).map((c) => {
    const mine = shapeScore(board, c, who);
    let theirs = shapeScore(board, c, them);
    // Easy always stops a four (or a five), but your threes only when it notices.
    if (!sees && theirs < FOUR) theirs *= 0.15;
    const x = c % SIZE;
    const y = Math.floor(c / SIZE);
    let s = mine + theirs * defence + 6 - (Math.abs(x - 7) + Math.abs(y - 7)) * 0.4;
    s *= 1 + (rng() - 0.5) * (level === 'easy' ? 0.5 : level === 'normal' ? 0.12 : 0.03);
    return [s, c, mine];
  }).sort((p, q) => q[0] - p[0]);
}

/** After `who` plays `c`: how many different empty squares would then complete five (2+: it can't be stopped). */
function wins(board, c, who) {
  board[c] = who;
  const spots = new Set();
  const x0 = c % SIZE;
  const y0 = Math.floor(c / SIZE);
  for (const [dx, dy] of DIRS) {
    for (let k = -4; k <= 4; k++) {
      const x = x0 + dx * k;
      const y = y0 + dy * k;
      if (k === 0 || x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const e = y * SIZE + x;
      if (board[e]) continue;
      board[e] = who;
      if (lineAt(board, e)) spots.add(e);
      board[e] = 0;
    }
  }
  board[c] = 0;
  return spots.size;
}

/**
 * The square to play by the rules strong players follow, or null when none applies: win; stop their
 * five; make a four with two ways to finish (it can't be stopped); stop theirs. `skip` (Easy): the
 * last two it sometimes misses.
 */
function forced(board, me, list, skip) {
  const them = 3 - me;
  const cells = list.map((x) => x[1]);
  for (const c of cells) { board[c] = me; const w = lineAt(board, c); board[c] = 0; if (w) return c; }
  for (const c of cells) { board[c] = them; const w = lineAt(board, c); board[c] = 0; if (w) return c; }
  if (!skip) {
    for (const c of cells) if (wins(board, c, me) >= 2) return c;
    // Their open four next move: take the square that stops it (the best-scoring one if several).
    for (const c of cells) if (wins(board, c, them) >= 2) return c;
  }
  return null;
}

export function fiveInARowBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const board = view.board.slice();
  const me = view.you + 1;
  const sees = level !== 'easy' || rng() < 0.55; // (Easy notices your threes only some of the time)
  const list = ranked(board, me, rng, level, sees);
  if (view.captures) for (const x of list) x[0] += capturesAt(board, x[1], me).length * 900;
  list.sort((p, q) => q[0] - p[0]);
  let pick = forced(board, me, list.slice(0, 40), level === 'easy' && !sees);
  if (pick === null) {
    pick = list[0][1];
    if (level === 'hard') {
      // Of its best few, the first after which you have no unstoppable four to make.
      for (const [, c] of list.slice(0, 6)) {
        board[c] = me;
        const theirs = ranked(board, 3 - me, rng, 'hard', true).slice(0, 12);
        const bad = theirs.some((t) => wins(board, t[1], 3 - me) >= 2);
        board[c] = 0;
        if (!bad) { pick = c; break; }
      }
    }
  }
  const pace = 700 + rng() * 1500;
  return { type: 'place', cell: pick, botDelayMs: pace, botFor: view.round + ':' + (view.lastMove ? view.lastMove.n : 0) };
}
