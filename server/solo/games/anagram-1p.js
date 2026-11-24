// Anagram Rush. Five letters, all mixed up: make a word with all of them.
// Any real word counts, not just the one the letters came from. 60 seconds;
// skipping costs 3 of them (and shows what it was). Score: words made.

import { dictionary } from './word-guess-1p.js';
import { ANSWERS } from './word-guess-words.js';

export const SECONDS = 60;
export const SKIP_MS = 3000;
export const TIMING = { readyMs: 1500, tickMs: 250 };

const sorted = (w) => [...w].sort().join('');

export class Anagram {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.right = 0;
    this.skips = 0;
    this.wrong = 0; // guesses that weren't words
    this.streak = 0;
    this.bestStreak = 0;
    this.last = null; // { ok, word?, answer?, skipped?, n }: what just happened, for the screens
    this.n = 0;
    this.used = new Set();
    this.word = null;
    this.phase = 'ready';
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
    this.endsAt = this.ctx.now() + SECONDS * 1000;
    this.next();
    this.tick();
  }

  /** A new word, never one already given this run, its letters mixed up (never as the word itself). */
  next() {
    let w;
    do w = ANSWERS[Math.floor(this.rng() * ANSWERS.length)];
    while (this.used.has(w) && this.used.size < ANSWERS.length);
    this.used.add(w);
    this.word = w;
    let letters;
    for (let tries = 0; tries < 20; tries++) {
      letters = [...w];
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      if (letters.join('') !== w) break;
    }
    this.letters = letters;
    this.askedAt = this.ctx.now();
  }

  /** Keep the clock moving on screen; stop when time's up. */
  tick() {
    if (this.ctx.now() >= this.endsAt) {
      this.phase = 'over';
      this.last = { ok: false, answer: this.word, timeUp: true, n: ++this.n };
      this.ctx.update();
      return;
    }
    this.ctx.update();
    this.schedule(() => this.tick(), Math.min(TIMING.tickMs, this.endsAt - this.ctx.now()));
  }

  guess(raw) {
    const w = raw.toLowerCase();
    // Any real word with exactly these letters counts.
    if (w.length === this.word.length && sorted(w) === sorted(this.word) && dictionary().has(w)) {
      this.right++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.last = { ok: true, word: w, answer: this.word, n: ++this.n };
      this.next();
    } else {
      this.wrong++;
      this.last = { ok: false, word: w, n: ++this.n };
    }
  }

  skip() {
    this.skips++;
    this.streak = 0;
    this.endsAt -= SKIP_MS;
    this.last = { ok: false, skipped: true, answer: this.word, n: ++this.n };
    this.next();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'guess' && typeof input.word === 'string' && /^[a-zA-Z]{1,12}$/.test(input.word)) this.guess(input.word);
    else if (input.type === 'skip') this.skip();
    else return;
    this.tick();
  }

  view() {
    return {
      phase: this.phase,
      // The mixed-up letters only: the word itself shows once it's been made or skipped (in `last`).
      letters: this.phase === 'play' ? this.letters : null,
      last: this.last,
      timeLeft: this.phase === 'play' ? Math.max(0, this.endsAt - this.ctx.now()) : this.phase === 'ready' ? SECONDS * 1000 : 0,
      seconds: SECONDS,
      right: this.right,
      skips: this.skips,
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

export default {
  id: 'anagram-1p',
  name: 'Anagram Rush 1P',
  tagline: 'Unscramble five letters into a word. As many as you can in 60 seconds.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Anagram(ctx, ctx.rng),
};
