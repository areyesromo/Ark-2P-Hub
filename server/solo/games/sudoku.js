// Sudoku. Fill the 9×9 grid so every row, every column and every 3×3 box has
// the numbers 1 to 9 once each. Some numbers are given and can't be changed.
// Clashing numbers (the same number twice in a row, column or box) show in
// red; that says nothing about whether a number is right, only that two
// can't both be. Small pencil marks help keep track of what could go where.
// Every puzzle is made fresh and has exactly one solution. Score: the time
// to solve it (lower is better), per difficulty.

import { settingOf } from './options.js';

export const LEVELS = {
  easy: { name: 'Easy', clues: 40 },
  medium: { name: 'Medium', clues: 32 },
  hard: { name: 'Hard', clues: 26 },
};

const ROW = (i) => Math.floor(i / 9);
const COL = (i) => i % 9;
const BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

/** The 20 other cells that share a row, column or box with each cell. */
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const out = [];
  for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) out.push(j);
  return out;
});

/**
 * Count the solutions of a grid (0 = empty), stopping at `limit`. Fills in
 * the most constrained empty cell first, so it's quick even on hard grids.
 * With `fill`, the first solution is written into `grid`, trying digits in
 * the order rng shuffles them (that's how a random full grid is made).
 */
export function solve(grid, limit = 2, rng = null, fill = false) {
  const g = grid.slice();
  let count = 0;
  const options = (i) => {
    let used = 0;
    for (const j of PEERS[i]) used |= 1 << g[j];
    const out = [];
    for (let n = 1; n <= 9; n++) if (!(used & (1 << n))) out.push(n);
    return out;
  };
  const shuffle = (a) => {
    if (!rng) return a;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const go = () => {
    let best = -1;
    let bestOpts = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const o = options(i);
      if (!o.length) return false;
      if (!bestOpts || o.length < bestOpts.length) {
        best = i;
        bestOpts = o;
        if (o.length === 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (fill && count === 1) for (let i = 0; i < 81; i++) grid[i] = g[i];
      return count >= limit;
    }
    for (const n of shuffle(bestOpts)) {
      g[best] = n;
      if (go()) return true;
    }
    g[best] = 0;
    return false;
  };
  go();
  return count;
}

/** A new puzzle: a random full grid, then numbers taken away while the answer stays the only one. */
export function makePuzzle(level, rng = Math.random) {
  const solution = Array(81).fill(0);
  solve(solution, 1, rng, true);
  const puzzle = solution.slice();
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let clues = 81;
  for (const i of order) {
    if (clues <= LEVELS[level].clues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (solve(puzzle, 2) !== 1) puzzle[i] = keep;
    else clues--;
  }
  return { puzzle, solution };
}

export class Sudoku {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const level = settingOf(ctx, 'level', 'easy');
    this.level = LEVELS[level] ? level : 'easy';
    this.timer = null;
  }

  start() {
    const { puzzle, solution } = makePuzzle(this.level, this.rng);
    this.given = puzzle.map((n) => n > 0);
    this.grid = puzzle.slice();
    this.solution = solution;
    this.notes = Array(81).fill(0); // pencil marks: bit n set = n noted
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.moves = 0;
    this.selected = 40; // the cell picked on the phone (or with a controller), shown on the TV too
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

  clashes() {
    const out = [];
    for (let i = 0; i < 81; i++) if (this.grid[i] && PEERS[i].some((j) => this.grid[j] === this.grid[i])) out.push(i);
    return out;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const i = input.cell;
    const n = input.n;
    if (!Number.isInteger(i) || i < 0 || i >= 81) return;
    if (input.type === 'select') {
      if (this.selected === i) return;
      this.selected = i;
      return this.ctx.update();
    }
    if (this.given[i]) return;
    if (input.type === 'set' && Number.isInteger(n) && n >= 0 && n <= 9) {
      if (this.grid[i] === n) return;
      this.grid[i] = n;
      this.moves++;
      // A number placed rubs out the same pencil mark around it.
      if (n) for (const j of PEERS[i]) this.notes[j] &= ~(1 << n);
      if (this.grid.every((v, k) => v === this.solution[k])) {
        this.endedAt = this.ctx.now();
        this.phase = 'over';
        if (this.timer) this.ctx.clearTimeout(this.timer);
        this.timer = null;
      }
    } else if (input.type === 'note' && Number.isInteger(n) && n >= 1 && n <= 9) {
      if (this.grid[i]) return;
      this.notes[i] ^= 1 << n;
    } else {
      return;
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

  view() {
    const hidden = this.phase === 'paused'; // no thinking time for free
    return {
      phase: this.phase,
      grid: hidden ? Array(81).fill(0) : this.grid,
      given: this.given,
      notes: hidden ? Array(81).fill(0) : this.notes,
      clashes: hidden ? [] : this.clashes(),
      filled: this.grid.filter(Boolean).length,
      selected: this.selected,
      elapsed: this.elapsed,
      moves: this.moves,
      score: this.phase === 'over' ? this.elapsed : null,
      variant: LEVELS[this.level].name,
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
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Fill the grid so every row, column and box has 1 to 9. A fresh puzzle every time.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Sudoku(ctx, ctx.rng),
};
