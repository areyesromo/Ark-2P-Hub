// Odd or Even. Each round you both show one to five fingers, picked in secret on your phones. One
// of you is Odd and the other Even (it swaps every round): an odd total is a point for Odd, an even
// one for Even. First to five points (or 3 or 7) wins. Guess what they'll show, and pick to match.
// Out of time: you lose the round.

import { settingOf } from './options.js';

export const WIN_SCORE = 5;
export const TIMING = { pickMs: 12000, revealMs: 3000 };

export class OddEven {
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
    this.history = []; // { odd, picks, point }
    this.winner = null;
    this.newRound();
  }

  /** Who's Odd this round: player 1 first, then turn about. */
  get odd() {
    return (this.round - 1) % 2;
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.picks = [null, null];
    this.result = null;
    this.phase = 'pick';
    this.deadline = this.clock ? this.ctx.now() + TIMING.pickMs : null;
    this.arm(TIMING.pickMs, 'pickTimeUp');
  }

  pickTimeUp() {
    this.reveal();
  }

  reveal() {
    this.clearTimer();
    this.deadline = null;
    const [a, b] = this.picks;
    let point;
    if (a === null && b === null) point = null;
    else if (a === null) point = 1; // out of time: the round goes to the other
    else if (b === null) point = 0;
    else point = (a + b) % 2 === 1 ? this.odd : 1 - this.odd;
    if (point !== null) this.scores[point]++;
    this.result = { odd: this.odd, picks: this.picks.slice(), total: a !== null && b !== null ? a + b : null, point };
    this.history.push({ odd: this.odd, picks: this.picks.slice(), point });
    if (point !== null && this.scores[point] >= this.winScore) {
      this.winner = point;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'reveal';
    this.arm(TIMING.revealMs, 'newRound');
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && then === 'pickTimeUp') return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'pick' || this.phase !== 'pick' || this.picks[slot] !== null) return;
    if (!Number.isInteger(input.fingers) || input.fingers < 1 || input.fingers > 5) return;
    this.picks[slot] = input.fingers;
    if (this.picks[0] !== null && this.picks[1] !== null) return this.reveal();
    this.ctx.update();
  }

  view(viewer) {
    return {
      phase: this.phase,
      round: this.round,
      odd: this.odd,
      locked: this.picks.map((p) => p !== null),
      mine: viewer === null ? null : this.picks[viewer],
      result: this.result,
      history: this.history,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot });
  }
}

export default {
  id: 'odd-even',
  handheld: true,
  music: 'thinking',
  name: 'Odd or Even',
  tagline: 'Show one to five fingers in secret. Odd total, a point to Odd; even, to Even. Guess their hand. First to 5.',
  create: (ctx) => new OddEven(ctx),
};
