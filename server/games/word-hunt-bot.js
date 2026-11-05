/**
 * The computer opponent for Word Hunt (see `bot` in index.js). It hunts the grid for the words on
 * the list, as you do (it can't see where they're hidden), and marks one it finds after a while.
 *   easy:   about 25 to 45 s a word.   normal: 14 to 26 s.   hard: 7 to 14 s.
 */
const PACE = { easy: [25000, 45000], normal: [14000, 26000], hard: [7000, 14000] };
const STEPS = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];

export function wordHuntBot(view, level, rng = Math.random) {
  if (!view || !PACE[level] || view.phase !== 'play' || !view.grid || view.mode === 'race') return null;
  const left = view.words.filter((x) => x.by === null);
  if (!left.length) return null;
  // A word still free, and one of the places it reads (it can read twice by chance: only the
  // hidden one counts, so a refused one isn't always tried again).
  const word = left[Math.floor(rng() * left.length)].word;
  const all = locate(view.grid, view.n, word);
  if (!all.length) return null;
  const at = all[Math.floor(rng() * all.length)];
  const [lo, hi] = PACE[level];
  return { type: 'mark', a: at[0], b: at[1], botDelayMs: lo + rng() * (hi - lo) };
}

/** Everywhere `word` reads in a straight line on the grid: [[first cell, last cell], ...]. */
export function locate(grid, n, word) {
  const out = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (grid[y * n + x] !== word[0]) continue;
      for (const [dx, dy] of STEPS) {
        const ex = x + dx * (word.length - 1);
        const ey = y + dy * (word.length - 1);
        if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
        let k = 1;
        while (k < word.length && grid[(y + dy * k) * n + x + dx * k] === word[k]) k++;
        if (k === word.length) out.push([y * n + x, ey * n + ex]);
      }
    }
  }
  return out;
}
