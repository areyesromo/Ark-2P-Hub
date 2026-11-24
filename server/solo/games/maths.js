// Quick Maths. Sums against the clock: pick the right answer of four. They
// start easy (adding small numbers) and get harder every 5 right answers
// (taking away, times tables, then a mix with dividing and bigger numbers).
// 60 seconds; a wrong answer costs 3 of them. Score: right answers.

import { TimedQuiz } from './timed-quiz.js';

export class QuickMaths extends TimedQuiz {
  get level() {
    return Math.min(4, Math.floor(this.right / 5));
  }

  int(lo, hi) {
    return lo + Math.floor(this.rng() * (hi - lo + 1));
  }

  /** A sum for the current level: [text, answer]. */
  sum() {
    const kind = [() => 'add', () => (this.rng() < 0.5 ? 'add' : 'sub'), () => 'mul', () => ['add', 'sub', 'mul'][this.int(0, 2)], () => ['add', 'sub', 'mul', 'div'][this.int(0, 3)]][this.level]();
    const big = this.level >= 3;
    if (kind === 'add') {
      const a = this.int(1, big ? 60 : this.level ? 20 : 10);
      const b = this.int(1, big ? 40 : this.level ? 20 : 10);
      return [a + ' + ' + b, a + b];
    }
    if (kind === 'sub') {
      const a = this.int(5, big ? 80 : 20);
      const b = this.int(1, a - 1);
      return [a + ' − ' + b, a - b];
    }
    if (kind === 'mul') {
      const a = this.int(2, big ? 12 : 9);
      const b = this.int(2, big ? 12 : 9);
      return [a + ' × ' + b, a * b];
    }
    const b = this.int(2, 9);
    const answer = this.int(2, 12);
    return [b * answer + ' ÷ ' + b, answer];
  }

  question() {
    const [text, answer] = this.sum();
    // Wrong choices close to the right one (never below 0, never the same twice).
    const near = new Set([answer]);
    const spread = Math.max(3, Math.round(answer * 0.2));
    while (near.size < 4) {
      const d = this.int(1, spread) * (this.rng() < 0.5 ? -1 : 1);
      if (answer + d >= 0) near.add(answer + d);
    }
    const options = this.shuffle([...near]);
    return { text, options, answer: options.indexOf(answer), level: this.level + 1 };
  }
}

export default {
  id: 'maths',
  name: 'Quick Maths',
  tagline: 'Sums against the clock: pick the right answer. They get harder as you go.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new QuickMaths(ctx, ctx.rng),
};
