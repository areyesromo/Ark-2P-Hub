// Ludo, for two. Four pawns each start in your yard. Roll a 6 to bring one out onto your start
// square; a 6 also rolls again (three 6s in a row and your turn ends). Move a pawn round the board
// by the roll; land on a lone pawn of theirs (not on a star or a start square) and it goes back to
// their yard. After a lap your pawns turn up your home path and must land exactly in the middle.
// First to bring all four home wins.
//
// A pawn's place is how far it has come: -1 in the yard, 0 on its start square, up to 50 round the
// board, 51-55 up its home path, 56 home. The board's 52 squares are counted from player 1's start;
// player 2 starts opposite, on square 26.

import { settingOf } from './options.js';

export const LAP = 52;
export const HOME = 56;
export const STARTS = [0, 26];
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47]; // the starts and the stars
export const WIN_SCORE = 1;
export const TIMING = { rollMs: 12000, moveMs: 15000, showMs: 900, gameEndMs: 6000 };

/** The square on the board for a place (or null: in the yard, on the home path, or home). */
export function squareOf(slot, place) {
  return place < 0 || place > 50 ? null : (STARTS[slot] + place) % LAP;
}

/** Where pawn `i` would go with roll `d` (or null if it can't move). */
export function target(pawns, slot, i, d) {
  const p = pawns[slot][i];
  if (p === HOME) return null;
  if (p < 0) return d === 6 ? 0 : null;
  const to = p + d;
  return to > HOME ? null : to;
}

export function movable(pawns, slot, d) {
  return [0, 1, 2, 3].filter((i) => target(pawns, slot, i, d) !== null);
}

export class Ludo {
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
    this.gameNo = 0;
    this.winner = null;
    this.starter = 1;
    this.newGame();
  }

  newGame() {
    this.gameNo++;
    this.starter = 1 - this.starter;
    this.pawns = [[-1, -1, -1, -1], [-1, -1, -1, -1]];
    this.turn = this.starter;
    this.die = null;
    this.sixes = 0;
    this.last = null; // { slot, pawn, from, to, hit }
    this.result = null;
    this.rollNo = 0;
    this.startRoll();
  }

  // ---- a turn ---------------------------------------------------------------------------

  startRoll() {
    this.phase = 'roll';
    this.movable = [];
    this.arm(TIMING.rollMs, 'roll', true);
  }

  roll() {
    this.die = 1 + Math.floor(this.rng() * 6);
    this.rollNo++;
    this.sixes = this.die === 6 ? this.sixes + 1 : 0;
    // Three 6s in a row: the turn is over.
    if (this.sixes === 3) {
      this.sixes = 0;
      this.movable = [];
      this.phase = 'show';
      return this.arm(TIMING.showMs, 'nextTurn');
    }
    this.movable = movable(this.pawns, this.turn, this.die);
    if (!this.movable.length) {
      this.phase = 'show';
      return this.arm(TIMING.showMs, this.die === 6 ? 'startRoll' : 'nextTurn');
    }
    this.phase = 'move';
    this.arm(TIMING.moveMs, 'moveTimeUp', true);
  }

  /** Out of time: a pawn that can move goes, any one (as the other turn-clock games do). */
  moveTimeUp() {
    this.move(this.turn, this.movable[Math.floor(this.rng() * this.movable.length)]);
  }

  move(slot, i) {
    const from = this.pawns[slot][i];
    const to = target(this.pawns, slot, i, this.die);
    this.pawns[slot][i] = to;
    let hit = null;
    const sq = squareOf(slot, to);
    if (sq !== null && !SAFE.includes(sq)) {
      const other = 1 - slot;
      const there = [0, 1, 2, 3].filter((j) => squareOf(other, this.pawns[other][j]) === sq);
      // A lone pawn is sent home (two together are safe).
      if (there.length === 1) {
        hit = there[0];
        this.pawns[other][hit] = -1;
      }
    }
    this.last = { slot, pawn: i, from, to, hit };
    this.movable = [];
    if (this.pawns[slot].every((p) => p === HOME)) return this.endGame(slot);
    // A 6 rolls again; so does sending one of theirs home or bringing a pawn home.
    if (this.die === 6 || hit !== null || to === HOME) return this.startRoll();
    this.nextTurn();
  }

  nextTurn() {
    this.turn = 1 - this.turn;
    this.sixes = 0;
    this.startRoll();
  }

  endGame(w) {
    this.clearTimer();
    this.scores[w]++;
    this.result = { winner: w };
    this.deadline = null;
    if (this.scores[w] >= this.winScore) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'gameEnd';
    this.arm(TIMING.gameEndMs, 'newGame');
  }

  // ---- the clock --------------------------------------------------------------------------

  /** One timer at a time, its callback a method name. `playerClock`: a wait the Timer setting can turn off. */
  arm(ms, then, playerClock) {
    this.clearTimer();
    this.after = then;
    this.deadline = playerClock && this.clock ? this.ctx.now() + ms : null;
    this.ctx.update();
    if (playerClock && !this.clock) return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (!this.clock && (this.after === 'roll' || this.after === 'moveTimeUp')) return;
    if (this.deadline) this.deadline += downMs;
    const then = this.after;
    const ms = Math.max(0, this.due + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  // ---- input -------------------------------------------------------------------------------

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (slot !== this.turn) return;
    if (input.type === 'roll' && this.phase === 'roll') return this.roll();
    if (input.type === 'move' && this.phase === 'move') {
      const i = input.pawn;
      if (!Number.isInteger(i) || !this.movable.includes(i)) return;
      this.move(slot, i);
    }
  }

  // ---- views -------------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      game: this.gameNo,
      pawns: this.pawns,
      turn: this.turn,
      die: this.die,
      rollNo: this.rollNo,
      sixes: this.sixes,
      movable: this.phase === 'move' ? this.movable : [],
      targets: this.phase === 'move' ? this.movable.map((i) => target(this.pawns, this.turn, i, this.die)) : [],
      last: this.last,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
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
  id: 'ludo',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Ludo',
  tagline: 'Roll a 6 to bring a pawn out, race round the board and send theirs back to the yard. First to bring all four home.',
  create: (ctx) => new Ludo(ctx),
};
