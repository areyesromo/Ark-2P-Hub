// The rules of Go, for server/games/go.js and its computer player. A board is a flat array of
// n * n points: 0 empty, 1 black, 2 white. Written to be quick, since the computer plays thousands
// of random games from a position.

/** The neighbours of every point, for an n x n board (cached). */
const NEIGHBOURS = new Map();
export function neighboursOf(n) {
  if (!NEIGHBOURS.has(n)) {
    const list = [];
    for (let c = 0; c < n * n; c++) {
      const x = c % n;
      const y = (c - x) / n;
      const out = [];
      if (x > 0) out.push(c - 1);
      if (x < n - 1) out.push(c + 1);
      if (y > 0) out.push(c - n);
      if (y < n - 1) out.push(c + n);
      list.push(out);
    }
    NEIGHBOURS.set(n, list);
  }
  return NEIGHBOURS.get(n);
}

const mark = { stamp: 0, seen: new Int32Array(0) };
function fresh(size) {
  if (mark.seen.length < size) mark.seen = new Int32Array(size);
  if (++mark.stamp > 2e9) { mark.seen.fill(0); mark.stamp = 1; }
  return mark.stamp;
}

/** The stones of the group at `c`, and whether it has any liberty other than `except`. */
export function groupAt(board, nb, c, stones) {
  const colour = board[c];
  const stamp = fresh(board.length);
  stones.length = 0;
  stones.push(c);
  mark.seen[c] = stamp;
  let libs = 0;
  for (let i = 0; i < stones.length; i++) {
    for (const m of nb[stones[i]]) {
      if (mark.seen[m] === stamp) continue;
      mark.seen[m] = stamp;
      if (board[m] === 0) libs++;
      else if (board[m] === colour) stones.push(m);
    }
  }
  return libs;
}

const scratch = [];

/**
 * Plays `colour` at `c` in place if it's legal (empty, not the ko point, not suicide). Returns the
 * number of stones taken (0 or more), or -1 if the move isn't allowed (the board is unchanged).
 * `out.ko`: the new ko point (or -1).
 */
export function play(board, nb, c, colour, ko, out) {
  if (board[c] !== 0 || c === ko) return -1;
  const enemy = 3 - colour;
  board[c] = colour;
  let taken = 0;
  let lastTaken = -1;
  for (const m of nb[c]) {
    if (board[m] !== enemy) continue;
    if (groupAt(board, nb, m, scratch) === 0) {
      for (const s of scratch) board[s] = 0;
      taken += scratch.length;
      lastTaken = scratch[0];
    }
  }
  if (!taken && groupAt(board, nb, c, scratch) === 0) {
    board[c] = 0; // suicide
    return -1;
  }
  // A single stone taking a single stone, and itself left alone with one liberty: a ko.
  out.ko = -1;
  if (taken === 1) {
    const libs = groupAt(board, nb, c, scratch);
    if (libs === 1 && scratch.length === 1) out.ko = lastTaken;
  }
  return taken;
}

/** Is `c` an eye of `colour` (every neighbour theirs, and most of the diagonals)? Filling one is foolish. */
export function isEye(board, n, nb, c, colour) {
  if (board[c] !== 0) return false;
  for (const m of nb[c]) if (board[m] !== colour) return false;
  const x = c % n;
  const y = (c - x) / n;
  let bad = 0;
  let edge = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) { edge = 1; continue; }
    if (board[ny * n + nx] === 3 - colour) bad++;
  }
  return edge ? bad === 0 : bad <= 1;
}

/** Area score on a settled board: stones plus empty points reached only by that colour. [black, white]. */
export function areaScore(board, n, nb) {
  const score = [0, 0, 0];
  const stamp = fresh(board.length);
  const region = [];
  for (let c = 0; c < board.length; c++) {
    if (board[c]) { score[board[c]]++; continue; }
    if (mark.seen[c] === stamp) continue;
    region.length = 0;
    region.push(c);
    mark.seen[c] = stamp;
    let touches = 0;
    for (let i = 0; i < region.length; i++) {
      for (const m of nb[region[i]]) {
        if (board[m]) touches |= board[m];
        else if (mark.seen[m] !== stamp) { mark.seen[m] = stamp; region.push(m); }
      }
    }
    if (touches === 1 || touches === 2) score[touches] += region.length;
  }
  return [score[1], score[2]];
}

/**
 * Plays random moves (never filling an own eye) from `board` until neither side can move: a
 * "random game". Returns the finished board. `toMove`: who moves first; `rng`.
 */
export function randomGame(board, n, toMove, ko, rng, firstMoves) {
  const nb = neighboursOf(n);
  const b = Int8Array.from(board);
  const out = { ko };
  const empty = [];
  let passes = 0;
  let colour = toMove;
  let moves = 0;
  while (passes < 2 && moves < n * n * 3) {
    empty.length = 0;
    for (let c = 0; c < b.length; c++) if (!b[c]) empty.push(c);
    let played = false;
    // Try empty points in random order until one is legal (and not our own eye).
    for (let k = empty.length; k > 0; k--) {
      const i = Math.floor(rng() * k);
      const c = empty[i];
      empty[i] = empty[k - 1];
      if (isEye(b, n, nb, c, colour)) continue;
      if (play(b, nb, c, colour, out.ko, out) >= 0) {
        played = true;
        if (firstMoves && !firstMoves.has(c)) firstMoves.set(c, colour);
        break;
      }
    }
    if (played) { passes = 0; moves++; } else { passes++; out.ko = -1; }
    colour = 3 - colour;
  }
  return b;
}

/**
 * Which points each colour ends up owning, from `games` random games: owner[c] from -1 (always
 * white's) to 1 (always black's). Used to find dead stones at the end.
 */
export function ownership(board, n, toMove, games, rng) {
  const nb = neighboursOf(n);
  const own = new Float64Array(board.length);
  for (let g = 0; g < games; g++) {
    const b = randomGame(board, n, toMove, -1, rng);
    // Empty points count for whoever surrounds them.
    for (let c = 0; c < b.length; c++) {
      let who = b[c];
      if (!who) {
        let t = 0;
        for (const m of nb[c]) t |= b[m];
        who = t === 1 || t === 2 ? t : 0;
      }
      if (who === 1) own[c] += 1; else if (who === 2) own[c] -= 1;
    }
  }
  for (let c = 0; c < own.length; c++) own[c] /= games;
  return own;
}

/** The board with dead stones taken off (stones that random games say belong to the other side). */
export function removeDead(board, n, toMove, rng, games = 160) {
  const own = ownership(board, n, toMove, games, rng);
  const out = Array.from(board);
  const dead = [];
  for (let c = 0; c < out.length; c++) {
    if (out[c] === 1 && own[c] < -0.4) { out[c] = 0; dead.push(c); }
    else if (out[c] === 2 && own[c] > 0.4) { out[c] = 0; dead.push(c); }
  }
  return { board: out, dead };
}
