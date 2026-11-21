// Five Letters: you both hunt the same hidden five-letter word, each on your own phone, six goes
// each. Every guess comes back coloured: 🟩 right letter in the right spot, 🟨 in the word but
// somewhere else, ⬛ not in it. The other player sees your colours but never your letters. Fewer
// guesses takes the round; the same number, whoever got there first. First to WIN_SCORE rounds.

import { settingOf } from './options.js';
import { ANSWERS } from './anagram-words.js';
import { isWord } from './word-race.js';

export const LETTERS = 5;
export const MAX_GUESSES = 6;
export const WIN_SCORE = 3;
export const TIMING = { roundMs: 180000, roundEndMs: 6000 };

/** The words a round's answer is drawn from: everyday five-letter words. */
export const POOL = [...new Set(ANSWERS.filter((w) => /^[a-z]{5}$/.test(w)))];

/**
 * A guess's colours against the answer: 'g' right spot, 'y' elsewhere in the word, 'b' not in it.
 * A repeated letter is only yellow as many times as the answer has it left over.
 */
export function marks(guess, answer) {
  const out = new Array(LETTERS).fill('b');
  const left = {};
  for (let i = 0; i < LETTERS; i++) {
    if (guess[i] === answer[i]) out[i] = 'g';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LETTERS; i++) {
    if (out[i] === 'g') continue;
    if (left[guess[i]]) {
      out[i] = 'y';
      left[guess[i]]--;
    }
  }
  return out.join('');
}

/** Any real word may be guessed (the dictionary's), not only the everyday ones the answers come from. */
export const allowed = (w) => typeof w === 'string' && /^[a-z]{5}$/.test(w) && (POOL.includes(w) || isWord(w));

export class FiveLetters {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.used = [];
    this.newRound();
  }

  newRound() {
    this.clearTimer();
    this.round++;
    let fresh = POOL.filter((w) => !this.used.includes(w));
    if (!fresh.length) { this.used = []; fresh = POOL; }
    this.answer = fresh[Math.floor(this.rng() * fresh.length)];
    this.used.push(this.answer);
    this.boards = [[], []]; // { word, marks, at } per guess
    this.solvedAt = [null, null]; // ms into the round
    this.rejected = [null, null]; // { word, n }: the last word that isn't a word (the phone shakes)
    this.result = null;
    this.phase = 'play';
    this.startedAt = this.ctx.now();
    this.deadline = this.clock ? this.startedAt + TIMING.roundMs : null;
    if (this.clock) this.armRound(TIMING.roundMs);
    this.ctx.update();
  }

  armRound(ms) {
    this.after = 'endRound';
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.endRound(); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Picked up after a restart: the round's clock runs on, a finished round moves on. */
  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.deadline) {
      this.deadline += downMs;
      this.startedAt += downMs;
      this.armRound(Math.max(0, this.deadline - this.ctx.now()));
    } else if (this.phase === 'roundEnd') {
      this.after = 'newRound';
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.roundEndMs);
    }
  }

  done(slot) {
    return this.solvedAt[slot] !== null || this.boards[slot].length >= MAX_GUESSES;
  }

  /**
   * Whether the round is settled: both done, or one solved in n and the other can no longer beat
   * it (their next guess would be their n-th or later: the same count loses on time).
   */
  settled() {
    if (this.done(0) && this.done(1)) return true;
    for (const s of [0, 1]) {
      if (this.solvedAt[s] === null) continue;
      const o = 1 - s;
      if (this.done(o) || this.boards[o].length + 1 >= this.boards[s].length) return true;
    }
    return false;
  }

  endRound() {
    this.clearTimer();
    const n = this.boards.map((b, s) => (this.solvedAt[s] === null ? Infinity : b.length));
    let winner = null;
    if (n[0] < n[1]) winner = 0;
    else if (n[1] < n[0]) winner = 1;
    else if (n[0] !== Infinity) winner = this.solvedAt[0] <= this.solvedAt[1] ? 0 : 1;
    this.result = { winner, word: this.answer, guesses: n.map((x) => (x === Infinity ? null : x)) };
    if (winner !== null) this.scores[winner]++;
    this.deadline = null;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.after = 'newRound';
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.roundEndMs);
    this.ctx.update();
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'guess' || this.phase !== 'play' || this.done(slot)) return;
    const word = typeof input.word === 'string' ? input.word.toLowerCase() : '';
    if (!/^[a-z]{5}$/.test(word)) return;
    if (!allowed(word)) {
      this.rejected[slot] = { word, n: (this.rejected[slot] ? this.rejected[slot].n : 0) + 1 };
      return this.ctx.update();
    }
    this.boards[slot].push({ word, marks: marks(word, this.answer), at: this.ctx.now() - this.startedAt });
    if (word === this.answer) this.solvedAt[slot] = this.ctx.now() - this.startedAt;
    if (this.settled()) return this.endRound();
    this.ctx.update();
  }

  // ---- views -------------------------------------------------------------------

  /** A board as `viewer` sees it: the letters only for its owner (or once the round is over). */
  board(slot, viewer) {
    const open = viewer === slot || this.phase !== 'play';
    return this.boards[slot].map((g) => (open ? { word: g.word, marks: g.marks } : { word: null, marks: g.marks }));
  }

  view(viewer) {
    return {
      phase: this.phase,
      round: this.round,
      letters: LETTERS,
      maxGuesses: MAX_GUESSES,
      boards: [this.board(0, viewer), this.board(1, viewer)],
      solved: this.solvedAt.map((t) => t !== null),
      done: [this.done(0), this.done(1)],
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.phase === 'play' && this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot, rejected: this.rejected[slot] });
  }
}

export default {
  id: 'five-letters',
  phoneOnly: true, // (your letters are secret: each of you types on your own phone)
  handheld: true,
  music: 'thinking',
  name: 'Five Letters',
  tagline: 'The same hidden word for you both, six guesses each. Green: right spot. Yellow: in the word. Fewest guesses wins the round.',
  create: (ctx) => new FiveLetters(ctx),
};
