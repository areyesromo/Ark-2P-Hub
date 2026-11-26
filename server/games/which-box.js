// Which Box. Three boxes. Each round one of you hides the prize and the other seeks it, both picking
// a box in secret on your phones at the same time. The seeker finds it: a point to the seeker; the
// wrong box: a point to the hider. Then you swap. Five rounds each way (or 3 or 7); the most points
// wins. It's all about reading the other: which box do they like? Out of time to hide: the prize is
// left in plain sight (the seeker gets it); out of time to seek: you don't find it.

import { settingOf } from './options.js';

export const BOXES = 3;
export const ROUNDS = 5; // each way
export const TIMING = { pickMs: 15000, revealMs: 3200 };

export class WhichBox {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.each = settingOf(ctx, 'rounds', ROUNDS);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.history = []; // { hider, hid, sought, found }
    this.winner = null;
    this.newRound();
  }

  /** Who hides this round: player 1 first, then turn about. */
  get hider() {
    return (this.round - 1) % 2;
  }

  newRound() {
    this.clearTimer();
    if (this.round >= this.each * 2) return this.finish();
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
    const h = this.hider;
    const s = 1 - h;
    const hid = this.picks[h];
    const sought = this.picks[s];
    // No box hidden: it's in plain sight (the seeker's, if they looked at all). No look: not found.
    const found = sought !== null && (hid === null || hid === sought);
    const point = sought === null && hid === null ? null : found ? s : h;
    if (point !== null) this.scores[point]++;
    this.result = { hider: h, hid, sought, found, point };
    this.history.push({ hider: h, hid, sought, found });
    this.phase = 'reveal';
    this.arm(TIMING.revealMs, 'newRound');
  }

  finish() {
    this.clearTimer();
    this.phase = 'over';
    this.deadline = null;
    this.winner = this.scores[0] === this.scores[1] ? null : this.scores[0] > this.scores[1] ? 0 : 1;
    this.ctx.update();
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
    if (!Number.isInteger(input.box) || input.box < 0 || input.box >= BOXES) return;
    this.picks[slot] = input.box;
    if (this.picks[0] !== null && this.picks[1] !== null) return this.reveal();
    this.ctx.update();
  }

  view(viewer) {
    return {
      phase: this.phase,
      round: this.round,
      rounds: this.each * 2,
      hider: this.hider,
      locked: this.picks.map((p) => p !== null),
      mine: viewer === null ? null : this.picks[viewer], // (yours alone till the reveal)
      result: this.result,
      history: this.history,
      scores: this.scores,
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
  id: 'which-box',
  handheld: true,
  music: 'thinking',
  name: 'Which Box',
  tagline: 'Hide the prize in one of three boxes; the other guesses which. Swap and swap again: read them, fool them.',
  create: (ctx) => new WhichBox(ctx),
};
