// Hangman Duel. You each set a secret word for the other (any real word of 4 to 10 letters; or let
// the hub pick a word for each of you). Then race: guess letters of the other's word on your phone,
// both at once. A right letter shows everywhere it's in the word; a wrong one adds to your gallows,
// and seven wrong and you're out. Reveal the whole word first and you take the round (both out:
// level). First to the rounds needed.

import { settingOf } from './options.js';
import { isWord } from './word-race.js';
import { WORDS as HUNT } from './word-hunt-words.js';
import { ANSWERS } from './anagram-words.js';

export const LIVES = 7;
export const MIN = 4;
export const MAX = 10;
export const WIN_SCORE = 2;
export const TIMING = { setMs: 60000, roundMs: 150000, roundEndMs: 6000 };

/** Everyday words the hub (and the computer) picks from: 5 to 8 letters. */
export const PICKS = [...new Set(HUNT.concat(ANSWERS))].filter((w) => /^[a-z]{5,8}$/.test(w));

export const validWord = (w) => typeof w === 'string' && new RegExp('^[a-z]{' + MIN + ',' + MAX + '}$').test(w) && (PICKS.includes(w) || isWord(w));

export class Hangman {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.hubPicks = settingOf(ctx, 'words', 'players') === 'hub';
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.newRound();
  }

  pick() {
    return PICKS[Math.floor(this.rng() * PICKS.length)];
  }

  newRound() {
    this.clearTimer();
    this.round++;
    // words[s]: the word player s set, which the other guesses.
    this.words = [null, null];
    this.tried = [[], []]; // letters each has tried (on the other's word)
    this.done = [null, null]; // 'solved' | 'hanged', with when
    this.solvedAt = [null, null];
    this.result = null;
    this.rejected = [null, null];
    if (this.hubPicks) {
      this.words = [this.pick(), this.pick()];
      return this.beginGuessing();
    }
    this.phase = 'set';
    this.arm(TIMING.setMs, 'setTimeUp');
  }

  setTimeUp() {
    for (const s of [0, 1]) if (!this.words[s]) this.words[s] = this.pick();
    this.beginGuessing();
  }

  beginGuessing() {
    this.phase = 'guess';
    this.startedAt = this.ctx.now();
    this.arm(TIMING.roundMs, 'roundTimeUp');
  }

  roundTimeUp() {
    // Time up: more of the word shown wins (the same: level).
    const shown = [0, 1].map((s) => this.revealed(s));
    this.endRound(shown[0] === shown[1] ? null : shown[0] > shown[1] ? 0 : 1, 'time');
  }

  /** How many letters of the other's word slot has found. */
  revealed(slot) {
    const w = this.words[1 - slot];
    return [...w].filter((ch) => this.tried[slot].includes(ch)).length;
  }

  misses(slot) {
    const w = this.words[1 - slot];
    return this.tried[slot].filter((ch) => !w.includes(ch)).length;
  }

  guess(slot, ch) {
    this.tried[slot].push(ch);
    const w = this.words[1 - slot];
    if ([...w].every((c) => this.tried[slot].includes(c))) {
      this.done[slot] = 'solved';
      return this.endRound(slot, 'solved');
    }
    if (this.misses(slot) >= LIVES) {
      this.done[slot] = 'hanged';
      if (this.done[1 - slot] === 'hanged') return this.endRound(null, 'both');
      // (the other plays on: they win by finishing, or, if they too run out, it's level)
    }
    this.ctx.update();
  }

  endRound(winner, how) {
    this.clearTimer();
    this.result = { winner, how, words: this.words.slice() };
    this.deadline = null;
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.roundEndMs, 'newRound', false);
  }

  arm(ms, then, playerClock = true) {
    this.clearTimer();
    this.after = then;
    this.deadline = playerClock && this.clock ? this.ctx.now() + ms : null;
    this.ctx.update();
    if (playerClock && !this.clock) return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (!this.clock && this.after !== 'newRound') return;
    if (this.deadline) this.deadline += downMs;
    const then = this.after;
    const ms = Math.max(0, this.due + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'word' && this.phase === 'set' && !this.words[slot]) {
      const w = typeof input.word === 'string' ? input.word.toLowerCase() : '';
      if (!validWord(w)) {
        this.rejected[slot] = { word: w.slice(0, MAX + 2), n: (this.rejected[slot] ? this.rejected[slot].n : 0) + 1 };
        return this.ctx.update();
      }
      this.words[slot] = w;
      if (this.words[0] && this.words[1]) return this.beginGuessing();
      return this.ctx.update();
    }
    if (input.type === 'letter' && this.phase === 'guess' && !this.done[slot]) {
      const ch = input.letter;
      if (typeof ch !== 'string' || !/^[a-z]$/.test(ch) || this.tried[slot].includes(ch)) return;
      this.guess(slot, ch);
    }
  }

  /** The word `slot` is guessing, with only the letters they've found showing. */
  mask(slot) {
    const w = this.words[1 - slot];
    return w ? [...w].map((c) => (this.tried[slot].includes(c) ? c : null)) : null;
  }

  view(viewer) {
    const open = this.phase === 'roundEnd' || this.phase === 'over';
    return {
      phase: this.phase,
      round: this.round,
      lives: LIVES,
      ready: this.words.map(Boolean),
      masks: this.phase === 'set' ? [null, null] : [this.mask(0), this.mask(1)],
      tried: this.tried,
      misses: this.phase === 'set' ? [0, 0] : [this.misses(0), this.misses(1)],
      done: this.done,
      words: open ? this.words : null,
      myWord: viewer === null ? null : this.words[viewer], // (the word you set, theirs to guess)
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      hubPicks: this.hubPicks,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
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
  id: 'hangman',
  phoneOnly: true, // (your word is secret)
  handheld: true,
  music: 'thinking',
  name: 'Hangman Duel',
  tagline: 'Set a secret word for each other, then race to guess theirs letter by letter. Seven wrong letters and you\'re out.',
  create: (ctx) => new Hangman(ctx),
};
