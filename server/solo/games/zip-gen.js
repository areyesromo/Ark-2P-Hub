// Zip's boards: an n × n grid with numbered squares (1, 2, 3 …) and maybe a few walls between
// squares. The answer is one path, square to square across or down (never through a wall), that
// starts on 1, meets the numbers in order, ends on the last one, and covers every square once.
// Every board made here has exactly one answer.
//
// How a board is made: a random path over the whole grid (start from a snake back and forth, then
// "backbite" it many times: join one end to a neighbour on the path and flip the loop that makes),
// number its two ends, then look for a second answer. While there is one, put a number on the
// first square where the real path and the other one part ways, which rules the other one out.
// Last, take away any number in the middle that isn't needed after all.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A wall between squares a and b, as a key ('a,b' with a < b). */
export const wallKey = (a, b) => Math.min(a, b) + ',' + Math.max(a, b);

/** The squares next to i that a step can reach (not through a wall). */
export function stepsFrom(n, i, walls) {
  const x = i % n;
  const y = Math.floor(i / n);
  const out = [];
  for (const [dx, dy] of DIRS) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
    const j = yy * n + xx;
    if (walls && walls.has(wallKey(i, j))) continue;
    out.push(j);
  }
  return out;
}

/** A random path covering the whole grid (a Hamiltonian path), as a list of squares. */
export function randomPath(n, rng, moves = n * n * 30) {
  let path = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) path.push(y * n + (y % 2 ? n - 1 - x : x));
  for (let k = 0; k < moves; k++) {
    if (rng() < 0.5) path.reverse();
    // Backbite at the end: step to a neighbour already on the path, reverse the stretch after it.
    const end = path[path.length - 1];
    const nb = stepsFrom(n, end, null);
    const j = nb[Math.floor(rng() * nb.length)];
    const at = path.indexOf(j);
    if (at === path.length - 2) continue;
    path = path.slice(0, at + 1).concat(path.slice(at + 1).reverse());
  }
  return path;
}

/**
 * Walks the answers of a board, up to `limit`. numbers: Map square → its number (1 … last).
 * Returns the answers found (each a list of squares).
 */
export function findAnswers(n, numbers, walls, limit = 2) {
  const size = n * n;
  const last = Math.max(...numbers.values());
  let start = -1;
  let end = -1;
  for (const [cell, k] of numbers) {
    if (k === 1) start = cell;
    if (k === last) end = cell;
  }
  const nbrs = Array.from({ length: size }, (_, i) => stepsFrom(n, i, walls));
  const used = new Uint8Array(size);
  const path = [start];
  used[start] = 1;
  const found = [];
  const seen = new Uint8Array(size);
  // The squares still free are all reachable from the head, and no free square is a dead end
  // (fewer than two ways in) except the last number.
  const healthy = (head) => {
    let free = 0;
    for (let i = 0; i < size; i++) {
      if (used[i]) continue;
      free++;
      if (i === end) continue;
      let ways = 0;
      for (const j of nbrs[i]) if (!used[j] || j === head) ways++;
      if (ways < 2) return false;
    }
    if (!free) return true;
    seen.fill(0);
    const stack = [];
    for (const j of nbrs[head]) if (!used[j]) { stack.push(j); seen[j] = 1; }
    let reached = 0;
    while (stack.length) {
      const i = stack.pop();
      reached++;
      for (const j of nbrs[i]) if (!used[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    return reached === free;
  };
  const go = (next) => {
    if (found.length >= limit) return;
    const head = path[path.length - 1];
    if (path.length === size) {
      if (head === end) found.push(path.slice());
      return;
    }
    if (head === end) return;
    for (const j of nbrs[head]) {
      if (used[j]) continue;
      const k = numbers.get(j);
      if (k !== undefined && k !== next) continue;
      used[j] = 1;
      path.push(j);
      if (healthy(j)) go(k !== undefined ? next + 1 : next);
      path.pop();
      used[j] = 0;
      if (found.length >= limit) return;
    }
  };
  if (start >= 0 && end >= 0) go(2);
  return found;
}

/** Whether a path meets the numbers in order (1, 2, 3 … the last). */
export function keepsOrder(path, numbers) {
  let next = 1;
  for (const c of path) {
    const k = numbers.get(c);
    if (k === undefined) continue;
    if (k !== next) return false;
    next++;
  }
  return next === numbers.size + 1;
}

/**
 * A board: { n, numbers: [[square, number], …], walls: [[a, b], …], answer }.
 * opts.walls: how many walls to try (on joins the path doesn't use); opts.extra: numbers to add
 * once it has the fewest it needs (more numbers, an easier board).
 */
export function makeBoard(n, rng, opts = {}) {
  const answer = randomPath(n, rng);
  const size = n * n;
  const on = new Map(answer.map((c, i) => [c, i]));
  // Walls, on joins between squares the path doesn't step across.
  const walls = new Set();
  const wanted = opts.walls || 0;
  for (let tries = 0; walls.size < wanted && tries < wanted * 20; tries++) {
    const a = Math.floor(rng() * size);
    const nb = stepsFrom(n, a, null);
    const b = nb[Math.floor(rng() * nb.length)];
    if (Math.abs(on.get(a) - on.get(b)) === 1) continue;
    walls.add(wallKey(a, b));
  }
  // Waypoints, by their place along the answer.
  const marks = new Set([0, size - 1]);
  const numbersOf = (set) => {
    const order = [...set].sort((a, b) => a - b);
    return new Map(order.map((idx, k) => [answer[idx], k + 1]));
  };
  for (;;) {
    const answers = findAnswers(n, numbersOf(marks), walls, 2);
    const other = answers.find((p) => p.some((c, i) => c !== answer[i]));
    if (!other) break;
    // Numbers where they part ways, until the other path meets them out of order (one number on
    // its own is always in order between the first and the last, so it can take a few).
    for (let i = 0; i < size && keepsOrder(other, numbersOf(marks)); i++) {
      if (other[i] !== answer[i]) marks.add(i);
    }
  }
  // Any middle number it can do without; then opts.extra more, to make it easier.
  const middle = [...marks].filter((i) => i !== 0 && i !== size - 1).sort(() => rng() - 0.5);
  for (const idx of middle) {
    marks.delete(idx);
    if (findAnswers(n, numbersOf(marks), walls, 2).length !== 1) marks.add(idx);
  }
  for (let k = 0; k < (opts.extra || 0); k++) marks.add(1 + Math.floor(rng() * (size - 2)));
  const numbers = [...numbersOf(marks)].sort((a, b) => a[1] - b[1]);
  return { n, numbers, walls: [...walls].map((k) => k.split(',').map(Number)), answer };
}
