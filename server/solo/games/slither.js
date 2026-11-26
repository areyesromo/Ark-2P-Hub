// Slitherlink. Draw one closed loop along the lines between the dots: it never crosses or touches
// itself, and each number says how many of its square's four sides the loop uses. Tap a line to draw
// it, again for ✕ (no line here), again to clear it. Every board has exactly one answer and solves
// by reasoning alone. 30 levels (5 × 5 up to 10 × 10), each opened by solving the one before, or a
// new random board of 5, 7 or 10.
// Score: the time it took (lower is better), per level or size; each hint adds 30 s.

import { settingOf } from './options.js';
import { geometry, logicSolve, makeBoard, oneLoop, ON } from './slither-gen.js';
import { LEVELS } from './slither-levels.js';

export const EMPTY = 0;
export const LINE = 1;
export const CROSS = 2;
export const HINT_PENALTY = 30000;
export const RANDOM = { random5: 5, random7: 7, random10: 10 };
export const BOARDS = [...LEVELS.map((_, i) => i + 1), ...Object.keys(RANDOM)];
const MAX_UNDO = 500;

/** A level's rows as { w, h, clues }. */
export function parseLevel(rows) {
  return { w: rows[0].length, h: rows.length, clues: rows.join('').split('').map((ch) => (ch === '.' ? -1 : Number(ch))) };
}

/** A target time for a board, in seconds: about four seconds a square. */
export const parOf = (w, h) => Math.round((w * h * 4) / 15) * 15;

export class Slither {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const board = settingOf(ctx, 'board', 1);
    this.board = BOARDS.includes(board) ? board : 1;
    this.timer = null;
  }

  start() {
    let b;
    if (typeof this.board === 'number') b = parseLevel(LEVELS[this.board - 1]);
    else b = makeBoard(RANDOM[this.board], RANDOM[this.board], this.rng);
    this.w = b.w;
    this.h = b.h;
    this.clues = b.clues;
    this.geo = geometry(this.w, this.h);
    this.answer = null; // worked out the first time it's needed (never sent)
    this.marks = new Array(this.geo.edges).fill(EMPTY);
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

  get lines() {
    return this.marks.map((m) => (m === LINE ? ON : 0));
  }

  /** Squares with more lines than their number (or full and short), and dots with three or four lines. */
  clashes() {
    const { cellEdges, dotEdges } = this.geo;
    const cells = [];
    this.clues.forEach((k, c) => {
      if (k < 0) return;
      const on = cellEdges[c].filter((e) => this.marks[e] === LINE).length;
      const open = cellEdges[c].filter((e) => this.marks[e] === EMPTY).length;
      if (on > k || on + open < k) cells.push(c);
    });
    const dots = [];
    dotEdges.forEach((es, d) => {
      const on = es.filter((e) => this.marks[e] === LINE).length;
      const open = es.filter((e) => this.marks[e] === EMPTY).length;
      if (on > 2 || (on === 1 && !open)) dots.push(d);
    });
    return { cells, dots };
  }

  solved() {
    const lines = this.lines;
    return oneLoop(this.geo, lines) && this.clues.every((k, c) => k < 0 || this.geo.cellEdges[c].filter((e) => lines[e]).length === k);
  }

  setMark(e, m) {
    if (this.marks[e] === m) return false;
    this.history.push([[e, this.marks[e]]]);
    if (this.history.length > MAX_UNDO) this.history.shift();
    this.marks[e] = m;
    return true;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const edgeOk = (e) => Number.isInteger(e) && e >= 0 && e < this.geo.edges;
    if (input.type === 'tap' && edgeOk(input.edge)) {
      // Nothing → line → ✕ → nothing (or line → nothing with back: true, for a quick rub-out).
      this.setMark(input.edge, input.back === true ? EMPTY : (this.marks[input.edge] + 1) % 3);
    } else if (input.type === 'mark' && edgeOk(input.edge) && [EMPTY, LINE, CROSS].includes(input.mark)) {
      if (!this.setMark(input.edge, input.mark)) return;
    } else if (input.type === 'undo' && this.history.length) {
      for (const [e, m] of this.history.pop()) this.marks[e] = m;
    } else if (input.type === 'clear') {
      const step = this.marks.map((m, e) => [e, m]).filter(([, m]) => m !== EMPTY);
      if (!step.length) return;
      this.history.push(step);
      this.marks.fill(EMPTY);
    } else if (input.type === 'hint') {
      if (!this.giveHint()) return;
    } else return;
    if (this.solved()) {
      this.won = true;
      this.endedAt = this.ctx.now();
      this.hint = null;
      this.phase = 'over';
      this.stopClock();
    }
    this.ctx.update();
  }

  /** Puts right one line: a wrong line or ✕ first, else draws a line of the loop. */
  giveHint() {
    if (!this.answer) this.answer = logicSolve(this.geo, this.clues).lines;
    let e = this.marks.findIndex((m, k) => (m === LINE && !this.answer[k]) || (m === CROSS && this.answer[k]));
    if (e < 0) e = this.marks.findIndex((m, k) => this.answer[k] && m !== LINE);
    if (e < 0) return false;
    this.setMark(e, this.answer[e] ? LINE : EMPTY);
    this.hints++;
    this.hint = e;
    this.hintNo++;
    return true;
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
    const level = typeof this.board === 'number' ? this.board : null;
    const c = hidden ? { cells: [], dots: [] } : this.clashes();
    return {
      phase: this.phase,
      w: this.w,
      h: this.h,
      level,
      levels: LEVELS.length,
      par: level !== null ? parOf(this.w, this.h) : null,
      clues: hidden ? this.clues.map(() => -1) : this.clues,
      marks: hidden ? this.marks.map(() => EMPTY) : this.marks,
      badCells: c.cells,
      badDots: c.dots,
      lines: this.marks.filter((m) => m === LINE).length,
      hint: this.hint,
      hintNo: this.hintNo,
      hints: this.hints,
      canUndo: this.history.length > 0,
      elapsed: this.elapsed,
      won: this.won,
      score: this.phase === 'over' && this.won ? this.elapsed : null,
      variant: level !== null ? `Level ${level}` : `Random ${this.w} × ${this.h}`,
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
  id: 'slither',
  name: 'Slitherlink',
  tagline: 'Draw one loop round the dots: each number says how many of its square\'s sides the loop uses.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Slither(ctx, ctx.rng),
};
