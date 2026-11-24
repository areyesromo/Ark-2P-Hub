// Hangman. A word is hidden behind blanks: guess letters, and the right ones fill
// in. Six wrong guesses and the man is hanged (the run is over). Each word you
// get is worth 100 plus 20 for every wrong guess you didn't use, and the next
// word comes straight after. Score: points over the run.

import { ANSWERS } from './word-guess-words.js';
import { WORDS } from './word-search-words.js';

export const MAX_WRONG = 6;
export const TIMING = { nextMs: 1600 };
export const POINTS = { word: 100, spare: 20 };
// Everyday words of four letters or more, without repeats (the two lists overlap).
export const POOL = [...new Set([...ANSWERS, ...WORDS])].filter((w) => w.length >= 4 && /^[a-z]+$/.test(w));

export class Hangman {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.score = 0;
    this.solved = 0;
    this.perfects = 0; // words got with no wrong guess
    this.used = new Set();
    this.last = null; // { ok, word, points, n }: the last word, for the screens
    this.n = 0;
    this.nextWord();
    this.ctx.update();
  }

  nextWord() {
    let w;
    do w = POOL[Math.floor(this.rng() * POOL.length)];
    while (this.used.has(w) && this.used.size < POOL.length);
    this.used.add(w);
    this.word = w;
    this.guessed = new Set();
    this.wrong = 0;
    this.phase = 'play';
  }

  guess(letter) {
    if (this.guessed.has(letter)) return false;
    this.guessed.add(letter);
    if (this.word.includes(letter)) {
      if ([...this.word].every((c) => this.guessed.has(c))) this.won();
    } else if (++this.wrong >= MAX_WRONG) {
      this.last = { ok: false, word: this.word, points: 0, n: ++this.n };
      this.phase = 'over';
    }
    return true;
  }

  won() {
    const points = POINTS.word + (MAX_WRONG - this.wrong) * POINTS.spare;
    this.score += points;
    this.solved++;
    if (this.wrong === 0) this.perfects++;
    this.last = { ok: true, word: this.word, points, n: ++this.n };
    this.phase = 'between';
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.nextWord();
      this.ctx.update();
    }, TIMING.nextMs);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || input.type !== 'guess') return;
    if (typeof input.letter !== 'string' || !/^[a-zA-Z]$/.test(input.letter)) return;
    if (this.guess(input.letter.toLowerCase())) this.ctx.update();
  }

  view() {
    const reveal = this.phase !== 'play';
    return {
      phase: this.phase,
      // The word's blanks (a letter once guessed); the word itself only once the word's done.
      pattern: [...this.word].map((c) => (this.guessed.has(c) ? c : '_')).join(''),
      answer: reveal ? this.word : null,
      hits: [...this.guessed].filter((c) => this.word.includes(c)).join(''),
      misses: [...this.guessed].filter((c) => !this.word.includes(c)).join(''),
      wrong: this.wrong,
      maxWrong: MAX_WRONG,
      wordNo: this.solved + 1,
      solved: this.solved,
      perfects: this.perfects,
      last: this.last,
      score: this.score,
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
  id: 'hangman-1p',
  name: 'Hangman 1P',
  tagline: 'Guess the hidden word a letter at a time. Six wrong guesses and it\'s over.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Hangman(ctx, ctx.rng),
};
