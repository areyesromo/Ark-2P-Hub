// Nonograms (picture logic). The numbers by each row and column are the runs
// of filled squares in that line, in order, with at least one gap between runs:
// "3 1" means three filled, a gap, then one. Fill the squares so every line
// matches; cross out squares you know are empty to keep track. Every puzzle
// is a random picture that can be solved one line at a time, without
// guessing (so it has exactly one answer). Score: the time it took, per size.

import { settingOf } from './options.js';

export const SIZES = [5, 10, 15];
const DENSITY = 0.6; // share of squares filled: busy pictures make for solvable, logical puzzles
const EMPTY = 0;
const FILLED = 1;
const CROSSED = 2;
const MARKS = { fill: FILLED, cross: CROSSED, clear: EMPTY };

/** The runs in a line of booleans: [3, 1]. An empty line is []. */
export function runsOf(line) {
  const out = [];
  let run = 0;
  for (const on of line) {
    if (on) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}

/**
 * What a line's clue says about its cells, given what's known
 * (1 filled, 0 empty, -1 unknown): the same array with every cell that's
 * certain filled in, or null if the clue can't fit at all.
 */
export function solveLine(known, clue) {
  const n = known.length;
  const k = clue.length;
  // fits[i][j]: cells i.. can hold clue runs j.. (memoised).
  const memo = new Map();
  const fits = (i, j) => {
    const key = i * 64 + j;
    if (memo.has(key)) return memo.get(key);
    let ok;
    if (j === k) ok = known.slice(i).every((c) => c !== 1);
    else if (i >= n) ok = false;
    else ok = (known[i] !== 1 && fits(i + 1, j)) || placeAt(i, j);
    memo.set(key, ok);
    return ok;
  };
  // Can run j start at cell i (and the rest still fit after it)?
  const placeAt = (i, j) => {
    const end = i + clue[j];
    if (end > n) return false;
    for (let c = i; c < end; c++) if (known[c] === 0) return false;
    if (end < n && known[end] === 1) return false;
    return fits(Math.min(n, end + 1), j + 1);
  };
  if (!fits(0, 0)) return null;
  // Walk every way the clue fits, noting what each cell can be.
  const canFill = Array(n).fill(false);
  const canEmpty = Array(n).fill(false);
  const seen = new Set();
  const walk = (i, j) => {
    const key = i * 64 + j;
    if (seen.has(key)) return;
    seen.add(key);
    if (j === k) {
      for (let c = i; c < n; c++) canEmpty[c] = true;
      return;
    }
    if (i >= n) return;
    if (known[i] !== 1 && fits(i + 1, j)) {
      canEmpty[i] = true;
      walk(i + 1, j);
    }
    if (placeAt(i, j)) {
      const end = i + clue[j];
      for (let c = i; c < end; c++) canFill[c] = true;
      if (end < n) canEmpty[end] = true;
      walk(Math.min(n, end + 1), j + 1);
    }
  };
  walk(0, 0);
  return known.map((c, i) => (canFill[i] && canEmpty[i] ? c : canFill[i] ? 1 : 0));
}

/** Solve a puzzle line by line. True when that's enough to fill in every cell. */
export function lineSolvable(n, rows, cols) {
  const grid = Array(n * n).fill(-1);
  for (let changed = true; changed; ) {
    changed = false;
    for (let line = 0; line < 2 * n; line++) {
      const isRow = line < n;
      const at = (c) => (isRow ? line * n + c : c * n + (line - n));
      const known = Array.from({ length: n }, (_, c) => grid[at(c)]);
      if (!known.includes(-1)) continue;
      const out = solveLine(known, isRow ? rows[line] : cols[line - n]);
      if (!out) return false;
      out.forEach((v, c) => {
        if (v !== known[c]) {
          grid[at(c)] = v;
          changed = true;
        }
      });
    }
  }
  return !grid.includes(-1);
}

/** The clues of a picture: { rows, cols }, each a list of runs. */
export function cluesOf(n, picture) {
  const rows = [];
  const cols = [];
  for (let i = 0; i < n; i++) {
    rows.push(runsOf(picture.slice(i * n, i * n + n)));
    cols.push(runsOf(Array.from({ length: n }, (_, r) => picture[r * n + i])));
  }
  return { rows, cols };
}

/** A random picture of n×n that can be solved without guessing. */
export function makePuzzle(n, rng = Math.random) {
  for (;;) {
    const picture = Array.from({ length: n * n }, () => rng() < DENSITY);
    const { rows, cols } = cluesOf(n, picture);
    if (lineSolvable(n, rows, cols)) return { picture, rows, cols };
  }
}

export class Nonogram {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const n = settingOf(ctx, 'size', 10);
    this.n = SIZES.includes(n) ? n : 10;
    this.timer = null;
  }

  start() {
    const { picture, rows, cols } = makePuzzle(this.n, this.rng);
    this.picture = picture;
    this.rows = rows;
    this.cols = cols;
    this.cells = Array(this.n * this.n).fill(EMPTY);
    this.selected = Math.floor(this.n / 2) * this.n + Math.floor(this.n / 2);
    this.moves = 0;
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.phase = 'play';
    this.clock();
    this.ctx.update();
  }

  /** One update a second keeps the clock moving on screen between moves. */
  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      this.ctx.update();
      this.clock();
    }, 1000);
  }

  get solved() {
    return this.cells.every((c, i) => (c === FILLED) === this.picture[i]);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const i = input.cell;
    if (!Number.isInteger(i) || i < 0 || i >= this.cells.length) return;
    if (input.type === 'select') {
      if (this.selected === i) return;
      this.selected = i;
      return this.ctx.update();
    }
    if (input.type !== 'mark') return;
    if (!Object.prototype.hasOwnProperty.call(MARKS, input.mark)) return;
    const to = MARKS[input.mark];
    this.selected = i;
    if (this.cells[i] === to) return this.ctx.update();
    this.cells[i] = to;
    this.moves++;
    if (this.solved) {
      this.endedAt = this.ctx.now();
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
    }
    this.ctx.update();
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
    } else if (this.phase === 'paused') {
      this.startedAt += this.ctx.now() - this.pausedAt; // the clock doesn't run while paused
      this.phase = 'play';
      this.clock();
    }
    this.ctx.update();
  }

  get elapsed() {
    const end = this.endedAt !== null ? this.endedAt : this.phase === 'paused' ? this.pausedAt : this.ctx.now();
    return end - this.startedAt;
  }

  /** The lines whose filled squares already match their clue (shown dimmed, like ticking them off). */
  linesDone() {
    const n = this.n;
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const rows = [];
    const cols = [];
    for (let i = 0; i < n; i++) {
      rows.push(same(runsOf(this.cells.slice(i * n, i * n + n).map((c) => c === FILLED)), this.rows[i]));
      cols.push(same(runsOf(Array.from({ length: n }, (_, r) => this.cells[r * n + i] === FILLED)), this.cols[i]));
    }
    return { rows, cols };
  }

  view() {
    const hidden = this.phase === 'paused'; // no thinking time for free
    const done = this.linesDone();
    return {
      phase: this.phase,
      n: this.n,
      rows: this.rows,
      cols: this.cols,
      cells: hidden ? Array(this.cells.length).fill(EMPTY) : this.cells,
      rowsDone: done.rows,
      colsDone: done.cols,
      selected: this.selected,
      filled: this.cells.filter((c) => c === FILLED).length,
      elapsed: this.elapsed,
      moves: this.moves,
      score: this.phase === 'over' ? this.elapsed : null,
      variant: this.n + '×' + this.n,
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
  id: 'nonogram',
  name: 'Nonograms',
  tagline: 'The numbers say how many squares are filled in each line. Fill them in to reveal the picture.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Nonogram(ctx, ctx.rng),
};
