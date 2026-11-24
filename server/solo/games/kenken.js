// KenKen. Fill the grid so every row and column has each number once (1 to 4
// on a 4 × 4, and so on). The heavy outlines are cages: each cage's numbers
// make its target with its sign (add them, multiply them, or for two squares,
// the difference or the division, bigger first). A one-square cage just gives
// its number. Every puzzle has exactly one answer. Score: your time, per size.

import { settingOf } from './options.js';

export const SIZES = [4, 5, 6];
const MAX_CAGE = { 4: 3, 5: 3, 6: 4 };

const product = (list) => list.reduce((a, b) => a * b, 1);

/** Does a cage's (possibly partly filled) list of numbers still fit its target? */
export function cageFits(cage, values, full) {
  const { op, target } = cage;
  if (op === '') return values[0] === target;
  if (op === '+') {
    const s = values.reduce((a, b) => a + b, 0);
    return full ? s === target : s < target || (s === target && values.length === cage.cells.length);
  }
  if (op === '×') {
    const p = product(values);
    return full ? p === target : target % p === 0;
  }
  if (!full) return true;
  const [a, b] = values[0] > values[1] ? values : [values[1], values[0]];
  return op === '−' ? a - b === target : a === b * target;
}

/**
 * How many answers the puzzle has, stopping at `limit`: a backtracking search,
 * filling the squares of the most constrained cages first.
 */
export function countSolutions(n, cages, limit = 2) {
  const cageOf = Array(n * n);
  cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  const order = cages
    .map((c, k) => ({ k, size: c.cells.length, op: c.op }))
    .sort((a, b) => (a.op === '' ? -1 : 0) - (b.op === '' ? -1 : 0) || a.size - b.size)
    .flatMap(({ k }) => cages[k].cells);
  const grid = Array(n * n).fill(0);
  const rows = Array.from({ length: n }, () => new Set());
  const cols = Array.from({ length: n }, () => new Set());
  let found = 0;
  const step = (idx) => {
    if (idx === order.length) {
      found++;
      return found >= limit;
    }
    const i = order[idx];
    const r = Math.floor(i / n);
    const c = i % n;
    const cage = cages[cageOf[i]];
    for (let v = 1; v <= n; v++) {
      if (rows[r].has(v) || cols[c].has(v)) continue;
      grid[i] = v;
      const vals = cage.cells.filter((j) => grid[j]).map((j) => grid[j]);
      if (cageFits(cage, vals, vals.length === cage.cells.length)) {
        rows[r].add(v);
        cols[c].add(v);
        if (step(idx + 1)) return true;
        rows[r].delete(v);
        cols[c].delete(v);
      }
      grid[i] = 0;
    }
    return false;
  };
  step(0);
  return found;
}

export class KenKen {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const n = settingOf(ctx, 'size', 4);
    this.n = SIZES.includes(n) ? n : 4;
  }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** A random grid with every number once per row and column. */
  latin() {
    const n = this.n;
    const rows = this.shuffle([...Array(n).keys()]);
    const cols = this.shuffle([...Array(n).keys()]);
    const syms = this.shuffle([...Array(n).keys()].map((x) => x + 1));
    const out = Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[r * n + c] = syms[(rows[r] + cols[c]) % n];
    return out;
  }

  /** Cut the grid into cages of touching squares and give each a sign and target. */
  cages(solution) {
    const n = this.n;
    const owner = Array(n * n).fill(-1);
    const cages = [];
    for (const start of this.shuffle([...Array(n * n).keys()])) {
      if (owner[start] !== -1) continue;
      // Mostly twos and threes, a few ones.
      const want = Math.min(MAX_CAGE[n], 1 + Math.floor(this.rng() * 3.2 + (this.rng() < 0.15 ? 0 : 0.6)));
      const cells = [start];
      owner[start] = cages.length;
      while (cells.length < want) {
        const next = this.shuffle(cells.flatMap((i) => this.around(i)).filter((j) => owner[j] === -1))[0];
        if (next === undefined) break;
        owner[next] = cages.length;
        cells.push(next);
      }
      cages.push({ cells: cells.sort((a, b) => a - b) });
    }
    for (const cage of cages) Object.assign(cage, this.sign(cage.cells.map((i) => solution[i])));
    return cages;
  }

  around(i) {
    const n = this.n;
    const r = Math.floor(i / n);
    const c = i % n;
    return [r > 0 && i - n, r < n - 1 && i + n, c > 0 && i - 1, c < n - 1 && i + 1].filter((x) => x !== false);
  }

  /** A sign and target for a cage's numbers. */
  sign(vals) {
    if (vals.length === 1) return { op: '', target: vals[0] };
    if (vals.length === 2) {
      const [a, b] = vals[0] > vals[1] ? vals : [vals[1], vals[0]];
      const choices = [{ op: '−', target: a - b }, { op: '+', target: a + b }];
      if (a % b === 0) choices.push({ op: '÷', target: a / b }, { op: '÷', target: a / b });
      if (a * b <= 30) choices.push({ op: '×', target: a * b });
      return choices[Math.floor(this.rng() * choices.length)];
    }
    const p = product(vals);
    return p <= 120 && this.rng() < 0.4 ? { op: '×', target: p } : { op: '+', target: vals.reduce((x, y) => x + y, 0) };
  }

  /** A puzzle with exactly one answer (new cages until it has). */
  make() {
    for (;;) {
      const solution = this.latin();
      for (let tries = 0; tries < 6; tries++) {
        const cages = this.cages(solution);
        if (countSolutions(this.n, cages) === 1) return { solution, cages };
      }
    }
  }

  start() {
    const { solution, cages } = this.make();
    this.solution = solution;
    this.cageList = cages;
    this.grid = Array(this.n * this.n).fill(0);
    this.selected = 0;
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.phase = 'play';
    this.ctx.update();
  }

  /** Squares that clash: a number twice in a row or column, or a full cage that misses its target. */
  clashes() {
    const n = this.n;
    const bad = new Set();
    for (let i = 0; i < n * n; i++) {
      const v = this.grid[i];
      if (!v) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      for (let k = 0; k < n; k++) {
        if (k !== c && this.grid[r * n + k] === v) bad.add(i);
        if (k !== r && this.grid[k * n + c] === v) bad.add(i);
      }
    }
    for (const cage of this.cageList) {
      const vals = cage.cells.map((i) => this.grid[i]);
      if (vals.every(Boolean) && !cageFits(cage, vals, true)) cage.cells.forEach((i) => bad.add(i));
    }
    return [...bad].sort((a, b) => a - b);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    const n = this.n;
    const i = input.cell;
    if (!Number.isInteger(i) || i < 0 || i >= n * n) return;
    if (input.type === 'select') this.selected = i;
    else if (input.type === 'set' && Number.isInteger(input.value) && input.value >= 0 && input.value <= n) {
      this.grid[i] = input.value;
      this.selected = i;
      if (this.grid.every((v, k) => v === this.solution[k])) {
        this.phase = 'over';
        this.endedAt = this.ctx.now();
      }
    } else return;
    this.ctx.update();
  }

  view() {
    const done = this.phase === 'over';
    return {
      phase: this.phase,
      n: this.n,
      cages: this.cageList.map((c) => ({ cells: c.cells, op: c.op, target: c.target })),
      grid: this.grid,
      selected: this.selected,
      clashes: this.clashes(),
      filled: this.grid.filter(Boolean).length,
      elapsed: (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt,
      score: done ? this.endedAt - this.startedAt : null,
      variant: this.n + ' × ' + this.n,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

export default {
  id: 'kenken',
  name: 'KenKen',
  tagline: 'Every number once in each row and column, and each cage makes its sum. Maths meets Sudoku.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new KenKen(ctx, ctx.rng),
};
