// Tango's boards: an n × n grid (n even) of suns (1) and moons (2). No three alike in a line across
// or down, as many suns as moons in every row and column, and some pairs of side-by-side squares
// carry a sign: = (the same) or × (different). A few squares are given.
//
// Every board made here can be solved by reasoning one row or column at a time (what a person
// does: "only one way to finish this row keeps the rule"), so it has exactly one answer and never
// needs a guess. How a board is made: fill a whole legal grid (the answer), sprinkle signs that
// fit it, then take given squares away, in a random order, as long as the board still solves.

export const SUN = 1;
export const MOON = 2;

const patternCache = new Map();

/** Every legal line of length n: half suns, half moons, no three alike in a row. */
export function patterns(n) {
  if (patternCache.has(n)) return patternCache.get(n);
  const out = [];
  const line = new Array(n);
  const go = (i, suns, moons) => {
    if (i === n) return out.push(line.slice());
    for (const v of [SUN, MOON]) {
      if ((v === SUN ? suns : moons) === n / 2) continue;
      if (i >= 2 && line[i - 1] === v && line[i - 2] === v) continue;
      line[i] = v;
      go(i + 1, suns + (v === SUN), moons + (v === MOON));
    }
  };
  go(0, 0, 0);
  patternCache.set(n, out);
  return out;
}

/** The cells of each row and column, in order (rows first). */
export function linesOf(n) {
  const out = [];
  for (let y = 0; y < n; y++) out.push(Array.from({ length: n }, (_, x) => y * n + x));
  for (let x = 0; x < n; x++) out.push(Array.from({ length: n }, (_, y) => y * n + x));
  return out;
}

/** Signs as a lookup: key 'a,b' (a < b) → '=' or 'x'. */
const signMap = (signs) => new Map(signs.map(([a, b, s]) => [Math.min(a, b) + ',' + Math.max(a, b), s]));

/**
 * Solves a board by line logic alone: for each row and column, every legal way to fill it that
 * fits what's known (and the signs inside it) is tried; a square that's the same in all of them is
 * set. Signs across lines pass a value over. Repeats until nothing changes.
 * Returns { grid, solved, broken }: broken when some line has no legal filling.
 */
export function lineSolve(n, givens, signs) {
  const grid = givens.slice();
  const lines = linesOf(n);
  const all = patterns(n);
  const sm = signMap(signs);
  const pairs = signs.map(([a, b, s]) => [Math.min(a, b), Math.max(a, b), s]);
  let changed = true;
  while (changed) {
    changed = false;
    // Signs: one side known gives the other.
    for (const [a, b, s] of pairs) {
      for (const [p, q] of [[a, b], [b, a]]) {
        if (grid[p] && !grid[q]) {
          grid[q] = s === '=' ? grid[p] : 3 - grid[p];
          changed = true;
        } else if (grid[p] && grid[q] && (s === '=') !== (grid[p] === grid[q])) return { grid, solved: false, broken: true };
      }
    }
    for (const cells of lines) {
      if (cells.every((c) => grid[c])) continue;
      let common = null;
      for (const pat of all) {
        let ok = true;
        for (let i = 0; i < n && ok; i++) {
          const v = grid[cells[i]];
          if (v && v !== pat[i]) ok = false;
          else if (i > 0) {
            const s = sm.get(cells[i - 1] + ',' + cells[i]);
            if (s && (s === '=') !== (pat[i - 1] === pat[i])) ok = false;
          }
        }
        if (!ok) continue;
        if (!common) common = pat.slice();
        else for (let i = 0; i < n; i++) if (common[i] !== pat[i]) common[i] = 0;
      }
      if (!common) return { grid, solved: false, broken: true };
      for (let i = 0; i < n; i++) {
        if (common[i] && !grid[cells[i]]) {
          grid[cells[i]] = common[i];
          changed = true;
        }
      }
    }
  }
  return { grid, solved: grid.every(Boolean), broken: false };
}

/**
 * How many answers a board has, up to `limit` (a plain search, for the tests: the boards are
 * made with lineSolve, which never guesses).
 */
export function countAnswers(n, givens, signs, limit = 2) {
  let count = 0;
  const go = (grid) => {
    if (count >= limit) return;
    const r = lineSolve(n, grid, signs);
    if (r.broken) return;
    if (r.solved) { count++; return; }
    const i = r.grid.indexOf(0);
    for (const v of [SUN, MOON]) {
      const next = r.grid.slice();
      next[i] = v;
      go(next);
    }
  };
  go(givens.slice());
  return count;
}

/** A whole legal grid, at random. */
export function fullGrid(n, rng) {
  const lines = patterns(n);
  const rows = [];
  // Row by row: a random legal row that keeps every column able to finish.
  const go = () => {
    if (rows.length === n) return true;
    const order = lines.map((l) => [rng(), l]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    for (const row of order) {
      const y = rows.length;
      let ok = true;
      for (let x = 0; x < n && ok; x++) {
        const v = row[x];
        const count = rows.filter((r) => r[x] === v).length + 1;
        if (count > n / 2) ok = false;
        else if (y >= 2 && rows[y - 1][x] === v && rows[y - 2][x] === v) ok = false;
      }
      if (!ok) continue;
      rows.push(row);
      if (go()) return true;
      rows.pop();
    }
    return false;
  };
  go();
  return rows.flat();
}

/**
 * A board: { n, givens, signs, answer }. opts.signs: how many signs (default about n);
 * opts.keep: given squares to leave in at least (default 0: as few as it can).
 */
export function makeBoard(n, rng, opts = {}) {
  const answer = fullGrid(n, rng);
  const shuffle = (list) => list.map((x) => [rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  // Signs that fit the answer, on random side-by-side pairs.
  const pairs = [];
  for (let i = 0; i < n * n; i++) {
    if (i % n < n - 1) pairs.push([i, i + 1]);
    if (i + n < n * n) pairs.push([i, i + n]);
  }
  const want = opts.signs === undefined ? n : opts.signs;
  const signs = shuffle(pairs).slice(0, want).map(([a, b]) => [a, b, answer[a] === answer[b] ? '=' : 'x']);
  // Take givens away while it still solves by line logic.
  const givens = answer.slice();
  let left = n * n;
  for (const i of shuffle([...Array(n * n).keys()])) {
    if (left <= (opts.keep || 0)) break;
    const v = givens[i];
    givens[i] = 0;
    if (lineSolve(n, givens, signs).solved) left--;
    else givens[i] = v;
  }
  // Then any sign it doesn't need.
  let kept = signs;
  for (const s of shuffle(signs)) {
    const without = kept.filter((x) => x !== s);
    if (lineSolve(n, givens, without).solved) kept = without;
  }
  return { n, givens, signs: kept, answer };
}
