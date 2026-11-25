// Zip. Draw one path through the grid: start on 1, meet the numbers in order, end on the last one,
// and cover every square exactly once. Steps go across or down to the next square, never through
// a wall. Drag back over the path to take it back. Every board has exactly one answer.
// A ladder of 30 levels (5 × 5 up to 8 × 8, the later ones with walls), each opened by solving the
// one before, or a new random board of 6 or 7. Score: the time it took (lower is better), per level
// or size; each hint adds 30 s.

import { settingOf } from './options.js';
import { makeBoard, findAnswers, stepsFrom, wallKey } from './zip-gen.js';
import { LEVELS } from './zip-levels.js';

export const HINT_PENALTY = 30000;
export const RANDOM = { random6: 6, random7: 7 };
export const BOARDS = [...LEVELS.map((_, i) => i + 1), ...Object.keys(RANDOM)];

/** A level's text as a board: { n, numbers: [[square, number], …], walls: [[a, b], …] } (see zip-levels.js). */
export function parseLevel(level) {
  const numbers = level.nums.split(' ').map((c, k) => [Number(c), k + 1]);
  const walls = level.walls ? level.walls.split(' ').map((w) => w.split('-').map(Number)) : [];
  return { n: level.n, numbers, walls };
}

/** A target time for a level, in seconds: about a second and a half a square. */
export const parOf = (n) => Math.round((n * n * 1.5) / 15) * 15;

export class Zip {
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
    else {
      // A random board, with a few walls (they make it quicker to build, and more interesting).
      const n = RANDOM[this.board];
      b = makeBoard(n, this.rng, { walls: n === 7 ? 4 : 2 });
    }
    this.n = b.n;
    this.numbers = b.numbers;
    this.walls = b.walls;
    this.wallSet = new Set(b.walls.map(([a, c]) => wallKey(a, c)));
    this.numberAt = new Map(b.numbers);
    this.last = b.numbers.length;
    this.answer = null; // worked out the first time a hint needs it (never sent to the screens)
    this.path = [b.numbers[0][0]];
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

  /** The number the path has to meet next. */
  get next() {
    return this.path.filter((c) => this.numberAt.has(c)).length + 1;
  }

  /** Moves the path to `cell`: back along it to there, or one step on (if that's allowed). */
  moveTo(cell) {
    const at = this.path.indexOf(cell);
    if (at >= 0) {
      if (at === this.path.length - 1) return false;
      this.path.length = at + 1;
      return true;
    }
    const head = this.path[this.path.length - 1];
    if (this.numberAt.get(head) === this.last) return false; // (the end: nowhere further)
    if (!stepsFrom(this.n, head, this.wallSet).includes(cell)) return false;
    const k = this.numberAt.get(cell);
    if (k !== undefined && k !== this.next) return false; // the numbers come in order
    this.path.push(cell);
    return true;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const size = this.n * this.n;
    if (input.type === 'to' && Number.isInteger(input.cell) && input.cell >= 0 && input.cell < size) {
      if (!this.moveTo(input.cell)) return;
    } else if (input.type === 'back' && this.path.length > 1) {
      this.path.pop();
    } else if (input.type === 'clear' && this.path.length > 1) {
      this.path.length = 1;
    } else if (input.type === 'hint') {
      if (!this.giveHint()) return;
    } else return;
    if (this.path.length === size) {
      this.won = true;
      this.endedAt = this.ctx.now();
      this.hint = null;
      this.phase = 'over';
      this.stopClock();
    }
    this.ctx.update();
  }

  /** Takes the path back to where it last matched the answer, and adds the next right square. */
  giveHint() {
    if (!this.answer) this.answer = findAnswers(this.n, this.numberAt, this.wallSet, 1)[0];
    if (!this.answer) return false;
    let k = 0;
    while (k < this.path.length && this.path[k] === this.answer[k]) k++;
    this.path.length = k;
    this.path.push(this.answer[k]);
    this.hints++;
    this.hint = this.answer[k];
    this.hintNo++;
    return true;
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
    return {
      phase: this.phase,
      n: this.n,
      level,
      levels: LEVELS.length,
      par: level !== null ? parOf(this.n) : null,
      numbers: hidden ? [] : this.numbers,
      walls: hidden ? [] : this.walls,
      path: hidden ? [] : this.path,
      next: this.next,
      last: this.last,
      filled: this.path.length,
      hint: this.hint,
      hintNo: this.hintNo,
      hints: this.hints,
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

export default {
  id: 'zip',
  name: 'Zip',
  tagline: 'One path through the numbers in order that fills every square. Drag it out, drag back to undo.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Zip(ctx, ctx.rng),
};
