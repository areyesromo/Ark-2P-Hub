// Reaction Rush. Five rounds: the screen says WAIT… and then, after a random
// moment, GO! Tap as fast as you can. Tap before GO and it's a false start:
// that round starts again and 100 ms goes on your final time. Score: your
// average reaction time plus the penalties (lower is better).

export const ROUNDS = 5;
export const TIMING = {
  readyMs: 1500, // before the first round
  waitMinMs: 1500,
  waitMaxMs: 4500,
  slowMs: 2000, // no tap by then: the round counts as this
  betweenMs: 1400,
  falseStartMs: 1500, // how long "too soon" shows before the round starts again
};
export const PENALTY_MS = 100;

export class ReactionRush {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.times = [];
    this.falseStarts = 0;
    this.last = null; // { ms } or { early: true } for the round just played
    this.goAt = null;
    this.phase = 'ready';
    this.ctx.update();
    this.schedule(() => this.wait(), TIMING.readyMs);
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  wait() {
    this.phase = 'wait';
    this.goAt = null;
    this.ctx.update();
    const ms = TIMING.waitMinMs + Math.floor(this.rng() * (TIMING.waitMaxMs - TIMING.waitMinMs));
    this.schedule(() => this.go(), ms);
  }

  go() {
    this.phase = 'go';
    this.goAt = this.ctx.now();
    this.ctx.update();
    this.schedule(() => this.record(TIMING.slowMs), TIMING.slowMs);
  }

  record(ms) {
    this.times.push(ms);
    this.last = { ms };
    if (this.times.length >= ROUNDS) {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.phase = 'over';
      this.ctx.update();
      return;
    }
    this.phase = 'result';
    this.ctx.update();
    this.schedule(() => this.wait(), TIMING.betweenMs);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'tap') return;
    if (this.phase === 'wait') {
      this.falseStarts++;
      this.last = { early: true };
      this.phase = 'early';
      this.ctx.update();
      this.schedule(() => this.wait(), TIMING.falseStartMs);
    } else if (this.phase === 'go') {
      this.record(Math.min(TIMING.slowMs, Math.max(0, this.ctx.now() - this.goAt)));
    }
  }

  get average() {
    return this.times.length ? Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length) : 0;
  }

  view() {
    return {
      phase: this.phase,
      round: Math.min(ROUNDS, this.times.length + (this.phase === 'over' ? 0 : 1)),
      rounds: ROUNDS,
      times: this.times,
      last: this.last,
      falseStarts: this.falseStarts,
      penaltyMs: PENALTY_MS,
      average: this.average,
      fastest: this.times.length ? Math.min(...this.times) : null,
      score: this.phase === 'over' ? this.average + this.falseStarts * PENALTY_MS : null,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

export default {
  id: 'reaction-1p',
  name: 'Reaction Rush 1P',
  tagline: 'Wait for GO, then tap. Five rounds, your average time is your score.',
  category: 'brain',
  phone: true,
  music: 'off',
  score: { better: 'lower', unit: 'ms' },
  create: (ctx) => new ReactionRush(ctx, ctx.rng),
};
