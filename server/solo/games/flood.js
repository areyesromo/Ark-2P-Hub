// Flood-It. A square of coloured cells. You own the top-left cell and everything
// of its colour touching it. Each move you pick a colour: your whole area turns
// that colour and swallows the cells of that colour next to it. Make the whole
// board one colour before the moves run out. The limit is worked out for each
// board by playing it greedily (always the colour that grabs the most), plus two
// spare moves, so every board can be done. Score: the moves you used (fewer is
// better), per size; running out doesn't count.

import { settingOf } from './options.js';

export const COLOURS = 6;
export const SIZES = {
  small: { name: '10 × 10', n: 10 },
  medium: { name: '14 × 14', n: 14 },
  large: { name: '18 × 18', n: 18 },
};
export const SPARE = 2; // moves beyond what the greedy player needs

/** The cells joined to the top-left one that share its colour. */
export function region(board, n) {
  const colour = board[0];
  const seen = new Set([0]);
  const todo = [0];
  while (todo.length) {
    const i = todo.pop();
    const x = i % n;
    const y = Math.floor(i / n);
    for (const j of [x > 0 && i - 1, x < n - 1 && i + 1, y > 0 && i - n, y < n - 1 && i + n]) {
      if (j !== false && !seen.has(j) && board[j] === colour) {
        seen.add(j);
        todo.push(j);
      }
    }
  }
  return seen;
}

/** The board after picking a colour. */
export function flood(board, n, colour) {
  const out = board.slice();
  for (const i of region(board, n)) out[i] = colour;
  return out;
}

/** A greedy player's picks: each time the colour that makes the area biggest (the lowest on a tie). */
export function plan(board, n) {
  const picks = [];
  let b = board.slice();
  while (!b.every((c) => c === b[0])) {
    let best = -1;
    let bestSize = -1;
    for (let c = 0; c < COLOURS; c++) {
      if (c === b[0]) continue;
      const size = region(flood(b, n, c), n).size;
      if (size > bestSize) {
        best = c;
        bestSize = size;
      }
    }
    picks.push(best);
    b = flood(b, n, best);
  }
  return picks;
}

export class Flood {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const size = settingOf(ctx, 'size', 'medium');
    this.size = Object.prototype.hasOwnProperty.call(SIZES, size) ? size : 'medium';
    this.n = SIZES[this.size].n;
  }

  start() {
    do this.board = Array.from({ length: this.n * this.n }, () => Math.floor(this.rng() * COLOURS));
    while (this.board.every((c) => c === this.board[0]));
    this.par = plan(this.board, this.n).length;
    this.limit = this.par + SPARE;
    this.moves = 0;
    this.won = false;
    this.phase = 'play';
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || input.type !== 'pick') return;
    const c = input.colour;
    // The colour you already are isn't a move.
    if (!Number.isInteger(c) || c < 0 || c >= COLOURS || c === this.board[0]) return;
    this.board = flood(this.board, this.n, c);
    this.moves++;
    if (this.board.every((x) => x === this.board[0])) {
      this.won = true;
      this.phase = 'over';
    } else if (this.moves >= this.limit) this.phase = 'over';
    this.ctx.update();
  }

  view() {
    return {
      phase: this.phase,
      n: this.n,
      colours: COLOURS,
      board: this.board,
      own: this.board[0],
      area: region(this.board, this.n).size,
      moves: this.moves,
      limit: this.limit,
      par: this.par,
      won: this.won,
      score: this.phase === 'over' && this.won ? this.moves : null,
      variant: SIZES[this.size].name,
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
  id: 'flood',
  name: 'Flood-It',
  tagline: 'Flood the board from the corner, one colour at a time, in as few moves as you can.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'moves' },
  create: (ctx) => new Flood(ctx, ctx.rng),
};
