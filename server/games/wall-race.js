// Wall Race (a race through a maze you build as you go). A 9 x 9 board (or 7 x 7); your pawn starts
// in the middle of your edge, and the first to reach the far edge wins. On your turn either step
// your pawn one square (up, down, left or right; not through a wall), or place one of your walls
// (10 each; 8 on the small board). A wall is two squares long and sits in the grooves between the
// squares; walls can't overlap or cross, and must always leave both of you a way through. Pawns
// face to face: you may jump over the other pawn, or, with a wall (or the edge) behind it, step
// diagonally round it. Who starts swaps every game; first to the games needed. Out of time: you
// miss your turn.

import { settingOf } from './options.js';

export const SIZE = 9;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 30000, gameEndMs: 5000 };
const STEPS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/**
 * The board: n x n squares (cell = y * n + x). Walls sit on the (n - 1) x (n - 1) grooves'
 * crossings: h[k] (k = y * (n - 1) + x) is a wall under squares (x, y) and (x + 1, y); v[k] a wall
 * to the right of (x, y) and (x, y + 1).
 */
export function blocked(n, h, v, x, y, dx, dy) {
  const m = n - 1;
  if (dy) {
    const row = dy > 0 ? y : y - 1; // the groove between rows row and row + 1
    return Boolean((x < m && h[row * m + x]) || (x > 0 && h[row * m + x - 1]));
  }
  const col = dx > 0 ? x : x - 1;
  return Boolean((y < m && v[y * m + col]) || (y > 0 && v[(y - 1) * m + col]));
}

/** The squares a pawn can step to from `cell` ignoring pawns. */
function open(n, h, v, cell) {
  const x = cell % n;
  const y = Math.floor(cell / n);
  const out = [];
  for (const [dx, dy] of STEPS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n || blocked(n, h, v, x, y, dx, dy)) continue;
    out.push(ny * n + nx);
  }
  return out;
}

/** Steps from `cell` to the goal row (`goal`: 0 or n - 1) through the walls, or -1 if cut off. */
export function distance(n, h, v, cell, goal) {
  if (Math.floor(cell / n) === goal) return 0;
  const seen = new Int16Array(n * n).fill(-1);
  seen[cell] = 0;
  const queue = [cell];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    for (const m of open(n, h, v, c)) {
      if (seen[m] >= 0) continue;
      seen[m] = seen[c] + 1;
      if (Math.floor(m / n) === goal) return seen[m];
      queue.push(m);
    }
  }
  return -1;
}

/** Where the pawn at `pawns[s]` may move (jumps and side-steps round the other pawn included). */
export function pawnMoves(n, h, v, pawns, s) {
  const me = pawns[s];
  const them = pawns[1 - s];
  const out = [];
  for (const c of open(n, h, v, me)) {
    if (c !== them) { out.push(c); continue; }
    // Face to face: jump straight over if nothing's behind them, else step round to either side.
    const dx = (c % n) - (me % n);
    const dy = Math.floor(c / n) - Math.floor(me / n);
    const tx = c % n;
    const ty = Math.floor(c / n);
    const bx = tx + dx;
    const by = ty + dy;
    if (bx >= 0 && by >= 0 && bx < n && by < n && !blocked(n, h, v, tx, ty, dx, dy)) out.push(by * n + bx);
    else for (const s2 of open(n, h, v, c)) if (s2 !== me && !out.includes(s2)) out.push(s2);
  }
  return out;
}

/** May a wall go at groove crossing `k` (`dir` 'h' or 'v')? It mustn't overlap, cross, or cut anyone off. */
export function wallOk(n, h, v, pawns, goals, dir, k) {
  const m = n - 1;
  if (!Number.isInteger(k) || k < 0 || k >= m * m || h[k] || v[k]) return false;
  const x = k % m;
  const y = Math.floor(k / m);
  if (dir === 'h' && ((x > 0 && h[k - 1]) || (x < m - 1 && h[k + 1]))) return false;
  if (dir === 'v' && ((y > 0 && v[k - m]) || (y < m - 1 && v[k + m]))) return false;
  const nh = dir === 'h' ? h.slice() : h;
  const nv = dir === 'v' ? v.slice() : v;
  (dir === 'h' ? nh : nv)[k] = 1;
  return distance(n, nh, nv, pawns[0], goals[0]) >= 0 && distance(n, nh, nv, pawns[1], goals[1]) >= 0;
}

export class WallRace {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.size = settingOf(ctx, 'size', SIZE);
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
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

  /** The row each player is racing to: player 1 starts at the bottom and heads up. */
  get goals() {
    return [0, this.size - 1];
  }

  newRound() {
    const n = this.size;
    this.round++;
    this.h = new Array((n - 1) * (n - 1)).fill(0);
    this.v = new Array((n - 1) * (n - 1)).fill(0);
    this.pawns = [(n - 1) * n + Math.floor(n / 2), Math.floor(n / 2)];
    this.wallsLeft = n === 9 ? [10, 10] : [8, 8];
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null; // { by, kind: 'step' | 'wall' | 'pass', n, ... }
    this.moves = 0;
    this.result = null;
    this.phase = 'play';
    this.startTurn();
  }

  startTurn() {
    this.clearTimer();
    this.turnEnds = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.ctx.update();
    if (this.clock) this.timer = this.ctx.setTimeout(() => { this.timer = null; this.timeUp(); }, TIMING.turnMs);
  }

  /** Out of time: you miss your turn. */
  timeUp() {
    if (this.phase !== 'play') return;
    this.moves++;
    this.lastMove = { by: this.turn, kind: 'pass', n: this.moves };
    this.turn = 1 - this.turn;
    this.startTurn();
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.turnEnds) {
      this.turnEnds += downMs;
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.timeUp(); }, Math.max(0, this.turnEnds - this.ctx.now()));
    } else if (this.phase === 'roundEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.gameEndMs);
    }
  }

  step(s, cell) {
    const from = this.pawns[s];
    this.pawns[s] = cell;
    this.moves++;
    this.lastMove = { by: s, kind: 'step', from, to: cell, n: this.moves };
    if (Math.floor(cell / this.size) === this.goals[s]) return this.endRound(s);
    this.turn = 1 - s;
    this.startTurn();
  }

  wall(s, dir, k) {
    (dir === 'h' ? this.h : this.v)[k] = s + 1;
    this.wallsLeft[s]--;
    this.moves++;
    this.lastMove = { by: s, kind: 'wall', dir, k, n: this.moves };
    this.turn = 1 - s;
    this.startTurn();
  }

  endRound(w) {
    this.clearTimer();
    this.turnEnds = null;
    this.scores[w]++;
    this.result = { winner: w };
    if (this.scores[w] >= this.winScore) {
      this.winner = w;
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
    if (input.type === 'step') {
      if (!pawnMoves(this.size, this.h, this.v, this.pawns, slot).includes(input.cell)) return;
      return this.step(slot, input.cell);
    }
    if (input.type === 'wall' && (input.dir === 'h' || input.dir === 'v') && this.wallsLeft[slot] > 0) {
      if (!wallOk(this.size, this.h, this.v, this.pawns, this.goals, input.dir, input.k)) return;
      this.wall(slot, input.dir, input.k);
    }
  }

  view() {
    const n = this.size;
    return {
      phase: this.phase,
      round: this.round,
      size: n,
      h: this.h,
      v: this.v,
      pawns: this.pawns,
      goals: this.goals,
      wallsLeft: this.wallsLeft,
      steps: this.phase === 'play' ? pawnMoves(n, this.h, this.v, this.pawns, this.turn) : [],
      // How far each still has to go (the shortest way round the walls).
      distances: [0, 1].map((s) => distance(n, this.h, this.v, this.pawns[s], this.goals[s])),
      turn: this.turn,
      lastMove: this.lastMove,
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
  id: 'wall-race',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Wall Race',
  tagline: 'Race your pawn to the far side, or drop a wall in the other\'s way. Every wall must leave a way through.',
  create: (ctx) => new WallRace(ctx),
};
