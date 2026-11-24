// Trivia. Twelve questions, four answers each, 15 seconds a question. A right
// answer scores 100 plus up to 100 more the faster you are; a wrong one, or
// running out of time, scores nothing. After each answer the right one is
// shown for a moment. Questions don't come round again in the same room until
// you've seen them all. Score: points.

import { settingOf } from './options.js';
import { QUESTIONS, CATEGORIES } from './trivia-questions.js';

export const ROUND = 12;
export const TIMING = { readyMs: 1500, questionMs: 15000, revealMs: 2200, tickMs: 250 };
export const POINTS = { right: 100, speed: 100 };

export class Trivia {
  constructor(ctx, rng = Math.random, bank = QUESTIONS) {
    this.ctx = ctx;
    this.rng = rng;
    this.bank = bank;
    const cat = settingOf(ctx, 'category', 'mix');
    this.category = cat === 'mix' || Object.prototype.hasOwnProperty.call(CATEGORIES, cat) ? cat : 'mix';
    this.timer = null;
  }

  shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** This run's questions: ones not seen in this room yet first (the daily challenge ignores that, so everyone gets the same). */
  pick() {
    const pool = this.bank.map((q, i) => ({ ...q, id: i })).filter((q) => this.category === 'mix' || q.c === this.category);
    const saved = this.ctx.saved || {};
    const seen = new Set(this.ctx.challenge ? [] : saved.seen || []);
    const fresh = pool.filter((q) => !seen.has(q.id));
    let order = this.shuffle(fresh);
    if (fresh.length < ROUND) {
      // Seen nearly all of them: a new lap, with what was left of the last one first.
      order = order.concat(this.shuffle(pool.filter((q) => seen.has(q.id))));
      for (const q of pool) seen.delete(q.id);
    }
    const out = order.slice(0, ROUND);
    if (!this.ctx.challenge) saved.seen = [...seen, ...out.map((q) => q.id)];
    return out;
  }

  start() {
    this.questions = this.pick().map((q) => {
      const options = this.shuffle([q.a, ...q.w]);
      return { text: q.q, category: CATEGORIES[q.c], options, answer: options.indexOf(q.a) };
    });
    this.index = -1;
    this.points = 0;
    this.right = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.fastest = null; // the quickest right answer, in ms
    this.last = null;
    this.phase = 'ready';
    this.schedule(() => this.next(), TIMING.readyMs);
    this.ctx.update();
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  next() {
    this.index++;
    if (this.index >= this.questions.length) {
      this.phase = 'over';
      this.ctx.update();
      return;
    }
    this.phase = 'ask';
    this.askedAt = this.ctx.now();
    this.tick();
  }

  get timeLeft() {
    return Math.max(0, this.askedAt + TIMING.questionMs - this.ctx.now());
  }

  /** Keep the clock moving on screen; out of time counts as wrong. */
  tick() {
    if (!this.timeLeft) return this.answer(null);
    this.ctx.update();
    this.schedule(() => this.tick(), Math.min(TIMING.tickMs, this.timeLeft));
  }

  answer(choice) {
    const q = this.questions[this.index];
    const ok = choice === q.answer;
    let got = 0;
    if (ok) {
      const took = this.ctx.now() - this.askedAt;
      got = POINTS.right + Math.round((POINTS.speed * this.timeLeft) / TIMING.questionMs);
      this.right++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.fastest = this.fastest === null ? took : Math.min(this.fastest, took);
    } else {
      this.wrong++;
      this.streak = 0;
    }
    this.points += got;
    this.last = { ok, answer: q.answer, chose: choice, points: got, n: this.index + 1 };
    this.phase = 'reveal';
    this.ctx.update();
    this.schedule(() => this.next(), TIMING.revealMs);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'answer' || this.phase !== 'ask') return;
    const c = input.choice;
    if (!Number.isInteger(c) || c < 0 || c > 3) return;
    this.answer(c);
  }

  view() {
    const q = this.questions[this.index];
    const showing = (this.phase === 'ask' || this.phase === 'reveal') && q;
    return {
      phase: this.phase,
      // The answer only goes out once it's been given (in `last`, while the reveal shows).
      question: showing ? { text: q.text, category: q.category, options: q.options, n: this.index + 1, of: this.questions.length } : null,
      reveal: this.phase === 'reveal' ? this.last : null,
      last: this.last,
      timeLeft: this.phase === 'ask' ? this.timeLeft : this.phase === 'ready' ? TIMING.questionMs : 0,
      seconds: TIMING.questionMs / 1000,
      right: this.right,
      wrong: this.wrong,
      streak: this.streak,
      bestStreak: this.bestStreak,
      fastest: this.fastest,
      of: this.questions.length,
      score: this.points,
      variant: this.category === 'mix' ? '' : CATEGORIES[this.category],
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
  id: 'trivia-1p',
  name: 'Trivia 1P',
  tagline: 'Twelve questions, four answers, 15 seconds each. Quick right answers score more.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Trivia(ctx, ctx.rng),
};
