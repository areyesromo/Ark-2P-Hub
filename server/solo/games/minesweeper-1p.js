// Minesweeper. Uncover every cell that isn't a mine. A number says how many
// of the 8 cells around it hide a mine; flag the ones you're sure of.
// The first cell you open is always safe (the mines are laid after it, away
// from it). Opening a number whose mines are all flagged opens the rest of its
// neighbours ("chording"). Score: the time to clear the field, only if you win.

import { settingOf } from './options.js';

export const SIZES = {
  easy: { name: 'Easy', w: 9, h: 9, mines: 10 },
  medium: { name: 'Medium', w: 16, h: 16, mines: 40 },
  hard: { name: 'Hard', w: 30, h: 16, mines: 99 },
};

export class Minesweeper {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const size = settingOf(ctx, 'size', 'easy');
    this.size = SIZES[size] ? size : 'easy';
    this.timer = null;
  }

  get cfg() {
    return SIZES[this.size];
  }

  start() {
    const { w, h } = this.cfg;
    this.mines = null; // Set of cell indexes, laid on the first open
    this.open = new Set();
    this.flags = new Set();
    this.boom = null; // the mine that went off
    this.startedAt = null;
    this.endedAt = null;
    this.won = false;
    this.phase = 'play';
    this.n = w * h;
    // One update a second keeps the clock moving on screen between moves.
    this.clock();
    this.ctx.update();
  }

  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      if (this.startedAt !== null) this.ctx.update();
      this.clock();
    }, 1000);
  }

  neighbours(i) {
    const { w, h } = this.cfg;
    const x = i % w;
    const y = Math.floor(i / w);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
      }
    }
    return out;
  }

  /** Lay the mines anywhere but the first cell opened and its neighbours. */
  layMines(first) {
    const keepClear = new Set([first, ...this.neighbours(first)]);
    // On a tiny board there may not be room to keep all the neighbours clear: then only the cell itself.
    const pool = [...Array(this.n).keys()].filter((i) => (this.n - keepClear.size >= this.cfg.mines ? !keepClear.has(i) : i !== first));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.mines = new Set(pool.slice(0, this.cfg.mines));
  }

  count(i) {
    return this.neighbours(i).filter((j) => this.mines.has(j)).length;
  }

  /** Open a cell; a 0 opens its neighbours too (flood fill). */
  reveal(i) {
    if (this.open.has(i) || this.flags.has(i)) return;
    if (this.mines.has(i)) {
      this.boom = i;
      return this.end(false);
    }
    const stack = [i];
    while (stack.length) {
      const c = stack.pop();
      if (this.open.has(c) || this.flags.has(c)) continue;
      this.open.add(c);
      if (this.count(c) === 0) for (const j of this.neighbours(c)) if (!this.open.has(j)) stack.push(j);
    }
    if (this.open.size === this.n - this.cfg.mines) this.end(true);
  }

  end(won) {
    this.won = won;
    this.endedAt = this.ctx.now();
    this.phase = 'over';
    if (won) for (const m of this.mines) this.flags.add(m);
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    const i = input.cell;
    if (!Number.isInteger(i) || i < 0 || i >= this.n) return;
    if (input.type === 'flag') {
      if (this.open.has(i)) return;
      if (this.flags.has(i)) this.flags.delete(i);
      else this.flags.add(i);
    } else if (input.type === 'open') {
      if (!this.mines) {
        this.layMines(i);
        this.startedAt = this.ctx.now();
      }
      if (this.open.has(i)) {
        // Chording: as many flags around a number as it says opens everything else around it.
        const around = this.neighbours(i);
        if (around.filter((j) => this.flags.has(j)).length !== this.count(i)) return;
        for (const j of around) if (this.phase === 'play') this.reveal(j);
      } else {
        this.reveal(i);
      }
    } else {
      return;
    }
    this.ctx.update();
  }

  get elapsed() {
    if (this.startedAt === null) return 0;
    return (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
  }

  /**
   * The board as one character per cell: '#' covered, 'F' flagged, '0'-'8'
   * open. Mines only show once it's over: '*' a mine, 'X' the one that went
   * off, 'W' a flag that was wrong.
   */
  board() {
    let s = '';
    const over = this.phase === 'over';
    for (let i = 0; i < this.n; i++) {
      const mine = over && this.mines && this.mines.has(i);
      if (this.open.has(i)) s += String(this.count(i));
      else if (over && i === this.boom) s += 'X';
      else if (this.flags.has(i)) s += over && !mine ? 'W' : 'F';
      else s += mine ? '*' : '#';
    }
    return s;
  }

  view() {
    const { w, h, mines, name } = this.cfg;
    return {
      phase: this.phase,
      w,
      h,
      mines,
      flags: this.flags.size,
      board: this.board(),
      elapsed: this.elapsed,
      started: this.startedAt !== null,
      won: this.won,
      // Only a cleared field counts, and the time is the score (lower is better).
      score: this.phase === 'over' && this.won ? this.elapsed : null,
      variant: name,
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
  id: 'minesweeper-1p',
  name: 'Minesweeper 1P',
  tagline: 'Clear the field without setting off a mine. Numbers count the mines next door.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Minesweeper(ctx, ctx.rng),
};
