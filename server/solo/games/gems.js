// Gem Swap. Swap two touching gems to line up three or more of a colour, in
// a row or a column: they vanish, the gems above fall, new ones drop in, and
// any new lines vanish too (a chain: each step of it scores more). A swap
// that makes no line doesn't happen. 30 swaps; when the board has no move
// left it's reshuffled. Score: points (10 a gem, more for lines of 4 and 5,
// times the chain step).

import { lookOf } from './looks.js';

export const SIZE = 8;
export const COLORS = 6;
export const MOVES = 30;
export const POINTS = { gem: 10, four: 50, five: 150 };

export class Gems {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.look = lookOf(ctx, 'gems');
  }

  start() {
    this.board = this.freshBoard();
    this.score = 0;
    this.movesLeft = MOVES;
    this.bestChain = 0;
    this.biggest = 0; // the longest line made
    this.last = null; // what the last swap did, for the screens to animate: { a, b, steps: [{ cleared, board }] }
    this.swaps = 0;
    this.nope = 0; // swaps that made no line, so the screens can shake
    this.reshuffles = 0;
    this.phase = 'play';
    this.ctx.update();
  }

  rand() {
    return Math.floor(this.rng() * COLORS);
  }

  /** A board with no lines on it yet and at least one move. */
  freshBoard() {
    for (;;) {
      const b = [];
      for (let i = 0; i < SIZE * SIZE; i++) {
        let c;
        do c = this.rand();
        while ((i % SIZE >= 2 && b[i - 1] === c && b[i - 2] === c) || (i >= 2 * SIZE && b[i - SIZE] === c && b[i - 2 * SIZE] === c));
        b.push(c);
      }
      if (this.hasMove(b)) return b;
    }
  }

  /** The runs of 3+ of a colour: [[cells...], ...] (a cell in a row and a column run is in both). */
  lines(b) {
    const out = [];
    for (let y = 0; y < SIZE; y++) {
      let run = [y * SIZE];
      for (let x = 1; x <= SIZE; x++) {
        const i = y * SIZE + x;
        if (x < SIZE && b[i] === b[run[0]] && b[i] !== null) run.push(i);
        else {
          if (run.length >= 3 && b[run[0]] !== null) out.push(run);
          run = [i];
        }
      }
    }
    for (let x = 0; x < SIZE; x++) {
      let run = [x];
      for (let y = 1; y <= SIZE; y++) {
        const i = y * SIZE + x;
        if (y < SIZE && b[i] === b[run[0]] && b[i] !== null) run.push(i);
        else {
          if (run.length >= 3 && b[run[0]] !== null) out.push(run);
          run = [i];
        }
      }
    }
    return out;
  }

  adjacent(a, b) {
    const [ax, ay, bx, by] = [a % SIZE, Math.floor(a / SIZE), b % SIZE, Math.floor(b / SIZE)];
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  hasMove(b) {
    for (let i = 0; i < SIZE * SIZE; i++) {
      for (const j of [i + 1, i + SIZE]) {
        if (j >= SIZE * SIZE || !this.adjacent(i, j)) continue;
        const t = b.slice();
        [t[i], t[j]] = [t[j], t[i]];
        if (this.lines(t).length) return true;
      }
    }
    return false;
  }

  /** Clear the lines, let gems fall, drop new ones in; again while lines form. Returns the steps. */
  resolve() {
    const steps = [];
    for (let chain = 1; ; chain++) {
      const lines = this.lines(this.board);
      if (!lines.length) break;
      const cleared = new Set();
      for (const run of lines) {
        run.forEach((i) => cleared.add(i));
        this.biggest = Math.max(this.biggest, run.length);
        if (run.length === 4) this.score += POINTS.four * chain;
        if (run.length >= 5) this.score += POINTS.five * chain;
      }
      this.score += cleared.size * POINTS.gem * chain;
      this.bestChain = Math.max(this.bestChain, chain);
      for (const i of cleared) this.board[i] = null;
      // Gravity, column by column, then new gems from the top.
      for (let x = 0; x < SIZE; x++) {
        const col = [];
        for (let y = SIZE - 1; y >= 0; y--) if (this.board[y * SIZE + x] !== null) col.push(this.board[y * SIZE + x]);
        for (let y = SIZE - 1, k = 0; y >= 0; y--, k++) this.board[y * SIZE + x] = k < col.length ? col[k] : this.rand();
      }
      steps.push({ cleared: [...cleared], board: this.board.slice(), chain });
    }
    return steps;
  }

  swap(a, b) {
    if (!this.adjacent(a, b)) return;
    const t = this.board.slice();
    [t[a], t[b]] = [t[b], t[a]];
    if (!this.lines(t).length) {
      this.nope++;
      this.last = { a, b, nope: true, steps: [] };
      return this.ctx.update();
    }
    this.board = t;
    this.swaps++;
    this.movesLeft--;
    this.last = { a, b, steps: this.resolve(), n: this.swaps };
    if (!this.movesLeft) this.phase = 'over';
    else if (!this.hasMove(this.board)) {
      this.board = this.freshBoard();
      this.reshuffles++;
    }
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'swap' || this.phase !== 'play') return;
    const { a, b } = input;
    if (![a, b].every((i) => Number.isInteger(i) && i >= 0 && i < SIZE * SIZE)) return;
    this.swap(a, b);
  }

  view() {
    return {
      phase: this.phase,
      look: this.look,
      size: SIZE,
      board: this.board,
      last: this.last,
      nope: this.nope,
      swaps: this.swaps,
      reshuffles: this.reshuffles,
      movesLeft: this.movesLeft,
      bestChain: this.bestChain,
      biggest: this.biggest,
      score: this.score,
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
  id: 'gems',
  name: 'Gem Swap',
  tagline: 'Swap gems to line up three of a colour. Chains score more. 30 swaps.',
  category: 'puzzle',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Gems(ctx, ctx.rng),
};
