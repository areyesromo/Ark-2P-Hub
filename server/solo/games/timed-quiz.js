// The shared engine of the hub's against-the-clock games (Quick Maths, Colour
// Trap): a question with four choices, then the next one straight away. A right
// answer scores 1; a wrong one costs time. When the clock runs out it's over.
// Score: right answers.
//
// A game extends TimedQuiz with question() -> { ...what to show, options: [4], answer: index }
// and sets this.seconds / this.penaltyMs.

export const TIMING = { readyMs: 1500, tickMs: 250 };

export class TimedQuiz {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.seconds = 60;
    this.penaltyMs = 3000;
  }

  start() {
    this.right = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.answered = 0;
    this.last = null; // { ok, answer, n } the answer just given, for a flash on screen
    this.q = null;
    this.phase = 'ready';
    this.endsAt = null;
    this.schedule(() => this.begin(), TIMING.readyMs);
    this.ctx.update();
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  begin() {
    this.phase = 'play';
    this.endsAt = this.ctx.now() + this.seconds * 1000;
    this.q = this.question();
    this.tick();
  }

  /** Keep the clock moving on screen; stop when time's up. */
  tick() {
    if (this.ctx.now() >= this.endsAt) {
      this.phase = 'over';
      this.q = null;
      this.ctx.update();
      return;
    }
    this.ctx.update();
    this.schedule(() => this.tick(), Math.min(TIMING.tickMs, this.endsAt - this.ctx.now()));
  }

  shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'answer' || this.phase !== 'play' || !this.q) return;
    const c = input.choice;
    if (!Number.isInteger(c) || c < 0 || c >= this.q.options.length) return;
    const ok = c === this.q.answer;
    this.answered++;
    if (ok) {
      this.right++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.wrong++;
      this.streak = 0;
      this.endsAt -= this.penaltyMs;
    }
    this.last = { ok, answer: this.q.answer, chose: c, n: this.answered };
    this.q = this.question();
    this.tick();
  }

  view() {
    const q = this.q;
    return {
      phase: this.phase,
      // The question without its answer: that only shows (in `last`) once it's been answered.
      question: q ? Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'answer')) : null,
      last: this.last,
      timeLeft: this.phase === 'play' ? Math.max(0, this.endsAt - this.ctx.now()) : this.phase === 'ready' ? this.seconds * 1000 : 0,
      seconds: this.seconds,
      penaltyMs: this.penaltyMs,
      right: this.right,
      wrong: this.wrong,
      streak: this.streak,
      bestStreak: this.bestStreak,
      score: this.right,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}
