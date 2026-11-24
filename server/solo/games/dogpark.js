// Dog Park. The park is split into coloured areas (one per row). Put one dog in
// every row, every column and every area, and no two dogs may touch, not even
// corner to corner. Trees and water take no dog. Every park has exactly one
// answer. Mark the squares you've ruled out with a ball, so the dogs stand out.
// 36 levels from 5 × 5 up to an Expert pack of 13 × 13, each opened by solving
// the one before, or a new random park of 7, 9 or 11 squares a side.
// Score: the time it took (lower is better), per level or size; each hint adds 30 s.

import { settingOf } from './options.js';
import { lookOf } from './looks.js';
import { makeBoard, answerOf } from './dogpark-gen.js';
import { LEVELS } from './dogpark-levels.js';

export const EMPTY = 0;
export const BALL = 1; // "no dog here"
export const DOG = 2;
export const HINT_PENALTY = 30000;
export const EXPERT_FROM = 31; // levels from here on are the Expert pack
export const RANDOM = { random7: 7, random9: 9, random11: 11 };
export const PARKS = [...LEVELS.map((_, i) => i + 1), ...Object.keys(RANDOM)];
const MAX_UNDO = 500;

/** A level's text rows as a board's areas: a letter is an area, # a tree (-1), ~ water (-2). */
export function parseLevel(rows) {
  const n = rows.length;
  const regions = rows.join('').split('').map((ch) => (ch === '#' ? -1 : ch === '~' ? -2 : ch.charCodeAt(0) - 97));
  return { n, regions };
}

/** A target time for a level, in seconds: about two seconds a square. */
export const parOf = (n) => Math.round((n * n * 2) / 15) * 15;

/** The dogs that break a rule (same row, column or area, or touching another dog). */
export function clashes(n, regions, marks) {
  const dogs = [];
  marks.forEach((m, i) => m === DOG && dogs.push(i));
  const bad = new Set();
  for (let a = 0; a < dogs.length; a++) {
    for (let b = a + 1; b < dogs.length; b++) {
      const i = dogs[a];
      const j = dogs[b];
      const dx = Math.abs((i % n) - (j % n));
      const dy = Math.abs(Math.floor(i / n) - Math.floor(j / n));
      if (dx === 0 || dy === 0 || regions[i] === regions[j] || (dx <= 1 && dy <= 1)) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return [...bad].sort((a, b) => a - b);
}

export class DogPark {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const park = settingOf(ctx, 'park', 1);
    this.park = PARKS.includes(park) ? park : 1;
    this.look = lookOf(ctx, 'dogpark');
    this.timer = null;
  }

  start() {
    if (typeof this.park === 'number') {
      const { n, regions } = parseLevel(LEVELS[this.park - 1]);
      this.n = n;
      this.regions = regions;
    } else {
      // A random park; bigger ones get a few trees.
      const n = RANDOM[this.park];
      this.n = n;
      this.regions = makeBoard(n, this.rng, { trees: n >= 9 ? Math.floor(n / 3) : 0 }).regions;
    }
    this.answer = null; // worked out the first time a hint needs it (never sent to the screens)
    this.marks = new Array(this.n * this.n).fill(EMPTY);
    this.history = [];
    this.hints = 0;
    this.hint = null; // the square the last hint was about, for the screens to show
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
      if (this.marks[cell] === mark) continue;
      step.push([cell, this.marks[cell]]);
      this.marks[cell] = mark;
    }
    if (!step.length) return false;
    this.history.push(step);
    if (this.history.length > MAX_UNDO) this.history.shift();
    return true;
  }

  setMark(cell, mark) {
    return this.setMarks([[cell, mark]]);
  }

  /** The empty squares the dogs already down rule out (their rows, columns, areas and neighbours). */
  ruledOut() {
    const n = this.n;
    const dogs = [];
    this.marks.forEach((m, i) => m === DOG && dogs.push(i));
    const out = [];
    this.marks.forEach((m, i) => {
      if (m !== EMPTY || this.regions[i] < 0) return;
      const hit = dogs.some((d) => {
        const dx = Math.abs((i % n) - (d % n));
        const dy = Math.abs(Math.floor(i / n) - Math.floor(d / n));
        return dx === 0 || dy === 0 || this.regions[i] === this.regions[d] || (dx <= 1 && dy <= 1);
      });
      if (hit) out.push(i);
    });
    return out;
  }

  solved() {
    return this.marks.filter((m) => m === DOG).length === this.n && clashes(this.n, this.regions, this.marks).length === 0;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const size = this.n * this.n;
    const cellOk = (c) => Number.isInteger(c) && c >= 0 && c < size && this.regions[c] >= 0;
    if (input.type === 'tap' && cellOk(input.cell)) {
      // Empty → ball → dog → empty.
      this.setMark(input.cell, (this.marks[input.cell] + 1) % 3);
    } else if (input.type === 'mark' && cellOk(input.cell) && [EMPTY, BALL, DOG].includes(input.mark)) {
      this.setMark(input.cell, input.mark);
    } else if (input.type === 'undo' && this.history.length) {
      for (const [cell, mark] of this.history.pop()) this.marks[cell] = mark;
    } else if (input.type === 'clear') {
      if (!this.setMarks(this.marks.map((_, i) => [i, EMPTY]))) return;
    } else if (input.type === 'fill') {
      // A ball on every square the dogs already down rule out: the chore, done in one go.
      if (!this.setMarks(this.ruledOut().map((i) => [i, BALL]))) return;
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

  /** Puts right the first thing that's wrong (a dog that can't be there, a ball on a dog's square), else places a dog. */
  giveHint() {
    if (!this.answer) this.answer = new Set(answerOf(this.n, this.regions));
    let cell = this.marks.findIndex((m, i) => m === DOG && !this.answer.has(i));
    let mark = BALL;
    if (cell === -1) {
      cell = this.marks.findIndex((m, i) => m === BALL && this.answer.has(i));
      mark = DOG;
    }
    if (cell === -1) {
      cell = [...this.answer].find((i) => this.marks[i] !== DOG);
      mark = DOG;
    }
    if (cell === undefined || cell === -1) return;
    this.setMark(cell, mark);
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
    const level = typeof this.park === 'number' ? this.park : null;
    return {
      look: this.look,
      phase: this.phase,
      n: this.n,
      level,
      expert: level !== null && level >= EXPERT_FROM,
      levels: LEVELS.length,
      par: level !== null ? parOf(this.n) : null,
      regions: hidden ? this.regions.map((a) => (a < 0 ? a : 0)) : this.regions,
      marks: hidden ? this.marks.map(() => EMPTY) : this.marks,
      clashes: hidden ? [] : clashes(this.n, this.regions, this.marks),
      dogs: this.marks.filter((m) => m === DOG).length,
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

export default {
  id: 'dogpark',
  name: 'Dog Park',
  tagline: 'One dog per row, column and colour, and no two dogs touching. Can you fill the park?',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new DogPark(ctx, ctx.rng),
};
