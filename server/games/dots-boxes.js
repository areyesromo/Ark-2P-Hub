// Dots and Boxes. Take turns drawing a line between two neighbouring dots; close the fourth side of
// a box to claim it and go again. When every line is drawn, the most boxes wins the round (a tie is
// a draw). Who starts swaps every round; each move has a clock (run out and a line is drawn for you).

import { settingOf } from './options.js';

export const SIZE = 4; // boxes per side
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 20000, roundEndMs: 4000 };

export class DotsBoxes {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.size = settingOf(ctx, 'size', SIZE);
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
    const n = this.size;
    this.round++;
    // Each line / box holds who drew / claimed it (a slot), or null.
    this.h = Array.from({ length: n + 1 }, () => new Array(n).fill(null)); // dot (r, c) to (r, c + 1)
    this.v = Array.from({ length: n }, () => new Array(n + 1).fill(null)); // dot (r, c) to (r + 1, c)
    this.boxes = Array.from({ length: n }, () => new Array(n).fill(null));
    this.score = [0, 0];
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastLine = null;
    this.lastBoxes = [];
    this.result = null;
    this.phase = 'play';
    this.startTurn();
  }

  // ---- clock ------------------------------------------------------------------------

  startTurn() {
    this.turnEnds = this.ctx.now() + TIMING.turnMs;
    this.ctx.update();
    this.scheduleTick();
  }

  /** Push the clock every second; draw a random open line when it runs out. */
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
        const open = this.openLines();
        const [dir, r, c] = open[Math.floor(this.rng() * open.length)];
        this.draw(this.turn, dir, r, c);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  openLines() {
    const out = [];
    this.h.forEach((row, r) => row.forEach((x, c) => { if (x === null) out.push(['h', r, c]); }));
    this.v.forEach((row, r) => row.forEach((x, c) => { if (x === null) out.push(['v', r, c]); }));
    return out;
  }

  // ---- moves ------------------------------------------------------------------------

  boxDone(r, c) {
    return this.h[r][c] !== null && this.h[r + 1][c] !== null && this.v[r][c] !== null && this.v[r][c + 1] !== null;
  }

  draw(slot, dir, r, c) {
    const lines = dir === 'h' ? this.h : this.v;
    lines[r][c] = slot;
    this.lastLine = { dir, r, c, by: slot };
    // The boxes this line borders: above / below an h-line, left / right of a v-line.
    const sides = dir === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
    this.lastBoxes = [];
    for (const [br, bc] of sides) {
      if (br < 0 || bc < 0 || br >= this.size || bc >= this.size || this.boxes[br][bc] !== null) continue;
      if (this.boxDone(br, bc)) {
        this.boxes[br][bc] = slot;
        this.score[slot]++;
        this.lastBoxes.push([br, bc]);
      }
    }
    if (this.score[0] + this.score[1] === this.size * this.size) return this.endRound();
    if (!this.lastBoxes.length) this.turn = 1 - slot; // closing a box: go again
    this.startTurn();
  }

  endRound() {
    this.clearTimer();
    const [a, b] = this.score;
    const winner = a === b ? null : a > b ? 0 : 1;
    this.result = { winner, draw: winner === null };
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      this.ctx.update();
      return;
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.newRound();
    }, TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (!input || typeof input !== 'object') return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'line' || this.phase !== 'play' || slot !== this.turn) return;
    const { dir, r, c } = input;
    const lines = dir === 'h' ? this.h : dir === 'v' ? this.v : null;
    if (!lines || !Number.isInteger(r) || !Number.isInteger(c) || !lines[r] || lines[r][c] !== null) return;
    this.draw(slot, dir, r, c);
  }

  // ---- views ------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      round: this.round,
      size: this.size,
      h: this.h,
      v: this.v,
      boxes: this.boxes,
      score: this.score,
      turn: this.turn,
      lastLine: this.lastLine,
      lastBoxes: this.lastBoxes,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
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
  id: 'dots-boxes',
  category: 'board',
  music: 'thinking',
  name: 'Dots and Boxes',
  tagline: 'Take turns joining two dots. Close the fourth side of a box to claim it and go again; careful not to hand your rival a chain. Most boxes wins.',
  create: (ctx) => new DotsBoxes(ctx),
};
