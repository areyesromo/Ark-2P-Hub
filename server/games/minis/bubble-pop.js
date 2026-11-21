// Bubble Pop: one grid of bubbles on the TV and both phones, in your two colours plus gold and grey.
// Tap a clump of two or more touching bubbles of your colour to pop it: a point a bubble (gold
// ones go with any colour and count double; six or more, three extra). The bubbles above fall and
// new ones drop in. Popping a clump of their colour costs you a point, but it's gone for them too;
// grey clumps just clear the way. Most points at time up wins.
export const COLS = 7;
export const ROWS = 9;
export const GOLD = 2;
export const GREY = 3;
export const COOLDOWN_MS = 250;
export const BIG = 6; // a clump this size or more: BIG_BONUS extra
export const BIG_BONUS = 3;
const DURATION_MS = 45000;

/** The clump `cell` belongs to: touching bubbles of its colour (gold joins either player's colour). */
export function clump(kinds, cell) {
  const k = kinds[cell];
  if (k === GOLD || k === undefined || k === null) return [];
  const fits = (j) => kinds[j] === k || (k !== GREY && kinds[j] === GOLD);
  const seen = new Set([cell]);
  const todo = [cell];
  while (todo.length) {
    const c = todo.pop();
    const x = c % COLS;
    const near = [c - COLS, c + COLS, x > 0 ? c - 1 : -1, x < COLS - 1 ? c + 1 : -1];
    for (const n of near) if (n >= 0 && n < kinds.length && !seen.has(n) && fits(n)) { seen.add(n); todo.push(n); }
  }
  return [...seen];
}

/** What a clump is worth to `slot`: its bubbles (gold twice) and the bonus, or -1 for theirs, 0 for grey. */
export function worth(kinds, cells, slot) {
  const k = kinds[cells[0]];
  if (k === GREY) return 0;
  if (k !== slot) return -1;
  const golds = cells.filter((c) => kinds[c] === GOLD).length;
  return cells.length + golds + (cells.length >= BIG ? BIG_BONUS : 0);
}

export default {
  id: 'bubble-pop', kind: 'party', look: '2d', name: 'Bubble Pop', order: 'POP YOUR BUBBLES!', howTo: 'Tap a clump of 2+ of your colour. Gold counts double. Popping theirs costs you a point', durationMs: DURATION_MS,
  create(api) {
    let nextId = 1;
    const fresh = () => {
      const r = api.rng();
      return { id: nextId++, k: r < 0.33 ? 0 : r < 0.66 ? 1 : r < 0.74 ? GOLD : GREY };
    };
    let grid = Array.from({ length: COLS * ROWS }, fresh);
    const points = [0, 0];
    const readyAt = [0, 0];
    let pops = []; // the latest pops, for the screens: { n, by, k, cells, worth }
    let n = 0;

    const kinds = () => grid.map((b) => b.k);

    /** Takes the popped bubbles out: the rest fall, new ones drop in at the top. */
    function collapse(cells) {
      const gone = new Set(cells);
      for (let x = 0; x < COLS; x++) {
        const col = [];
        for (let y = ROWS - 1; y >= 0; y--) if (!gone.has(y * COLS + x)) col.push(grid[y * COLS + x]);
        while (col.length < ROWS) col.push(fresh());
        for (let y = ROWS - 1, i = 0; y >= 0; y--, i++) grid[y * COLS + x] = col[i];
      }
    }

    return {
      start() {
        api.update();
      },
      onInput(slot, input) {
        if ((slot !== 0 && slot !== 1) || input.type !== 'pop') return;
        const cell = input.cell;
        if (!Number.isInteger(cell) || cell < 0 || cell >= COLS * ROWS) return;
        const now = api.elapsed();
        if (now < readyAt[slot]) return;
        // (the phone says which bubble it tapped: if it has fallen since, the tap misses)
        if (Number.isInteger(input.id) && grid[cell].id !== input.id) return;
        const k = kinds();
        const cells = clump(k, cell);
        if (cells.length < 2) return;
        const w = worth(k, cells, slot);
        points[slot] += w;
        readyAt[slot] = now + COOLDOWN_MS;
        pops = pops.concat({ n: ++n, by: slot, k: k[cell], cells, worth: w }).slice(-6);
        collapse(cells);
        api.update();
      },
      onTimeUp: () => api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 }),
      view: () => ({ cols: COLS, rows: ROWS, grid: grid.map((b) => [b.id, b.k]), points, pops, cooldownMs: COOLDOWN_MS }),
    };
  },
};
