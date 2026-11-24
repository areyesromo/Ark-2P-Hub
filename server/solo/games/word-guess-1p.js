// Word Guess. Find the hidden five-letter word in six guesses. After each
// guess every letter turns green (right letter, right place), yellow (in the
// word, somewhere else) or grey (not in it). Guesses must be real words.
// The daily word is the same for everyone that day and can be played once;
// practice gives a new word every time. Score: the guesses it took (lower is
// better); a word not found doesn't count.

import fs from 'node:fs';
import wordListPath from 'word-list';
import { settingOf } from './options.js';
import { ANSWERS } from './word-guess-words.js';

export const LENGTH = 5;
export const TRIES = 6;

let DICTIONARY = null;
/** Every five-letter word a guess may be (~12,500 of them), loaded once. */
export function dictionary() {
  if (!DICTIONARY) {
    DICTIONARY = new Set(fs.readFileSync(wordListPath, 'utf8').split('\n').filter((w) => w.length === LENGTH));
    for (const w of ANSWERS) DICTIONARY.add(w);
  }
  return DICTIONARY;
}

/** The day ('YYYY-MM-DD', UTC) a moment falls on: the daily word changes at midnight UTC. */
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The day's word: the same for everyone, stepping through the list in a scrambled order. */
export function dailyWord(day) {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  // 7919 is prime and doesn't divide the list's length, so this visits every word before repeating.
  return ANSWERS[(((n * 7919) % ANSWERS.length) + ANSWERS.length) % ANSWERS.length];
}

/**
 * Colour a guess: 'g' green, 'y' yellow, '.' grey. A letter guessed twice
 * is only yellow as many times as the word has it (greens first).
 */
export function mark(guess, answer) {
  const out = Array(LENGTH).fill('.');
  const left = {};
  for (let i = 0; i < LENGTH; i++) {
    if (guess[i] === answer[i]) out[i] = 'g';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LENGTH; i++) {
    if (out[i] === 'g' || !left[guess[i]]) continue;
    out[i] = 'y';
    left[guess[i]]--;
  }
  return out.join('');
}

export class WordGuess {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.daily = settingOf(ctx, 'mode', 'daily') === 'daily';
  }

  start() {
    this.guesses = []; // { word, marks }
    this.entry = '';
    this.message = null; // { text, n }: why a guess wasn't taken (n changes each time, so the screen can shake)
    this.messages = 0;
    this.already = false;
    this.phase = 'play';
    if (this.daily) {
      this.day = dayOf(this.ctx.now());
      this.answer = dailyWord(this.day);
      const done = this.ctx.daily.get(this.day);
      if (done && Array.isArray(done.guesses)) {
        // Played today already: show how it went, and it doesn't count again.
        this.guesses = done.guesses.filter((w) => typeof w === 'string').map((w) => ({ word: w, marks: mark(w, this.answer) }));
        this.already = true;
        this.phase = 'over';
      }
    } else {
      const used = this.ctx.saved.used || (this.ctx.saved.used = []);
      // Practice words don't repeat until the list runs out.
      let pool = ANSWERS.filter((w) => !used.includes(w));
      if (!pool.length) {
        used.length = 0;
        pool = ANSWERS;
      }
      this.answer = pool[Math.floor(this.rng() * pool.length)];
      used.push(this.answer);
    }
    this.ctx.update();
  }

  get solved() {
    return this.guesses.some((g) => g.word === this.answer);
  }

  say(text) {
    this.message = { text, n: ++this.messages };
    this.ctx.update();
  }

  submit() {
    if (this.entry.length < LENGTH) return this.say('Not enough letters');
    if (!dictionary().has(this.entry)) return this.say('Not in the word list');
    this.guesses.push({ word: this.entry, marks: mark(this.entry, this.answer) });
    this.entry = '';
    this.message = null;
    if (this.solved || this.guesses.length >= TRIES) {
      this.phase = 'over';
      if (this.daily) this.ctx.daily.set(this.day, { guesses: this.guesses.map((g) => g.word), solved: this.solved });
    }
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'letter' && typeof input.letter === 'string' && /^[a-z]$/.test(input.letter)) {
      if (this.entry.length >= LENGTH) return;
      this.entry += input.letter;
    } else if (input.type === 'back') {
      if (!this.entry) return;
      this.entry = this.entry.slice(0, -1);
    } else if (input.type === 'enter') {
      return this.submit();
    } else {
      return;
    }
    this.message = null;
    this.ctx.update();
  }

  /** Each letter's best colour so far, for the keyboard: { a: 'g', e: '.', ... }. */
  keys() {
    const rank = { g: 3, y: 2, '.': 1 };
    const out = {};
    for (const { word, marks } of this.guesses) {
      for (let i = 0; i < LENGTH; i++) if (!out[word[i]] || rank[marks[i]] > rank[out[word[i]]]) out[word[i]] = marks[i];
    }
    return out;
  }

  view() {
    const over = this.phase === 'over';
    return {
      phase: this.phase,
      guesses: this.guesses,
      entry: this.entry,
      keys: this.keys(),
      message: this.message,
      tries: TRIES,
      daily: this.daily,
      day: this.daily ? this.day : null,
      already: this.already,
      solved: over && this.solved,
      answer: over ? this.answer : null,
      // A found word scores the guesses it took; a second go at today's word doesn't count.
      score: over && this.solved && !this.already ? this.guesses.length : null,
      variant: this.daily ? 'Daily' : 'Practice',
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
  id: 'word-guess-1p',
  name: 'Word Guess 1P',
  tagline: 'Find the five-letter word in six guesses. A new daily word for everyone, or practise.',
  category: 'brain',
  phone: true,
  music: 'thinking',
  score: { better: 'lower', unit: 'tries' },
  create: (ctx) => new WordGuess(ctx, ctx.rng),
};
