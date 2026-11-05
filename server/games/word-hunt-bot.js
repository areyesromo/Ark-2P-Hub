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
  // A word still free, wherever it is on the grid (the first spelled out from its first letter).
  const word = left[Math.floor(rng() * left.length)].word;
  const at = locate(view.grid, view.n, word);
  if (!at) return null;
  const [lo, hi] = PACE[level];
  return { type: 'mark', a: at[0], b: at[1], botDelayMs: lo + rng() * (hi - lo) };
}

/** Where `word` reads in a straight line on the grid: [first cell, last cell], or null. */
export function locate(grid, n, word) {
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (grid[y * n + x] !== word[0]) continue;
      for (const [dx, dy] of STEPS) {
        const ex = x + dx * (word.length - 1);
        const ey = y + dy * (word.length - 1);
        if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
        let k = 1;
        while (k < word.length && grid[(y + dy * k) * n + x + dx * k] === word[k]) k++;
        if (k === word.length) return [y * n + x, ey * n + ex];
      }
    }
  }
  return null;
}
