// Five in a Row (gomoku). Take turns placing a stone on the 15 x 15 grid; the first to line up five
// or more of their own (across, down or diagonally) wins the game. A full board is a draw. With
// captures on (Pente's rule), placing a stone either side of exactly two of theirs takes that pair
// off the board, and taking five pairs also wins. Who starts swaps every game; first to the games
// needed. Each move has a clock: run out and a stone goes next to one already down.

import { settingOf } from './options.js';

export const SIZE = 15;
export const WIN_SCORE = 1;
export const CAPTURES_TO_WIN = 5;
export const TIMING = { turnMs: 30000, gameEndMs: 5000 };
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** The line of five or more through `cell` for its owner, or null. */
export function lineAt(board, cell) {
  const who = board[cell];
  if (!who) return null;
  const x0 = cell % SIZE;
  const y0 = Math.floor(cell / SIZE);
  for (const [dx, dy] of DIRS) {
    const line = [cell];
    for (const s of [1, -1]) {
      let x = x0 + dx * s;
      let y = y0 + dy * s;
      while (x >= 0 && y >= 0 && x < SIZE && y < SIZE && board[y * SIZE + x] === who) {
        line.push(y * SIZE + x);
        x += dx * s;
        y += dy * s;
      }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

/** The pairs `who` would take by playing `cell` (Pente): X O O X in any of the eight directions. */
export function capturesAt(board, cell, who) {
  const x0 = cell % SIZE;
  const y0 = Math.floor(cell / SIZE);
  const out = [];
  const other = 3 - who;
  for (const [dx, dy] of DIRS) {
    for (const s of [1, -1]) {
      const at = (k) => {
        const x = x0 + dx * s * k;
        const y = y0 + dy * s * k;
        return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? y * SIZE + x : -1;
      };
      const [a, b, c] = [at(1), at(2), at(3)];
      if (c >= 0 && board[a] === other && board[b] === other && board[c] === who) out.push(a, b);
    }
  }
  return out;
}

/** Empty cells next to a stone (or the middle, on an empty board). */
export function nearCells(board, reach = 1) {
  const out = [];
  let any = false;
  for (let c = 0; c < board.length; c++) {
    if (board[c]) { any = true; continue; }
    const x = c % SIZE;
    const y = Math.floor(c / SIZE);
    let near = false;
    for (let dy = -reach; dy <= reach && !near; dy++) {
      for (let dx = -reach; dx <= reach && !near; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny * SIZE + nx]) near = true;
      }
    }
    if (near) out.push(c);
  }
  return any ? out : [Math.floor((SIZE * SIZE) / 2)];
}

export class FiveInARow {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.capturing = settingOf(ctx, 'captures', 0) === 1;
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.starter = null;
    this.newRound();
  }

  newRound() {
    this.round++;
    this.board = new Array(SIZE * SIZE).fill(0);
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.taken = [0, 0]; // pairs captured
    this.lastMove = null; // { cell, by, n, took }
    this.moves = 0;
    this.line = null;
    this.result = null;
    this.phase = 'play';
    this.startTurn();
  }

  startTurn() {
    this.clearTimer();
    this.turnEnds = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.ctx.update();
    if (this.clock) this.scheduleTick();
  }

  scheduleTick() {
    this.clearTimer();
    const left = this.turnEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      if (this.turnEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleTick();
      } else {
        const near = nearCells(this.board);
        this.place(this.turn, near[Math.floor(this.rng() * near.length)]);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.turnEnds) {
      this.turnEnds += downMs;
      this.scheduleTick();
    } else if (this.phase === 'roundEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.gameEndMs);
    }
  }

  place(slot, cell) {
    const who = slot + 1;
    this.board[cell] = who;
    this.moves++;
    let took = [];
    if (this.capturing) {
      took = capturesAt(this.board, cell, who);
      for (const c of took) this.board[c] = 0;
      this.taken[slot] += took.length / 2;
    }
    this.lastMove = { cell, by: slot, n: this.moves, took };
    const line = lineAt(this.board, cell);
    if (line) return this.endRound(slot, line);
    if (this.capturing && this.taken[slot] >= CAPTURES_TO_WIN) return this.endRound(slot, null);
    if (this.board.every(Boolean)) return this.endRound(null, null);
    this.turn = 1 - slot;
    this.startTurn();
  }

  endRound(winner, line) {
    this.clearTimer();
    this.line = line;
    this.result = { winner, how: line ? 'five' : winner === null ? 'full' : 'captures' };
    this.turnEnds = null;
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.gameEndMs);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'place' || this.phase !== 'play' || slot !== this.turn) return;
    const cell = input.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || this.board[cell]) return;
    this.place(slot, cell);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      size: SIZE,
      board: this.board,
      turn: this.turn,
      lastMove: this.lastMove,
      line: this.line,
      captures: this.capturing,
      taken: this.taken,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.phase === 'play' && this.turnEnds ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot });
  }
}

export default {
  id: 'five-in-a-row',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Five in a Row',
  tagline: 'Take turns placing stones on a big grid. Five in a line, any direction, wins.',
  create: (ctx) => new FiveInARow(ctx),
};
