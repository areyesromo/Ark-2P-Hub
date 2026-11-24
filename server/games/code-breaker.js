// Code Breaker (bulls and cows). You each set a secret code of four different digits on your phone,
// then take turns guessing the other's. Each guess comes back with bulls (a right digit in the right
// place) and cows (a right digit in the wrong place). Crack it first and you take the round; you
// both get the same number of goes, so if the second player cracks it on the same turn, it's level.
// Ten goes each at most. First to the rounds needed.

import { settingOf } from './options.js';

export const LENGTH = 4;
export const MAX_GUESSES = 10;
export const WIN_SCORE = 2;
export const TIMING = { setMs: 60000, guessMs: 60000, roundEndMs: 7000 };

export const validCode = (c) => typeof c === 'string' && new RegExp('^\\d{' + LENGTH + '}$').test(c) && new Set(c).size === LENGTH;

/** Bulls (right digit, right place) and cows (right digit, wrong place) for a guess against a code. */
export function score(guess, code) {
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < LENGTH; i++) {
    if (guess[i] === code[i]) bulls++;
    else if (code.includes(guess[i])) cows++;
  }
  return { bulls, cows };
}

/** Every possible code (four different digits). */
export function allCodes() {
  const out = [];
  for (let n = 0; n < 10000; n++) {
    const c = String(n).padStart(LENGTH, '0');
    if (validCode(c)) out.push(c);
  }
  return out;
}

export class CodeBreaker {
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
    this.starter = 1;
    this.newRound();
  }

  randomCode() {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits.slice(0, LENGTH).join('');
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    this.codes = [null, null];
    this.guesses = [[], []]; // { guess, bulls, cows } each
    this.cracked = [null, null]; // the go each cracked it on
    this.result = null;
    this.phase = 'set';
    this.arm(TIMING.setMs, 'setTimeUp');
  }

  setTimeUp() {
    for (const s of [0, 1]) if (!this.codes[s]) this.codes[s] = this.randomCode();
    this.beginGuessing();
  }

  beginGuessing() {
    this.phase = 'guess';
    this.turn = this.starter;
    this.arm(TIMING.guessMs, 'guessTimeUp');
  }

  guessTimeUp() {
    this.guess(this.turn, this.randomCode());
  }

  guess(slot, g) {
    const r = score(g, this.codes[1 - slot]);
    this.guesses[slot].push({ guess: g, ...r });
    if (r.bulls === LENGTH) this.cracked[slot] = this.guesses[slot].length;
    const second = 1 - this.starter;
    // After the second player's go (a full turn each), or when out of goes, see where it stands.
    if (slot === second) {
      if (this.cracked[0] !== null || this.cracked[1] !== null || this.guesses[slot].length >= MAX_GUESSES) return this.endRound();
    }
    this.turn = 1 - slot;
    this.arm(TIMING.guessMs, 'guessTimeUp');
  }

  endRound() {
    this.clearTimer();
    const [a, b] = this.cracked;
    const winner = a !== null && b !== null ? null : a !== null ? 0 : b !== null ? 1 : null;
    this.result = { winner, codes: this.codes.slice(), both: a !== null && b !== null };
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

  /** One timer at a time (its callback a method name). `playerClock`: a wait the Timer setting turns off. */
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
    if (input.type === 'code' && this.phase === 'set' && !this.codes[slot] && validCode(input.code)) {
      this.codes[slot] = input.code;
      if (this.codes[0] && this.codes[1]) return this.beginGuessing();
      return this.ctx.update();
    }
    if (input.type === 'guess' && this.phase === 'guess' && slot === this.turn && validCode(input.guess)) this.guess(slot, input.guess);
  }

  view(viewer) {
    const open = this.phase === 'roundEnd' || this.phase === 'over';
    return {
      phase: this.phase,
      round: this.round,
      length: LENGTH,
      maxGuesses: MAX_GUESSES,
      ready: this.codes.map(Boolean),
      code: viewer === null ? null : this.codes[viewer], // (your own only)
      codes: open ? this.codes : null,
      guesses: this.guesses,
      turn: this.turn,
      starter: this.starter,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot });
  }
}

export default {
  id: 'code-breaker',
  phoneOnly: true, // (your code is secret)
  handheld: true,
  music: 'thinking',
  name: 'Code Breaker',
  tagline: 'Set a secret four-digit code, then crack theirs: bulls are right digits in the right place, cows right digits in the wrong place.',
  create: (ctx) => new CodeBreaker(ctx),
};
