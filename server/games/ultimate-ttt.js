// Ultimate Tic-tac-toe. Nine little noughts-and-crosses boards make one big one. Take turns placing
// your mark in a little board; where you play sends the other player to the matching board (play
// the top-right square of a board, and they must play in the top-right board). Three in a row on a
// little board wins it; three little boards in a row wins the game. Sent to a board that's already
// won or full? Play anywhere open. If no line can be made the game is a draw. Who starts swaps every
// game; first to the games needed. Each move has a clock: run out and a random square is played.

import { settingOf } from './options.js';

export const WIN_SCORE = 1;
export const TIMING = { turnMs: 30000, gameEndMs: 5000 };
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** The line made by `who` in nine squares, or null. */
export function lineOf(nine, who) {
  for (const l of LINES) if (nine[l[0]] === who && nine[l[1]] === who && nine[l[2]] === who) return l;
  return null;
}

/**
 * A fresh position: cells[b * 9 + i] (board b, square i) 0 / 1 / 2; boards[b]: 0 open, 1 or 2 won,
 * 3 full with no winner; next: the board to play in, or -1 for any.
 */
export const newPosition = () => ({ cells: new Array(81).fill(0), boards: new Array(9).fill(0), next: -1, result: 0 });

/** Every square the player to move may take. */
export function legalMoves(pos) {
  const out = [];
  for (let b = 0; b < 9; b++) {
    if (pos.boards[b] || (pos.next >= 0 && pos.next !== b)) continue;
    for (let i = 0; i < 9; i++) if (!pos.cells[b * 9 + i]) out.push(b * 9 + i);
  }
  return out;
}

/** Plays `who`'s mark at `cell` in place. result: 0 going on, 1 or 2 a winner, 3 a draw. */
export function playMove(pos, cell, who) {
  pos.cells[cell] = who;
  const b = Math.floor(cell / 9);
  const nine = pos.cells.slice(b * 9, b * 9 + 9);
  if (lineOf(nine, who)) pos.boards[b] = who;
  else if (nine.every(Boolean)) pos.boards[b] = 3;
  const sent = cell % 9;
  pos.next = pos.boards[sent] ? -1 : sent;
  if (pos.boards[b] === who && lineOf(pos.boards, who)) pos.result = who;
  else if (pos.boards.every(Boolean) || !legalMoves(pos).length) pos.result = 3;
  return pos;
}

export class UltimateTtt {
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
    this.pos = newPosition();
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null; // { cell, by, n }
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
        const ok = legalMoves(this.pos);
        this.place(this.turn, ok[Math.floor(this.rng() * ok.length)]);
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
    playMove(this.pos, cell, slot + 1);
    this.moves++;
    this.lastMove = { cell, by: slot, n: this.moves };
    if (this.pos.result) return this.endRound(this.pos.result === 3 ? null : this.pos.result - 1);
    this.turn = 1 - slot;
    this.startTurn();
  }

  endRound(winner) {
    this.clearTimer();
    this.line = winner === null ? null : lineOf(this.pos.boards, winner + 1);
    this.result = { winner };
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
    if (!Number.isInteger(input.cell) || !legalMoves(this.pos).includes(input.cell)) return;
    this.place(slot, input.cell);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      cells: this.pos.cells,
      boards: this.pos.boards,
      next: this.pos.next,
      turn: this.turn,
      lastMove: this.lastMove,
      line: this.line,
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
  id: 'ultimate-ttt',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Ultimate Tic-tac-toe',
  tagline: 'Nine little boards in one big one. Where you play sends them to that board. Win three boards in a row.',
  create: (ctx) => new UltimateTtt(ctx),
};
