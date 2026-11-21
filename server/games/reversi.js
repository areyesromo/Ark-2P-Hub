// Reversi. An 8×8 board starts with four discs in the middle. On your turn place a disc so that it
// traps a straight line (across, down or diagonal) of the other player's discs between it and one
// of yours: they all flip to your colour. A move must flip at least one disc; with no such move you
// pass. When neither of you can move (or the board is full), most discs wins the game. Who starts
// swaps every game; first to WIN_SCORE games. Each move has a clock: run out and a random legal
// move is played for you.

import { settingOf } from './options.js';

export const SIZE = 8;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 30000, passMs: 1600, roundEndMs: 5000 };

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** A fresh board: row-major cells, 0 empty, 1 player 1 (dark), 2 player 2 (light). */
export function newBoard() {
  const b = new Array(SIZE * SIZE).fill(0);
  const m = SIZE / 2;
  b[(m - 1) * SIZE + m - 1] = 2;
  b[m * SIZE + m] = 2;
  b[(m - 1) * SIZE + m] = 1;
  b[m * SIZE + m - 1] = 1;
  return b;
}

/** The discs `who` (1 or 2) would flip by playing `cell`, nearest first along each line ([] if none). */
export function flipsFor(board, cell, who) {
  if (board[cell]) return [];
  const x0 = cell % SIZE;
  const y0 = Math.floor(cell / SIZE);
  const out = [];
  for (const [dx, dy] of DIRS) {
    const line = [];
    let x = x0 + dx;
    let y = y0 + dy;
    while (x >= 0 && y >= 0 && x < SIZE && y < SIZE && board[y * SIZE + x] === 3 - who) {
      line.push(y * SIZE + x);
      x += dx;
      y += dy;
    }
    if (line.length && x >= 0 && y >= 0 && x < SIZE && y < SIZE && board[y * SIZE + x] === who) out.push(...line);
  }
  return out;
}

/** Every cell `who` may play. */
export function legalMoves(board, who) {
  const out = [];
  for (let c = 0; c < board.length; c++) if (!board[c] && flipsFor(board, c, who).length) out.push(c);
  return out;
}

export function countDiscs(board) {
  const n = [0, 0];
  for (const v of board) if (v) n[v - 1]++;
  return n;
}

export class Reversi {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.rng = rng;
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
    this.board = newBoard();
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null;
    this.passed = null; // who just had to pass (shown for a moment)
    this.result = null;
    this.moveNo = 0;
    this.phase = 'play';
    this.startTurn();
  }

  // ---- clock ------------------------------------------------------------------

  startTurn() {
    this.clearTimer();
    this.legal = legalMoves(this.board, this.turn + 1);
    if (!this.legal.length) return this.pass();
    if (!this.clock) {
      this.turnEnds = null;
      return this.ctx.update();
    }
    this.turnEnds = this.ctx.now() + TIMING.turnMs;
    this.ctx.update();
    this.scheduleTick();
  }

  /** No move for whoever's turn it is: the other goes, or, if they can't either, the game's over. */
  pass() {
    const other = 1 - this.turn;
    if (!legalMoves(this.board, other + 1).length) return this.endRound();
    this.passed = this.turn;
    this.turn = other;
    this.phase = 'pass';
    this.legal = [];
    this.turnEnds = null;
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.afterPass();
    }, TIMING.passMs);
  }

  afterPass() {
    this.phase = 'play';
    this.startTurn();
  }

  /** Picked up after a restart (RESUMES in index.js): the clock runs on, a pause or a finished game moves on. */
  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.turnEnds) {
      this.turnEnds += downMs;
      this.scheduleTick();
    } else if (this.phase === 'pass') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.afterPass(); }, TIMING.passMs);
    } else if (this.phase === 'roundEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.roundEndMs);
    }
  }

  /** Push the clock every second; play a random legal move when it runs out. */
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
        this.place(this.turn, this.legal[Math.floor(this.rng() * this.legal.length)]);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  // ---- moves --------------------------------------------------------------------

  place(slot, cell) {
    const flips = flipsFor(this.board, cell, slot + 1);
    if (!flips.length) return false;
    this.board[cell] = slot + 1;
    for (const f of flips) this.board[f] = slot + 1;
    this.moveNo++;
    this.lastMove = { cell, flips, by: slot, n: this.moveNo };
    this.passed = null;
    this.turn = 1 - slot;
    this.startTurn();
    return true;
  }

  endRound() {
    this.clearTimer();
    const [a, b] = countDiscs(this.board);
    const winner = a === b ? null : a > b ? 0 : 1;
    this.result = { winner, draw: winner === null, discs: [a, b] };
    this.legal = [];
    this.turnEnds = null;
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.newRound();
    }, TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'place' || this.phase !== 'play' || slot !== this.turn) return;
    const cell = input.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || !this.legal.includes(cell)) return;
    this.place(slot, cell);
  }

  // ---- views ----------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      round: this.round,
      size: SIZE,
      board: this.board,
      turn: this.turn,
      legal: this.legal,
      lastMove: this.lastMove,
      passed: this.passed,
      discs: countDiscs(this.board),
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.phase === 'play' && this.turnEnds ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      turnMs: TIMING.turnMs,
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
  id: 'reversi',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Reversi',
  tagline: 'Trap a line of their discs between two of yours and they all flip to your colour. Most discs on the board wins.',
  create: (ctx) => new Reversi(ctx),
};
