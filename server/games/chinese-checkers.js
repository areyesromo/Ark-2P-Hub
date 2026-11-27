// Chinese Checkers for two, on the six-pointed star (121 holes). Your 10 pieces start in your
// point of the star; get them all into the point across the board. On your turn move one piece:
// one step to a hole next to it, or a chain of hops: over a piece next to it (anyone's) into the
// empty hole just beyond, and on from there as long as you can hop (you may stop anywhere along
// the way). Nothing is ever taken. The first to fill the far point wins; if the other player has
// left pieces there, a full point with all the rest of yours in it still wins. Who starts swaps
// every game; first to the games needed. After 150 moves each, the most pieces home wins (then the
// fewer steps still to go). Out of time: one of your pieces steps forward for you.

import { settingOf } from './options.js';

export const WIN_SCORE = 1;
export const MOVE_CAP = 150; // each
export const TIMING = { turnMs: 30000, gameEndMs: 5000 };
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

// The holes, in axial coordinates (q, r; the third, s = -q - r): the union of two big triangles.
export const HOLES = [];
for (let r = -8; r <= 8; r++) {
  for (let q = -8; q <= 8; q++) {
    const s = -q - r;
    if (Math.abs(s) > 8) continue;
    const up = q >= -4 && r >= -4 && s >= -4;
    const down = q <= 4 && r <= 4 && s <= 4;
    if (up || down) HOLES.push([q, r]);
  }
}
export const INDEX = new Map(HOLES.map(([q, r], i) => [q + ',' + r, i]));
export const at = (q, r) => (INDEX.has(q + ',' + r) ? INDEX.get(q + ',' + r) : -1);
export const NEIGHBOURS = HOLES.map(([q, r]) => DIRS.map(([dq, dr]) => at(q + dq, r + dr)));
// Player 1's point is the bottom one (r 5 … 8), player 2's the top (r -8 … -5); each heads for the other's.
export const HOMES = [HOLES.map((h, i) => (h[1] > 4 ? i : -1)).filter((i) => i >= 0), HOLES.map((h, i) => (h[1] < -4 ? i : -1)).filter((i) => i >= 0)];
export const GOALS = [HOMES[1], HOMES[0]];
// The far tip of each goal, for measuring how far a piece still has to go.
export const TIPS = [at(4, -8), at(-4, 8)];

/** Steps between two holes. */
export function hexDistance(a, b) {
  const [q1, r1] = HOLES[a];
  const [q2, r2] = HOLES[b];
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
}

/** Where the piece at `from` can go: steps, and every hole a chain of hops reaches. */
export function movesFrom(board, from) {
  const out = new Set();
  for (const n of NEIGHBOURS[from]) if (n >= 0 && !board[n]) out.add(n);
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const c = queue.shift();
    const [q, r] = HOLES[c];
    for (const [dq, dr] of DIRS) {
      const over = at(q + dq, r + dr);
      const land = at(q + 2 * dq, r + 2 * dr);
      if (over < 0 || land < 0 || !board[over] || (board[land] && land !== from) || seen.has(land)) continue;
      if (land === from) continue;
      seen.add(land);
      out.add(land);
      queue.push(land);
    }
  }
  return [...out];
}

/** Has player `s` won? Their goal point is full, and every piece of theirs that could be is in it. */
export function hasWon(board, s) {
  const goal = GOALS[s];
  if (goal.some((c) => !board[c])) return false;
  return goal.some((c) => board[c] === s + 1);
}

/** Steps still to go for `s`: each piece's distance to the far tip, less what a full point needs. */
export function stepsToGo(board, s) {
  let d = 0;
  board.forEach((v, c) => { if (v === s + 1) d += hexDistance(c, TIPS[s]); });
  return d - 20; // (a full point's own spread: 1·0 + 2·1 + 3·2 + 4·3)
}

export class ChineseCheckers {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
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

  newRound() {
    this.round++;
    this.board = new Array(HOLES.length).fill(0);
    for (const s of [0, 1]) for (const c of HOMES[s]) this.board[c] = s + 1;
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.moved = [0, 0];
    this.lastMove = null; // { by, from, to, n }
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

  /** Out of time: a piece steps forward for you (one that can, picked at random). */
  timeUp() {
    if (this.phase !== 'play') return;
    const s = this.turn;
    const forward = [];
    const any = [];
    this.board.forEach((v, c) => {
      if (v !== s + 1) return;
      for (const n of NEIGHBOURS[c]) {
        if (n < 0 || this.board[n]) continue;
        any.push([c, n]);
        if (hexDistance(n, TIPS[s]) < hexDistance(c, TIPS[s])) forward.push([c, n]);
      }
    });
    const list = forward.length ? forward : any;
    if (!list.length) return this.pass(s);
    const [from, to] = list[Math.floor(this.rng() * list.length)];
    this.move(s, from, to);
  }

  pass(s) {
    this.moves++;
    this.lastMove = { by: s, from: -1, to: -1, n: this.moves };
    this.turn = 1 - s;
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

  move(s, from, to) {
    this.board[from] = 0;
    this.board[to] = s + 1;
    this.moves++;
    this.moved[s]++;
    this.lastMove = { by: s, from, to, n: this.moves };
    if (hasWon(this.board, s)) return this.endRound(s, 'home');
    if (this.moved[0] >= MOVE_CAP && this.moved[1] >= MOVE_CAP) {
      // Out of moves: the most pieces home, then the fewer steps to go.
      const home = [0, 1].map((p) => GOALS[p].filter((c) => this.board[c] === p + 1).length);
      const left = [0, 1].map((p) => stepsToGo(this.board, p));
      const w = home[0] !== home[1] ? (home[0] > home[1] ? 0 : 1) : left[0] !== left[1] ? (left[0] < left[1] ? 0 : 1) : null;
      return this.endRound(w, 'moves');
    }
    this.turn = 1 - s;
    this.startTurn();
  }

  endRound(w, how) {
    this.clearTimer();
    this.turnEnds = null;
    this.result = { winner: w, how };
    if (w !== null) this.scores[w]++;
    if (w !== null && this.scores[w] >= this.winScore) {
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
    if (input.type !== 'move' || this.phase !== 'play' || slot !== this.turn) return;
    const { from, to } = input;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= HOLES.length || this.board[from] !== slot + 1) return;
    if (!movesFrom(this.board, from).includes(to)) return;
    this.move(slot, from, to);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      board: this.board,
      turn: this.turn,
      lastMove: this.lastMove,
      home: [0, 1].map((s) => GOALS[s].filter((c) => this.board[c] === s + 1).length),
      toGo: [0, 1].map((s) => stepsToGo(this.board, s)),
      moved: this.moved,
      moveCap: MOVE_CAP,
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
  id: 'chinese-checkers',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Chinese Checkers',
  tagline: 'Race your ten pieces across the star: step, or hop over pieces in long chains. First to fill the far point wins.',
  create: (ctx) => new ChineseCheckers(ctx),
};
