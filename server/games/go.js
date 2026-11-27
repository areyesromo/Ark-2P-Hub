// Go on a small board (9 x 9). Take turns placing a stone on an empty point (black first); stones
// never move. A group of stones with no empty point next to it is taken off the board. You may
// not play where your stone would have no liberty (unless it takes something), nor take back a
// single stone straight away in a "ko" (play elsewhere first). Pass when there's nothing useful
// left; two passes in a row end the game. Then dead stones (ones that can't escape) are taken off,
// and each of you scores your stones plus the empty points only you surround; white gets 6.5 more
// (komi) for moving second. Higher wins. You may also resign. Who plays black swaps every game;
// first to the games needed. Out of time: you pass.

import { settingOf } from './options.js';
import { neighboursOf, play, areaScore, removeDead } from './go-engine.js';

export const SIZE = 9;
export const KOMI = 6.5;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 30000, gameEndMs: 9000 };

export class Go {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.size = SIZE;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.black = null;
    this.newRound();
  }

  newRound() {
    this.round++;
    this.board = new Array(this.size * this.size).fill(0);
    this.black = this.black === null ? 0 : 1 - this.black; // the player with black
    this.turn = this.black;
    this.ko = -1;
    this.taken = [0, 0]; // stones each player has captured
    this.passes = 0;
    this.lastMove = null; // { by, cell (-1: a pass), n, took }
    this.moves = 0;
    this.result = null;
    this.phase = 'play';
    this.startTurn();
  }

  /** A player's colour: 1 black, 2 white. */
  colourOf(slot) {
    return slot === this.black ? 1 : 2;
  }

  startTurn() {
    this.clearTimer();
    this.turnEnds = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.ctx.update();
    if (this.clock) this.timer = this.ctx.setTimeout(() => { this.timer = null; if (this.phase === 'play') this.pass(this.turn); }, TIMING.turnMs);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.turnEnds) {
      this.turnEnds += downMs;
      this.timer = this.ctx.setTimeout(() => { this.timer = null; if (this.phase === 'play') this.pass(this.turn); }, Math.max(0, this.turnEnds - this.ctx.now()));
    } else if (this.phase === 'roundEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.gameEndMs);
    }
  }

  place(s, cell) {
    const out = { ko: -1 };
    const took = play(this.board, neighboursOf(this.size), cell, this.colourOf(s), this.ko, out);
    if (took < 0) return false;
    this.ko = out.ko;
    this.taken[s] += took;
    this.passes = 0;
    this.moves++;
    this.lastMove = { by: s, cell, n: this.moves, took };
    if (this.moves >= this.size * this.size * 3) return this.score(); // (a game that won't end)
    this.turn = 1 - s;
    this.startTurn();
    return true;
  }

  pass(s) {
    this.passes++;
    this.ko = -1;
    this.moves++;
    this.lastMove = { by: s, cell: -1, n: this.moves, took: 0 };
    if (this.passes >= 2) return this.score();
    this.turn = 1 - s;
    this.startTurn();
  }

  /** Both passed: take off the dead stones and count. */
  score() {
    const n = this.size;
    const { board, dead } = removeDead(this.board, n, this.colourOf(this.turn), this.rng);
    const [b, w] = areaScore(board, n, neighboursOf(n));
    const points = [0, 1].map((s) => (this.colourOf(s) === 1 ? b : w + KOMI));
    this.endRound(points[0] > points[1] ? 0 : 1, { points, dead, how: 'count' });
  }

  endRound(w, detail) {
    this.clearTimer();
    this.turnEnds = null;
    this.scores[w]++;
    this.result = { winner: w, ...detail };
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
    if (this.phase !== 'play') return;
    if (input.type === 'resign') return this.endRound(1 - slot, { how: 'resign', points: null, dead: [] });
    if (slot !== this.turn) return;
    if (input.type === 'pass') return this.pass(slot);
    if (input.type === 'place' && Number.isInteger(input.cell) && input.cell >= 0 && input.cell < this.board.length) this.place(slot, input.cell);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      size: this.size,
      board: this.board,
      black: this.black,
      komi: KOMI,
      ko: this.ko,
      turn: this.turn,
      passes: this.passes,
      taken: this.taken,
      moves: this.moves,
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
  id: 'go',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Go',
  tagline: 'The ancient game on a small 9 × 9 board: surround territory, capture stones with no breathing room. Most area wins.',
  create: (ctx) => new Go(ctx),
};
