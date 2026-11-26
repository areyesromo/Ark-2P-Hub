// Hex. A rhombus of hexagons (9 x 9, or 11 or 7). Player 1 owns the top and bottom edges, player 2
// the left and right. Take turns placing a stone anywhere empty; the first to join their two edges
// with an unbroken chain of their stones wins. A full board always has exactly one such chain, so
// there are no draws. Starting is a big advantage, so (with the swap rule on) after the first stone
// the other player may take it as their own instead of playing: it's mirrored across the board to
// suit their edges, and the turn passes back. Who starts swaps every game; first to the games
// needed. Each move has a clock: run out and a stone goes on a random empty hexagon.

import { settingOf } from './options.js';

export const SIZE = 9;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 30000, gameEndMs: 5000 };
// The six neighbours of (x, y) on the rhombus.
export const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

/** Neighbouring cells of `cell` on an n x n board. */
export function neighbours(cell, n) {
  const x = cell % n;
  const y = Math.floor(cell / n);
  const out = [];
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < n && ny < n) out.push(ny * n + nx);
  }
  return out;
}

/**
 * The chain joining `who`'s two edges (1: top to bottom, 2: left to right), or null. A
 * breadth-first walk from the first edge; the path back from the far edge is the chain to light up.
 */
export function chainFor(board, n, who) {
  const from = new Map();
  const queue = [];
  for (let k = 0; k < n; k++) {
    const c = who === 1 ? k : k * n;
    if (board[c] === who) { from.set(c, -1); queue.push(c); }
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const far = who === 1 ? Math.floor(c / n) === n - 1 : c % n === n - 1;
    if (far) {
      const path = [];
      for (let p = c; p !== -1; p = from.get(p)) path.push(p);
      return path;
    }
    for (const m of neighbours(c, n)) {
      if (board[m] === who && !from.has(m)) { from.set(m, c); queue.push(m); }
    }
  }
  return null;
}

/** Where a swapped first stone goes: mirrored across the long diagonal (x, y) to (y, x). */
export const mirror = (cell, n) => (cell % n) * n + Math.floor(cell / n);

export class Hex {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.size = settingOf(ctx, 'size', SIZE);
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.swapRule = settingOf(ctx, 'swap', 1) === 1;
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
    this.board = new Array(this.size * this.size).fill(0);
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null; // { cell, by, n, swapped }
    this.moves = 0;
    this.swapped = false;
    this.chain = null;
    this.result = null;
    this.phase = 'play';
    this.startTurn();
  }

  /** The swap is open to the second player, on their first go only. */
  get canSwap() {
    return this.swapRule && this.phase === 'play' && this.moves === 1 && !this.swapped;
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
        const empty = [];
        this.board.forEach((v, c) => { if (!v) empty.push(c); });
        this.place(this.turn, empty[Math.floor(this.rng() * empty.length)]);
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
    this.lastMove = { cell, by: slot, n: this.moves, swapped: false };
    const chain = chainFor(this.board, this.size, who);
    if (chain) return this.endRound(slot, chain);
    this.turn = 1 - slot;
    this.startTurn();
  }

  /** Take the first stone: it becomes yours, mirrored to suit your edges. */
  swap(slot) {
    const first = this.lastMove.cell;
    this.board[first] = 0;
    const cell = mirror(first, this.size);
    this.board[cell] = slot + 1;
    this.swapped = true;
    this.moves++;
    this.lastMove = { cell, by: slot, n: this.moves, swapped: true };
    this.turn = 1 - slot;
    this.startTurn();
  }

  endRound(winner, chain) {
    this.clearTimer();
    this.chain = chain;
    this.result = { winner };
    this.turnEnds = null;
    this.scores[winner]++;
    if (this.scores[winner] >= this.winScore) {
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
    if (this.phase !== 'play' || slot !== this.turn) return;
    if (input.type === 'swap' && this.canSwap) return this.swap(slot);
    if (input.type !== 'place') return;
    const cell = input.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= this.board.length || this.board[cell]) return;
    this.place(slot, cell);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      size: this.size,
      board: this.board,
      turn: this.turn,
      lastMove: this.lastMove,
      canSwap: this.canSwap,
      chain: this.chain,
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
  id: 'hex',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Hex',
  tagline: 'Take turns placing stones on a board of hexagons. Join your two edges with one chain to win; no draws.',
  create: (ctx) => new Hex(ctx),
};
