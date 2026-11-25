// Traffic Jam. A 6 × 6 car park of cars and trucks that only go forwards and backwards. Slide them
// out of the way until the red car can drive out of the gap on the right. A move is one vehicle
// sliding any distance. 40 levels, from a couple of moves to well over thirty, each opened by
// solving the one before and each with a par: the fewest moves it can be done in (worked out by a
// solver). Or a random one from a pack of 150 more. Score: the moves it took (fewer is better), per level; a hint makes
// the best next move for you and adds 2 more. ⭐ for solving in par without a hint.

import { settingOf } from './options.js';
import { parseBoard, placesOf, rangeOf, solvedAt, solve, SIZE, EXIT_ROW } from './traffic-gen.js';
import { LEVELS } from './traffic-levels.js';
import { RANDOM_BOARDS } from './traffic-random.js';

export const HINT_PENALTY = 2; // moves
export const BOARDS = [...LEVELS.map((_, i) => i + 1), 'random'];

export class Traffic {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const board = settingOf(ctx, 'board', 1);
    this.board = BOARDS.includes(board) ? board : 1;
    this.made = null; // a random board, kept for a restart
  }

  start() {
    if (this.board === 'random') {
      this.made = makeRandom(this.rng);
      this.rows = this.made.rows;
      this.par = this.made.par;
    } else {
      this.rows = LEVELS[this.board - 1].rows;
      this.par = LEVELS[this.board - 1].par;
    }
    this.restart();
    this.restarts = 0;
  }

  restart() {
    this.cars = parseBoard(this.rows);
    this.pos = placesOf(this.cars);
    this.moves = 0;
    this.hints = 0;
    this.hint = null; // the vehicle the last hint moved
    this.hintNo = 0;
    this.history = []; // [vehicle, from]
    this.won = false;
    this.phase = 'play';
    this.ctx.update();
  }

  slide(i, to) {
    this.history.push([i, this.pos[i]]);
    this.pos[i] = to;
    this.moves++;
    if (solvedAt(this.cars, this.pos)) {
      this.won = true;
      this.phase = 'over';
    }
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'move') {
      const i = input.car;
      if (!Number.isInteger(i) || i < 0 || i >= this.cars.length || !Number.isInteger(input.to)) return;
      const [lo, hi] = rangeOf(this.cars, this.pos, i);
      if (input.to < lo || input.to > hi || input.to === this.pos[i]) return;
      this.slide(i, input.to);
    } else if (input.type === 'undo' && this.history.length) {
      const [i, from] = this.history.pop();
      this.pos[i] = from;
      this.moves--; // an undone move doesn't count
    } else if (input.type === 'restart' && this.history.length) {
      this.restarts++;
      const keep = this.restarts;
      this.restart();
      this.restarts = keep;
      return;
    } else if (input.type === 'hint') {
      const s = solve(this.cars, this.pos);
      if (!s || !s.first) return;
      this.hints++;
      this.hintNo++;
      this.hint = s.first[0];
      this.moves += HINT_PENALTY;
      this.slide(s.first[0], s.first[1]);
    } else return;
    this.ctx.update();
  }

  view() {
    const level = typeof this.board === 'number' ? this.board : null;
    return {
      phase: this.phase,
      size: SIZE,
      exitRow: EXIT_ROW,
      level,
      levels: LEVELS.length,
      par: this.par,
      cars: this.cars.map((c, i) => ({ id: c.id, len: c.len, across: c.across, x: c.across ? this.pos[i] : c.x, y: c.across ? c.y : this.pos[i] })),
      moves: this.moves,
      hints: this.hints,
      hint: this.hint,
      hintNo: this.hintNo,
      restarts: this.restarts,
      canUndo: this.history.length > 0,
      won: this.won,
      starred: this.won && !this.hints && this.moves <= this.par,
      score: this.phase === 'over' && this.won ? this.moves : null,
      variant: level !== null ? `Level ${level}` : 'Random',
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

/** A random car park from the pack (see traffic-random.js). */
export function makeRandom(rng) {
  return RANDOM_BOARDS[Math.floor(rng() * RANDOM_BOARDS.length)];
}

export default {
  id: 'traffic',
  name: 'Traffic Jam',
  tagline: 'Slide the cars and trucks out of the way so the red car can drive out. In as few moves as you can.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'moves' },
  create: (ctx) => new Traffic(ctx, ctx.rng),
};
