// Lights Out. A 5 × 5 grid of lights, some on. Pressing a light switches it
// and the four next to it (on goes off, off goes on). Switch them all off.
// Every puzzle is made by pressing lights on a dark board, so it can always
// be solved, and the number of presses that made it is its par: you can
// always do it in that many (sometimes fewer). Score: the moves it took
// (fewer is better), per difficulty.

import { settingOf } from './options.js';

export const N = 5;
export const LEVELS = { easy: { name: 'Easy', presses: 4 }, medium: { name: 'Medium', presses: 8 }, hard: { name: 'Hard', presses: 13 } };

/** Press cell i on a board of 0/1: it and its neighbours switch. */
export function press(board, i) {
  const x = i % N;
  const y = Math.floor(i / N);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < N && ny < N) board[ny * N + nx] ^= 1;
  }
}

export class Lights {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const level = settingOf(ctx, 'level', 'medium');
    this.level = Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : 'medium';
  }

  start() {
    // Press some different lights on a dark board (never ending up dark again).
    const cells = [...Array(N * N).keys()];
    let board;
    do {
      board = Array(N * N).fill(0);
      for (let k = 0; k < LEVELS[this.level].presses; k++) {
        const j = k + Math.floor(this.rng() * (cells.length - k));
        [cells[k], cells[j]] = [cells[j], cells[k]];
        press(board, cells[k]);
      }
    } while (board.every((c) => !c));
    this.board = board;
    this.startBoard = board.slice();
    this.par = LEVELS[this.level].presses;
    this.moves = 0;
    this.resets = 0;
    this.selected = 12; // a controller's place, in the middle
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.phase = 'play';
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'reset') {
      // Back to the start (the moves keep counting).
      this.board = this.startBoard.slice();
      this.resets++;
      return this.ctx.update();
    }
    const i = input.cell;
    if (!Number.isInteger(i) || i < 0 || i >= N * N) return;
    if (input.type === 'select') {
      this.selected = i;
      return this.ctx.update();
    }
    if (input.type !== 'press') return;
    press(this.board, i);
    this.selected = i;
    this.moves++;
    if (this.board.every((c) => !c)) {
      this.endedAt = this.ctx.now();
      this.phase = 'over';
    }
    this.ctx.update();
  }

  view() {
    return {
      phase: this.phase,
      n: N,
      board: this.board,
      lit: this.board.filter(Boolean).length,
      selected: this.selected,
      moves: this.moves,
      par: this.par,
      resets: this.resets,
      elapsed: (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt,
      score: this.phase === 'over' ? this.moves : null,
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
  id: 'lights',
  name: 'Lights Out',
  tagline: 'Each press flips a light and its neighbours. Switch them all off in as few moves as you can.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'moves' },
  create: (ctx) => new Lights(ctx, ctx.rng),
};
