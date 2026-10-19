// Checkers (American draughts). An 8 × 8 board, 12 men each on the dark squares. Men move one
// square diagonally forward; reaching the far row crowns a king, which moves both ways. Jumps
// are forced, and a man that can keep jumping must (the same piece goes again). You lose the
// round with no pieces or no moves left; 40 moves without a capture or a man moving is a draw.
// Who starts swaps every round; each move has a clock (run out and a legal move is played).

import { settingOf } from './options.js';

export const SIZE = 8;
export const WIN_SCORE = 1;
export const QUIET_LIMIT = 40; // moves without a capture or a man moving: a draw
export const TIMING = { turnMs: 30000, roundEndMs: 4000 };

// Board codes: 0 empty, 1 P1 man, 2 P2 man, 3 P1 king, 4 P2 king. board[row][col]; row 0 is
// P2's back row (the top of the TV), row 7 P1's. Squares are [col, row].
const owner = (x) => (x ? (x - 1) % 2 : -1);
const isKing = (x) => x > 2;
const inside = (c, r) => c >= 0 && c < SIZE && r >= 0 && r < SIZE;
/** Row steps a piece may take: P1 men go up (-1), P2 men down (+1), kings both. */
const forward = (x) => (isKing(x) ? [-1, 1] : owner(x) === 0 ? [-1] : [1]);

function opening() {
  const b = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r <= 2) b[r][c] = 2;
      else if (r >= 5) b[r][c] = 1;
    }
  }
  return b;
}

function jumpsFrom(b, c, r) {
  const x = b[r][c];
  const out = [];
  for (const dr of forward(x)) {
    for (const dc of [-1, 1]) {
      const mc = c + dc;
      const mr = r + dr;
      const tc = c + dc * 2;
      const tr = r + dr * 2;
      if (!inside(tc, tr) || b[tr][tc]) continue;
      if (owner(b[mr][mc]) === 1 - owner(x)) out.push({ from: [c, r], to: [tc, tr] });
    }
  }
  return out;
}

function stepsFrom(b, c, r) {
  const out = [];
  for (const dr of forward(b[r][c])) {
    for (const dc of [-1, 1]) {
      if (inside(c + dc, r + dr) && !b[r + dr][c + dc]) out.push({ from: [c, r], to: [c + dc, r + dr] });
    }
  }
  return out;
}

/**
 * Every legal move for `slot`: jumps only when there are any (forced); `chain`, a square, limits
 * it to that piece's further jumps (mid multi-jump).
 */
export function legalMoves(b, slot, chain) {
  if (chain) return jumpsFrom(b, chain[0], chain[1]);
  const jumps = [];
  const steps = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (owner(b[r][c]) !== slot) continue;
      jumps.push(...jumpsFrom(b, c, r));
      steps.push(...stepsFrom(b, c, r));
    }
  }
  return jumps.length ? jumps : steps;
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export class Checkers {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
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
    this.board = opening();
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.chain = null;
    this.lastMove = null;
    this.result = null;
    this.quiet = 0;
    this.phase = 'play';
    this.legal = legalMoves(this.board, this.turn, null);
    this.startTurn();
  }

  // ---- clock ------------------------------------------------------------------------

  startTurn() {
    this.turnEnds = this.ctx.now() + TIMING.turnMs;
    this.ctx.update();
    this.scheduleTick();
  }

  /** Push the clock every second; play a legal move when it runs out. */
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
        const m = this.legal[Math.floor(this.rng() * this.legal.length)];
        this.move(this.turn, m.from, m.to);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  // ---- moves ------------------------------------------------------------------------

  move(slot, from, to) {
    if (!this.legal.some((m) => same(m.from, from) && same(m.to, to))) return false;
    const b = this.board;
    let x = b[from[1]][from[0]];
    b[from[1]][from[0]] = 0;
    const captured = [];
    if (Math.abs(to[0] - from[0]) === 2) {
      const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      b[mid[1]][mid[0]] = 0;
      captured.push(mid);
    }
    const crowned = !isKing(x) && to[1] === (slot === 0 ? 0 : SIZE - 1);
    if (crowned) x += 2;
    b[to[1]][to[0]] = x;
    this.lastMove = { from, to, captured };
    // Only a king's plain move counts towards the draw; a capture or a man moving resets it.
    const manMoved = crowned || !isKing(x);
    this.quiet = captured.length || manMoved ? 0 : this.quiet + 1;
    // A jump that can go on (and didn't just crown) keeps the same piece going.
    if (captured.length && !crowned) {
      const more = jumpsFrom(b, to[0], to[1]);
      if (more.length) {
        this.chain = to;
        this.legal = more;
        this.startTurn();
        return true;
      }
    }
    this.chain = null;
    if (!this.pieces(1 - slot)) return this.endRound(slot, 'pieces');
    if (this.quiet >= QUIET_LIMIT) return this.endRound(null, 'quiet');
    this.turn = 1 - slot;
    this.legal = legalMoves(b, this.turn, null);
    if (this.checkStuck()) return true;
    this.startTurn();
    return true;
  }

  pieces(slot) {
    return this.board.reduce((n, row) => n + row.filter((x) => owner(x) === slot).length, 0);
  }

  /** The player to move has no moves: they lose the round. */
  checkStuck() {
    if (this.phase !== 'play' || this.legal.length) return false;
    this.endRound(1 - this.turn, 'stuck');
    return true;
  }

  endRound(winner, why) {
    this.clearTimer();
    this.chain = null;
    this.legal = [];
    this.result = { winner, draw: winner === null, why };
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      this.ctx.update();
      return true;
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.newRound();
    }, TIMING.roundEndMs);
    return true;
  }

  onInput(slot, input) {
    if (!input || typeof input !== 'object') return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'move' || this.phase !== 'play' || slot !== this.turn) return;
    const ok = (sq) => Array.isArray(sq) && sq.length === 2 && sq.every((n) => Number.isInteger(n) && n >= 0 && n < SIZE);
    if (!ok(input.from) || !ok(input.to)) return;
    this.move(slot, input.from, input.to);
  }

  // ---- views ------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      round: this.round,
      size: SIZE,
      board: this.board,
      turn: this.turn,
      legal: this.phase === 'play' ? this.legal : [],
      chain: this.chain,
      lastMove: this.lastMove,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      pieces: [this.pieces(0), this.pieces(1)],
      timeLeftMs: this.phase === 'play' ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      turnMs: TIMING.turnMs,
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
  id: 'checkers',
  category: 'board',
  music: 'thinking',
  name: 'Checkers',
  tagline: 'Classic draughts: move diagonally, jump to capture (jumps are a must, and keep going if you can), reach the far side to crown a king. Take all their pieces or leave them stuck.',
  create: (ctx) => new Checkers(ctx),
};
