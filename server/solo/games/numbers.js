// Number Memory. A number shows for a moment, then hides: type it back. Get it
// right and the next one is a digit longer. You can miss once (you get another
// number the same length); the second miss ends the run. Score: the most
// digits you remembered.

export const FIRST = 3; // digits in the first number
export const LIVES = 2;
export const TIMING = { readyMs: 1200, perDigitMs: 650, baseMs: 1000, resultMs: 1600 };

export class Numbers {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.length = FIRST;
    this.best = 0; // the longest remembered
    this.lives = LIVES;
    this.round = 0;
    this.result = null; // { ok, number, typed, n }: the last answer, shown after it
    this.phase = 'ready';
    this.schedule(() => this.show(), TIMING.readyMs);
    this.ctx.update();
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
      this.ctx.update();
    }, ms);
  }

  /** A number of this.length digits, not starting with 0. */
  deal() {
    let s = String(1 + Math.floor(this.rng() * 9));
    while (s.length < this.length) s += Math.floor(this.rng() * 10);
    return s;
  }

  show() {
    this.round++;
    this.number = this.deal();
    this.phase = 'show';
    this.showMs = TIMING.baseMs + this.length * TIMING.perDigitMs;
    this.schedule(() => {
      this.phase = 'answer';
    }, this.showMs);
  }

  answer(typed) {
    const ok = typed === this.number;
    this.result = { ok, number: this.number, typed, n: this.round };
    if (ok) {
      this.best = this.length;
      this.length++;
    } else this.lives--;
    if (this.lives <= 0) {
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    this.phase = 'result';
    this.schedule(() => this.show(), TIMING.resultMs);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'answer' || (this.phase !== 'answer' && this.phase !== 'show')) return;
    if (typeof input.digits !== 'string' || !/^[0-9]{1,40}$/.test(input.digits)) return;
    if (this.phase === 'show' && this.timer) this.ctx.clearTimeout(this.timer); // answering early is fine
    this.timer = null;
    this.answer(input.digits);
    this.ctx.update();
  }

  view() {
    return {
      phase: this.phase,
      // The number only while it's showing; after an answer it's in the result.
      number: this.phase === 'show' ? this.number : null,
      showMs: this.phase === 'show' ? this.showMs : 0,
      length: this.length,
      lives: this.lives,
      round: this.round,
      result: this.result,
      score: this.best,
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
  id: 'numbers',
  name: 'Number Memory',
  tagline: 'Remember the number, then type it back. One digit longer every time.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Numbers(ctx, ctx.rng),
};
