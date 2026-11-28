// Snakes & Ladders, with a choice. A board of 100 squares, winding up from 1 at the bottom to 100
// at the top. On your turn roll two dice and move your counter by either one of them (you choose).
// Land at the foot of a ladder and climb it; land on a snake's head and slide down to its tail.
// You must land on 100 exactly: a throw that goes past bounces back off the end. Land right on the
// other's counter (after any ladder or snake) and you bump it back 10 squares. First to 100 wins.
// Who starts swaps every game; first to the games needed. Out of time rolling: the dice roll for
// you; out of time choosing: you stay where you are.

import { settingOf } from './options.js';

export const WIN_SCORE = 1;
export const TIMING = { rollMs: 15000, chooseMs: 15000, moveMs: 1400, gameEndMs: 5000 };
// Our own board: ladders go up, snakes come down.
export const LADDERS = { 3: 22, 8: 30, 17: 45, 28: 55, 39: 60, 50: 72, 63: 81, 70: 89 };
export const SNAKES = { 99: 41, 95: 75, 92: 71, 87: 57, 74: 53, 62: 19, 54: 34, 47: 26, 33: 12, 24: 6 };
export const BUMP = 10;

/** Where a counter on `from` ends up moving `steps`: bounced off 100, then up a ladder or down a snake. */
export function landing(from, steps) {
  let to = from + steps;
  if (to > 100) to = 200 - to;
  return LADDERS[to] || SNAKES[to] || to;
}

export class SnakesLadders {
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
    this.starter = 1;
    this.winner = null;
    this.newRound();
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    this.pos = [0, 0]; // 0: off the board, before square 1
    this.turn = this.starter;
    this.dice = [];
    this.lastMove = null; // { by, from, steps, to, n, via: 'ladder' | 'snake' | null }
    this.n = 0;
    this.result = null;
    this.startTurn();
  }

  startTurn() {
    this.dice = [];
    this.phase = 'roll';
    this.armClock(TIMING.rollMs, 'rollTimeUp');
  }

  rollTimeUp() {
    this.roll();
  }

  roll() {
    this.dice = [1 + Math.floor(this.rng() * 6), 1 + Math.floor(this.rng() * 6)];
    this.n++;
    this.phase = 'choose';
    this.armClock(TIMING.chooseMs, 'chooseTimeUp');
  }

  /** Out of time choosing: you don't move. */
  chooseTimeUp() {
    this.n++;
    this.lastMove = { by: this.turn, from: this.pos[this.turn], steps: 0, mid: this.pos[this.turn], to: this.pos[this.turn], n: this.n, via: null, missed: true };
    this.turn = 1 - this.turn;
    this.phase = 'moving';
    this.deadline = null;
    this.arm(TIMING.moveMs, 'startTurn');
  }

  move(which) {
    const s = this.turn;
    const steps = this.dice[which];
    const from = this.pos[s];
    let mid = from + steps;
    if (mid > 100) mid = 200 - mid;
    const to = landing(from, steps);
    this.pos[s] = to;
    this.n++;
    // Right on the other's counter: bump it back.
    const bumped = to > 0 && to < 100 && this.pos[1 - s] === to;
    if (bumped) this.pos[1 - s] = Math.max(0, to - BUMP);
    this.lastMove = { by: s, from, steps, mid, to, n: this.n, via: LADDERS[mid] ? 'ladder' : SNAKES[mid] ? 'snake' : null, bumped };
    if (to === 100) return this.endRound(s);
    this.turn = 1 - s;
    this.phase = 'moving';
    this.deadline = null;
    this.arm(TIMING.moveMs, 'startTurn');
  }

  endRound(w) {
    this.clearTimer();
    this.deadline = null;
    this.scores[w]++;
    this.result = { winner: w };
    this.turn = null;
    if (this.scores[w] >= this.winScore) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.gameEndMs, 'newRound');
  }

  armClock(ms, then) {
    this.deadline = this.clock ? this.ctx.now() + ms : null;
    this.arm(ms, then);
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && /TimeUp$/.test(then)) return;
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
    if (this.deadline) this.deadline += downMs;
    if (!this.clock && /TimeUp$/.test(this.after)) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (slot !== this.turn) return;
    if (input.type === 'roll' && this.phase === 'roll') return this.roll();
    if (input.type === 'move' && this.phase === 'choose' && (input.die === 0 || input.die === 1)) this.move(input.die);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      pos: this.pos,
      turn: this.turn,
      dice: this.dice,
      // Where each die would take the player to move (after any ladder or snake).
      options: this.phase === 'choose' ? this.dice.map((d) => landing(this.pos[this.turn], d)) : null,
      ladders: LADDERS,
      snakes: SNAKES,
      lastMove: this.lastMove,
      n: this.n,
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
  id: 'snakes-ladders',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Snakes & Ladders',
  tagline: 'Roll two dice and move by either one: climb the ladders, dodge the snakes. First to 100 exactly wins.',
  create: (ctx) => new SnakesLadders(ctx),
};
