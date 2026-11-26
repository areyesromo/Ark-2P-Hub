// Futoshiki. Fill the grid so every row and every column has each number once (1 to 4 on a 4 × 4,
// up to 7), and every sign between two squares is kept: the open side of < or > faces the bigger
// number. A few numbers are given. Every puzzle has exactly one answer. Pencil marks for the
// numbers a square could still be; a number put in rubs them out along its row and column.
// Score: the time it took (lower is better), per size; each hint adds 30 s.

import { settingOf } from './options.js';

export const SIZES = [5, 4, 6, 7];
export const HINT_PENALTY = 30000;
const MAX_UNDO = 500;

/**
 * How many answers, up to `limit`. givens: the grid (0 empty); signs: [a, b] pairs meaning the
 * number in a is smaller than the one in b. A search that fills the square with the fewest options
 * first, its options cut by the rows, columns and signs.
 */
export function countAnswers(n, givens, signs, limit = 2, out = null) {
  const size = n * n;
  const grid = givens.slice();
  const less = Array.from({ length: size }, () => []); // squares that must be bigger than this one
  const more = Array.from({ length: size }, () => []); // squares that must be smaller
  for (const [a, b] of signs) {
    less[a].push(b);
    more[b].push(a);
  }
  const all = (1 << (n + 1)) - 2; // bits 1..n
  const options = (i) => {
    let m = all;
    const r = Math.floor(i / n);
    const c = i % n;
    for (let k = 0; k < n; k++) {
      m &= ~(1 << grid[r * n + k]);
      m &= ~(1 << grid[k * n + c]);
    }
    // Bigger than every known smaller neighbour, smaller than every known bigger one; and room
    // left for the unknown ones (a square below needs at least 1 under it).
    let lo = 1;
    let hi = n;
    for (const j of more[i]) lo = Math.max(lo, grid[j] ? grid[j] + 1 : 2);
    for (const j of less[i]) hi = Math.min(hi, grid[j] ? grid[j] - 1 : n - 1);
    for (let v = 1; v <= n; v++) if (v < lo || v > hi) m &= ~(1 << v);
    return m;
  };
  let count = 0;
  const go = () => {
    if (count >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let i = 0; i < size; i++) {
      if (grid[i]) continue;
      const m = options(i);
      let k = 0;
      for (let v = 1; v <= n; v++) if (m & (1 << v)) k++;
      if (k === 0) return;
      if (k < bestCount) { best = i; bestMask = m; bestCount = k; if (k === 1) break; }
    }
    if (best < 0) {
      count++;
      if (out && count === 1) out.push(...grid);
      return;
    }
    for (let v = 1; v <= n; v++) {
      if (!(bestMask & (1 << v))) continue;
      grid[best] = v;
      go();
      grid[best] = 0;
      if (count >= limit) return;
    }
  };
  go();
  return count;
}

/** A random Latin square (each number once per row and column), row by row with backtracking. */
export function latin(n, rng) {
  const grid = new Array(n * n).fill(0);
  const go = (i) => {
    if (i === n * n) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    const vals = [...Array(n).keys()].map((v) => v + 1).sort(() => rng() - 0.5);
    for (const v of vals) {
      let ok = true;
      for (let k = 0; k < c && ok; k++) if (grid[r * n + k] === v) ok = false;
      for (let k = 0; k < r && ok; k++) if (grid[k * n + c] === v) ok = false;
      if (!ok) continue;
      grid[i] = v;
      if (go(i + 1)) return true;
      grid[i] = 0;
    }
    return false;
  };
  go(0);
  return grid;
}

/** A puzzle: { n, givens, signs, answer } with exactly one answer. */
export function makePuzzle(n, rng) {
  const answer = latin(n, rng);
  const shuffle = (list) => list.map((x) => [rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const pairs = [];
  for (let i = 0; i < n * n; i++) {
    if (i % n < n - 1) pairs.push([i, i + 1]);
    if (i + n < n * n) pairs.push([i, i + n]);
  }
  // Signs on about a third of the joins, then numbers taken away while it still has one answer,
  // then any sign it doesn't need.
  let signs = shuffle(pairs).slice(0, Math.round(pairs.length * 0.36)).map(([a, b]) => (answer[a] < answer[b] ? [a, b] : [b, a]));
  const givens = answer.slice();
  for (const i of shuffle([...Array(n * n).keys()])) {
    const v = givens[i];
    givens[i] = 0;
    if (countAnswers(n, givens, signs) !== 1) givens[i] = v;
  }
  for (const s of shuffle(signs)) {
    const without = signs.filter((x) => x !== s);
    if (countAnswers(n, givens, without) === 1) signs = without;
  }
  return { n, givens, signs, answer };
}

export class Futoshiki {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const n = settingOf(ctx, 'size', 5);
    this.n = SIZES.includes(n) ? n : 5;
    this.timer = null;
  }

  start() {
    const p = makePuzzle(this.n, this.rng);
    this.givens = p.givens;
    this.signs = p.signs;
    this.answer = p.answer; // (never sent)
    this.grid = this.givens.slice();
    this.notes = new Array(this.n * this.n).fill(0); // pencil marks, a bit per number
    this.selected = this.givens.findIndex((v) => !v);
    this.history = [];
    this.hints = 0;
    this.hint = null;
    this.hintNo = 0;
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.won = false;
    this.phase = 'play';
    this.clock();
    this.ctx.update();
  }

  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      this.ctx.update();
      this.clock();
    }, 1000);
  }

  stopClock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Keeps the grid and the marks as they are now, for undo. */
  save() {
    this.history.push([this.grid.slice(), this.notes.slice()]);
    if (this.history.length > MAX_UNDO) this.history.shift();
  }

  /** Puts `v` (0 rubs out) in square i, and rubs v out of the pencil marks in its row and column. */
  put(i, v) {
    this.grid[i] = v;
    this.notes[i] = 0;
    if (!v) return;
    const n = this.n;
    const r = Math.floor(i / n);
    const c = i % n;
    for (let k = 0; k < n; k++) {
      this.notes[r * n + k] &= ~(1 << v);
      this.notes[k * n + c] &= ~(1 << v);
    }
  }

  /** Squares that break a rule: a number twice in a row or column, or a sign not kept. */
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
    for (const [a, b] of this.signs) {
      if (this.grid[a] && this.grid[b] && this.grid[a] >= this.grid[b]) { bad.add(a); bad.add(b); }
    }
    return [...bad].sort((a, b) => a - b);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const n = this.n;
    const cellOk = (c) => Number.isInteger(c) && c >= 0 && c < n * n;
    const valOk = (v) => Number.isInteger(v) && v >= 0 && v <= n;
    if (input.type === 'select' && cellOk(input.cell)) {
      this.selected = input.cell;
    } else if (input.type === 'set' && cellOk(input.cell) && valOk(input.value) && !this.givens[input.cell]) {
      if (this.grid[input.cell] === input.value && !this.notes[input.cell]) return;
      this.save();
      this.put(input.cell, input.value);
      this.selected = input.cell;
    } else if (input.type === 'note' && cellOk(input.cell) && valOk(input.value) && input.value > 0 && !this.givens[input.cell] && !this.grid[input.cell]) {
      this.save();
      this.notes[input.cell] ^= 1 << input.value;
      this.selected = input.cell;
    } else if (input.type === 'undo' && this.history.length) {
      [this.grid, this.notes] = this.history.pop();
    } else if (input.type === 'clear') {
      if (this.grid.every((v, i) => v === this.givens[i]) && !this.notes.some(Boolean)) return;
      this.save();
      this.grid = this.givens.slice();
      this.notes.fill(0);
    } else if (input.type === 'hint') {
      // The first wrong number put right, else the picked square (or the first empty one) filled in.
      let i = this.grid.findIndex((v, k) => v && v !== this.answer[k]);
      if (i < 0) i = !this.grid[this.selected] ? this.selected : this.grid.findIndex((v) => !v);
      if (i < 0) return;
      this.save();
      this.put(i, this.answer[i]);
      this.hints++;
      this.hint = i;
      this.hintNo++;
      this.selected = i;
    } else return;
    if (this.grid.every((v, i) => v === this.answer[i])) {
      this.won = true;
      this.endedAt = this.ctx.now();
      this.hint = null;
      this.phase = 'over';
      this.stopClock();
    }
    this.ctx.update();
  }

  togglePause() {
    if (this.phase === 'play') {
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
      this.stopClock();
    } else if (this.phase === 'paused') {
      this.startedAt += this.ctx.now() - this.pausedAt;
      this.phase = 'play';
      this.clock();
    } else return;
    this.ctx.update();
  }

  get elapsed() {
    const end = this.endedAt !== null ? this.endedAt : this.phase === 'paused' ? this.pausedAt : this.ctx.now();
    return end - this.startedAt + this.hints * HINT_PENALTY;
  }

  view() {
    const hidden = this.phase === 'paused';
    const size = this.n * this.n;
    return {
      phase: this.phase,
      n: this.n,
      givens: hidden ? new Array(size).fill(0) : this.givens,
      grid: hidden ? new Array(size).fill(0) : this.grid,
      notes: hidden ? new Array(size).fill(0) : this.notes,
      signs: hidden ? [] : this.signs,
      clashes: hidden ? [] : this.clashes(),
      selected: this.selected,
      filled: this.grid.filter(Boolean).length,
      hint: this.hint,
      hintNo: this.hintNo,
      hints: this.hints,
      canUndo: this.history.length > 0,
      elapsed: this.elapsed,
      won: this.won,
      score: this.phase === 'over' && this.won ? this.elapsed : null,
      variant: `${this.n} × ${this.n}`,
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
  id: 'futoshiki',
  name: 'Futoshiki',
  tagline: 'Every number once in each row and column, and keep every < and > sign between the squares.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Futoshiki(ctx, ctx.rng),
};
