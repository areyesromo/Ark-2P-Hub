// Anagram Duel. Both players get the same five mixed-up letters: the first to
// make a word with all five wins the round. Any real word counts, not just the
// one the letters came from. A wrong word locks you out for a moment, so
// guessing at random doesn't pay. Nobody in 30 seconds: no point, and the TV
// shows the word. First to the chosen number of rounds wins.

import { settingOf } from './options.js';
import { isWord } from './word-race.js';
import { ANSWERS } from './anagram-words.js';

export const WIN_SCORE = 5;
export const TIMING = {
  countdownMs: 1500, // "round 3…" before the letters show
  roundMs: 30000, // nobody found one: the round's void
  lockMs: 1500, // after a wrong word
  resultMs: 3000, // the word stays up
};

const sorted = (w) => [...w].sort().join('');

export class AnagramDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.used = new Set();
    this.wordsMade = [0, 0];
    this.fastest = [null, null]; // ms from the letters showing to a winning word
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.phase = 'countdown';
    this.result = null;
    this.word = this.pickWord();
    this.letters = this.scramble(this.word);
    this.progress = [0, 0]; // letters each player has placed, for the TV
    this.lockedUntil = [0, 0];
    this.feedback = [null, null]; // { ok: false, word, n } after a wrong word, for that phone
    this.schedule(() => this.play(), TIMING.countdownMs);
    this.ctx.update();
  }

  /** A word not given yet this match. */
  pickWord() {
    let w;
    do w = ANSWERS[Math.floor(this.rng() * ANSWERS.length)];
    while (this.used.has(w) && this.used.size < ANSWERS.length);
    this.used.add(w);
    return w;
  }

  /** The word's letters mixed up, never left as the word itself. */
  scramble(w) {
    let letters = [...w];
    for (let tries = 0; tries < 20; tries++) {
      letters = [...w];
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      if (letters.join('') !== w) break;
    }
    return letters;
  }

  play() {
    this.phase = 'play';
    this.shownAt = this.ctx.now();
    this.endsAt = this.shownAt + TIMING.roundMs;
    this.schedule(() => this.finish(null, null), TIMING.roundMs);
    this.ctx.update();
  }

  guess(slot, raw) {
    const now = this.ctx.now();
    if (now < this.lockedUntil[slot]) return;
    const w = raw.toLowerCase();
    if (w.length === this.word.length && sorted(w) === sorted(this.word) && isWord(w)) {
      const ms = now - this.shownAt;
      if (this.fastest[slot] === null || ms < this.fastest[slot]) this.fastest[slot] = ms;
      this.wordsMade[slot]++;
      return this.finish(slot, w);
    }
    this.lockedUntil[slot] = now + TIMING.lockMs;
    this.feedback[slot] = { ok: false, word: w, n: ((this.feedback[slot] && this.feedback[slot].n) || 0) + 1 };
    this.progress[slot] = 0;
    this.ctx.update(); // (the phone counts the lock down itself, from lockedFor)
  }

  finish(winner, word) {
    if (winner !== null) this.scores[winner]++;
    this.result = { winner, word, answer: this.word };
    const champ = this.scores.findIndex((s) => s >= this.winScore);
    if (champ !== -1) {
      this.cancel();
      this.phase = 'over';
      this.winner = champ;
      return this.ctx.update();
    }
    this.phase = 'result';
    this.schedule(() => this.nextRound(), TIMING.resultMs);
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'guess' && typeof input.word === 'string' && /^[a-zA-Z]{1,12}$/.test(input.word)) this.guess(slot, input.word);
    else if (input.type === 'progress' && Number.isInteger(input.n) && input.n >= 0 && input.n <= this.letters.length && input.n !== this.progress[slot]) {
      this.progress[slot] = input.n;
      this.ctx.update();
    }
  }

  schedule(fn, ms) {
    this.cancel();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  cancel() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  view() {
    const playing = this.phase === 'play';
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      // The mixed-up letters only while playing; the word itself only in the result.
      letters: playing ? this.letters : null,
      timeLeft: playing ? Math.max(0, this.endsAt - this.ctx.now()) : 0,
      roundMs: TIMING.roundMs,
      progress: this.progress,
      result: this.result,
      winner: this.winner,
      wordsMade: this.wordsMade,
      fastest: this.fastest,
    };
  }

  hostView() {
    return { ...this.view(), players: this.ctx.players };
  }

  playerView(slot) {
    return {
      ...this.view(),
      you: slot,
      feedback: this.feedback[slot],
      lockedFor: this.phase === 'play' ? Math.max(0, this.lockedUntil[slot] - this.ctx.now()) : 0,
    };
  }
}

export default {
  id: 'anagram-duel',
  phoneOnly: true, // the letters you pick are private
  music: 'thinking',
  name: 'Anagram Duel',
  tagline: 'Same five mixed-up letters for both of you: the first to make a word with all of them takes the round.',
  create: (ctx) => new AnagramDuel(ctx, ctx.rng),
};
