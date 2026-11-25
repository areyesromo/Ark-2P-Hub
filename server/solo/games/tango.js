// Tango. Fill the grid with suns and moons: no three alike next to each other across or down,
// as many suns as moons in every row and column, and where two squares have a sign between them,
// = means they're the same and × means they're different. Some squares are given. Every board has
// exactly one answer and solves by thinking about one row or column at a time, never by guessing.
// A ladder of 30 levels (6 × 6, 8 × 8, then 10 × 10), each opened by solving the one before, or a
// new random board of 6, 8 or 10. Score: the time it took (lower is better), per level or size;
// each hint adds 30 s.

import { settingOf } from './options.js';
import { lookOf } from './looks.js';
import { makeBoard, lineSolve, linesOf, SUN, MOON } from './tango-gen.js';
import { LEVELS } from './tango-levels.js';

export { SUN, MOON };
export const EMPTY = 0;
export const HINT_PENALTY = 30000;
export const RANDOM = { random6: 6, random8: 8, random10: 10 };
export const BOARDS = [...LEVELS.map((_, i) => i + 1), ...Object.keys(RANDOM)];
const MAX_UNDO = 500;

/** A level's text as a board: { n, givens, signs } (see tango-levels.js). */
export function parseLevel(level) {
  const n = level.rows.length;
  const givens = level.rows.join('').split('').map((ch) => (ch === 's' ? SUN : ch === 'm' ? MOON : EMPTY));
  const signs = level.signs ? level.signs.split(' ').map((t) => {
    const m = /^(\d+)([=x])(\d+)$/.exec(t);
    return [Number(m[1]), Number(m[3]), m[2]];
  }) : [];
  return { n, givens, signs };
}

/** A target time for a level, in seconds: about two and a half seconds a square. */
export const parOf = (n) => Math.round((n * n * 2.5) / 15) * 15;

/** The squares that break a rule: three alike in a line, too many of one in a line, a sign not kept. */
export function clashes(n, marks, signs) {
  const bad = new Set();
  for (const cells of linesOf(n)) {
    for (let i = 2; i < n; i++) {
      const v = marks[cells[i]];
      if (v && marks[cells[i - 1]] === v && marks[cells[i - 2]] === v) [cells[i], cells[i - 1], cells[i - 2]].forEach((c) => bad.add(c));
    }
    for (const v of [SUN, MOON]) {
      const mine = cells.filter((c) => marks[c] === v);
      if (mine.length > n / 2) mine.forEach((c) => bad.add(c));
    }
  }
  for (const [a, b, s] of signs) {
    if (marks[a] && marks[b] && (s === '=') !== (marks[a] === marks[b])) { bad.add(a); bad.add(b); }
  }
  return [...bad].sort((a, b) => a - b);
}

export class Tango {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const board = settingOf(ctx, 'board', 1);
    this.board = BOARDS.includes(board) ? board : 1;
    this.look = lookOf(ctx, 'tango');
    this.timer = null;
  }

  start() {
    let b;
    if (typeof this.board === 'number') {
      b = parseLevel(LEVELS[this.board - 1]);
    } else {
      // A random board: a fair number of signs, and as few givens as it can.
      const n = RANDOM[this.board];
      b = makeBoard(n, this.rng, { signs: Math.round(n * 1.2) });
    }
    this.n = b.n;
    this.givens = b.givens;
    this.signs = b.signs;
    this.answer = null; // worked out the first time a hint needs it (never sent to the screens)
    this.marks = this.givens.slice();
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

  /** One update a second keeps the clock moving on screen. */
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

  /** Changes marks ([cell, mark] pairs) as one step, so one undo takes it all back. */
  setMarks(changes) {
    const step = [];
    for (const [cell, mark] of changes) {
      if (this.marks[cell] === mark || this.givens[cell]) continue;
      step.push([cell, this.marks[cell]]);
      this.marks[cell] = mark;
    }
    if (!step.length) return false;
    this.history.push(step);
    if (this.history.length > MAX_UNDO) this.history.shift();
    return true;
  }

  solved() {
    return this.marks.every(Boolean) && clashes(this.n, this.marks, this.signs).length === 0;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const cellOk = (c) => Number.isInteger(c) && c >= 0 && c < this.n * this.n && !this.givens[c];
    if (input.type === 'tap' && cellOk(input.cell)) {
      // Empty → sun → moon → empty.
      this.setMarks([[input.cell, (this.marks[input.cell] + 1) % 3]]);
    } else if (input.type === 'mark' && cellOk(input.cell) && [EMPTY, SUN, MOON].includes(input.mark)) {
      this.setMarks([[input.cell, input.mark]]);
    } else if (input.type === 'undo' && this.history.length) {
      for (const [cell, mark] of this.history.pop()) this.marks[cell] = mark;
    } else if (input.type === 'clear') {
      if (!this.setMarks(this.marks.map((_, i) => [i, EMPTY]))) return;
    } else if (input.type === 'hint') {
      this.giveHint();
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

  /** Puts right the first square that's wrong, else fills one in. */
  giveHint() {
    if (!this.answer) {
      // The one answer: the board solves by line logic, so this is quick.
      this.answer = solveOf(this.n, this.givens, this.signs);
    }
    let cell = this.marks.findIndex((m, i) => m && m !== this.answer[i]);
    if (cell === -1) cell = this.marks.findIndex((m) => !m);
    if (cell === -1) return;
    this.setMarks([[cell, this.answer[cell]]]);
    this.hints++;
    this.hint = cell;
    this.hintNo++;
  }

  togglePause() {
    if (this.phase === 'play') {
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
      this.stopClock();
    } else if (this.phase === 'paused') {
      this.startedAt += this.ctx.now() - this.pausedAt; // the clock doesn't run while paused
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
    const hidden = this.phase === 'paused'; // no thinking time for free
    const level = typeof this.board === 'number' ? this.board : null;
    const size = this.n * this.n;
    return {
      look: this.look,
      phase: this.phase,
      n: this.n,
      level,
      levels: LEVELS.length,
      par: level !== null ? parOf(this.n) : null,
      givens: hidden ? new Array(size).fill(EMPTY) : this.givens,
      marks: hidden ? new Array(size).fill(EMPTY) : this.marks,
      signs: hidden ? [] : this.signs,
      clashes: hidden ? [] : clashes(this.n, this.marks, this.signs),
      filled: this.marks.filter(Boolean).length,
      hint: this.hint,
      hintNo: this.hintNo,
      hints: this.hints,
      canUndo: this.history.length > 0,
      elapsed: this.elapsed,
      won: this.won,
      score: this.phase === 'over' && this.won ? this.elapsed : null,
      variant: level !== null ? `Level ${level}` : `Random ${this.n} × ${this.n}`,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

/** The board's answer (it solves by line logic alone). */
export function solveOf(n, givens, signs) {
  return lineSolve(n, givens, signs).grid;
}

export default {
  id: 'tango',
  name: 'Tango',
  tagline: 'Suns and moons: no three alike in a line, as many of each in every row and column, and keep the = and × signs.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Tango(ctx, ctx.rng),
};
