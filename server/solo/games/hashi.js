// Hashi (Bridges). Islands with numbers sit on the sea. Join them with bridges, straight across or
// down, one or two between the same two islands, never crossing another bridge or passing over an
// island, so every island has as many bridges as its number and all the islands are joined up.
// Every board has one answer, found by reasoning alone. 30 levels (7 × 7 up to 13 × 13), each
// opened by solving the one before, or a new random board of 7, 10 or 13.
// Score: the time it took (lower is better), per level or size; each hint adds 30 s.

import { settingOf } from './options.js';
import { pairsOf, makeFair, solveBridges } from './hashi-gen.js';
import { LEVELS } from './hashi-levels.js';

export const HINT_PENALTY = 30000;
export const RANDOM = { random7: [7, 9], random10: [10, 19], random13: [13, 31] }; // [size, islands]
export const BOARDS = [...LEVELS.map((_, i) => i + 1), ...Object.keys(RANDOM)];
const MAX_UNDO = 500;

/** A level's rows as a board: { w, h, islands, numbers }. */
export function parseLevel(rows) {
  const w = rows[0].length;
  const islands = [];
  const numbers = [];
  rows.join('').split('').forEach((ch, i) => {
    if (ch === '.') return;
    islands.push(i);
    numbers.push(Number(ch));
  });
  return { w, h: rows.length, islands, numbers };
}

/** A target time for a board, in seconds: about 12 s an island. */
export const parOf = (islands) => Math.round((islands * 12) / 15) * 15;

export class Hashi {
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
      const [n, count] = RANDOM[this.board];
      b = makeFair(n, n, count, this.rng);
    }
    this.w = b.w;
    this.h = b.h;
    this.islands = b.islands;
    this.numbers = b.numbers;
    this.pairs = pairsOf(this.w, this.h, this.islands);
    this.answer = null; // worked out the first time a hint needs it (never sent)
    this.bridges = this.pairs.map(() => 0);
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

  /** Each island's bridges so far. */
  counts() {
    const out = this.islands.map(() => 0);
    this.pairs.forEach((p, i) => { out[p.a] += this.bridges[i]; out[p.b] += this.bridges[i]; });
    return out;
  }

  joinedUp() {
    const seen = new Set([0]);
    const todo = [0];
    while (todo.length) {
      const k = todo.pop();
      this.pairs.forEach((p, i) => {
        if (!this.bridges[i] || (p.a !== k && p.b !== k)) return;
        const o = p.a === k ? p.b : p.a;
        if (!seen.has(o)) { seen.add(o); todo.push(o); }
      });
    }
    return seen.size === this.islands.length;
  }

  solved() {
    const c = this.counts();
    return c.every((v, k) => v === this.numbers[k]) && this.joinedUp();
  }

  setBridge(i, v) {
    this.history.push([i, this.bridges[i]]);
    if (this.history.length > MAX_UNDO) this.history.shift();
    this.bridges[i] = v;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    if (input.type === 'bridge') {
      // Between islands a and b: none → one → two → none. A bridge can't cross another.
      const i = this.pairs.findIndex((p) => (p.a === input.a && p.b === input.b) || (p.a === input.b && p.b === input.a));
      if (i < 0) return;
      const next = (this.bridges[i] + 1) % 3;
      if (next > 0 && this.pairs[i].crosses.some((j) => this.bridges[j] > 0)) return;
      this.setBridge(i, next);
    } else if (input.type === 'undo' && this.history.length) {
      const [i, v] = this.history.pop();
      this.bridges[i] = v;
    } else if (input.type === 'clear') {
      if (!this.bridges.some(Boolean)) return;
      this.history.push(...this.bridges.map((v, i) => [i, v]).filter(([, v]) => v));
      this.bridges.fill(0);
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

  /** Puts right one pair of islands: a wrong bridge first (taking away any that crosses it), else a missing one. */
  giveHint() {
    if (!this.answer) {
      // The board solves by reasoning alone, so this is quick.
      this.answer = solveOf(this.islands, this.numbers, this.pairs);
    }
    let i = this.bridges.findIndex((v, k) => v > this.answer[k]);
    if (i < 0) i = this.bridges.findIndex((v, k) => v !== this.answer[k]);
    if (i < 0) return false;
    if (this.answer[i] > 0) for (const j of this.pairs[i].crosses) if (this.bridges[j]) this.setBridge(j, 0);
    this.setBridge(i, this.answer[i]);
    this.hints++;
    this.hint = i;
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
    return {
      phase: this.phase,
      w: this.w,
      h: this.h,
      level,
      levels: LEVELS.length,
      par: level !== null ? parOf(this.islands.length) : null,
      islands: hidden ? [] : this.islands,
      numbers: hidden ? [] : this.numbers,
      pairs: hidden ? [] : this.pairs.map((p) => [p.a, p.b]),
      bridges: hidden ? [] : this.bridges,
      counts: this.counts(),
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

/** The board's one answer: the bridges on each pair. */
export function solveOf(islands, numbers, pairs) {
  return solveBridges(islands, numbers, pairs, 1)[0];
}

export default {
  id: 'hashi',
  name: 'Bridges',
  tagline: 'Join the islands with bridges: as many as each one\'s number, never crossing, all joined up.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Hashi(ctx, ctx.rng),
};
