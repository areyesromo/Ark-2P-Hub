// Sketch & Guess (casual). One player gets a secret word and draws it on their
// phone; the other watches the drawing appear and guesses. You play as a team:
// every guessed word earns stars (faster and harder words earn more).
//
// The drawer needs a private screen, so only phone players draw. A controller
// player always guesses, picking from four options with A/B/X/Y instead of
// typing. With two controllers there's nobody to draw, so the game says so.

import { WORDS, STARS } from './sketch-words.js';

export const ROUNDS = 6;
export const TIMING = { chooseMs: 15000, drawMs: 80000, revealMs: 5000 };
export const DRAW_PUSH_MS = 100;
export const LIMITS = { strokes: 200, points: 5000, batch: 200, guessLength: 40, guesses: 12 };
// Ink colours on white paper; the last one (white) works as an eraser.
export const COLORS = ['#1f2937', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#92400e', '#ffffff'];
export const HINT_AT = [0.5, 0.75]; // reveal a letter when this much of the drawing time has passed
export const GUESS_COOLDOWN_MS = 1500; // controller players: pause after a wrong pick
export const LEVELS = ['easy', 'medium', 'hard'];

const round3 = (v) => Math.round(v * 1000) / 1000;

/** Lower-case letters and digits only, so "Palm-tree" matches "palm tree". */
export function normalise(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function editDistance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** 'right', 'close' (one typo away, or a plural) or 'wrong'. */
export function judge(guess, word) {
  const g = normalise(guess);
  const w = normalise(word);
  if (!g) return 'wrong';
  if (g === w || g === w + 's' || g === w + 'es' || g + 's' === w) return 'right';
  if (w.length >= 4 && editDistance(g, w) <= (w.length >= 8 ? 2 : 1)) return 'close';
  return 'wrong';
}

export class SketchGuess {
  constructor(ctx, rng = Math.random, words = WORDS) {
    this.ctx = ctx;
    this.rng = rng;
    this.words = words;
    this.used = new Set();
    this.timer = null;
    this.pushTimer = null;
    this.matches = 0;
  }

  start() {
    const phones = this.ctx.players.filter((p) => !p.local).map((p) => p.slot);
    this.drawers = phones;
    this.history = []; // { word, level, drawer, guessed, ms, stars }
    this.stars = 0;
    this.round = 0;
    this.firstDrawer = this.matches++ % 2;
    if (!phones.length) {
      this.phase = 'needPhone';
      this.ctx.update();
      return;
    }
    this.nextRound();
  }

  // ---- phases ---------------------------------------------------------------

  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.phaseMs = ms;
    this.onPhaseEnd = onEnd;
    this.push();
    this.scheduleStep();
  }

  scheduleStep() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        if (this.phase === 'draw') this.maybeHint();
        this.push();
        this.scheduleStep();
      } else {
        this.onPhaseEnd();
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  stopTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  push() {
    if (this.pushTimer) this.ctx.clearTimeout(this.pushTimer);
    this.pushTimer = null;
    this.ctx.update();
  }

  pushSoon() {
    if (this.pushTimer) return;
    this.pushTimer = this.ctx.setTimeout(() => {
      this.pushTimer = null;
      this.ctx.update();
    }, DRAW_PUSH_MS);
  }

  /** Whose turn to draw: phone players take turns (a lone phone draws every round). */
  drawerFor(round) {
    if (this.drawers.length === 1) return this.drawers[0];
    return (this.firstDrawer + round) % 2;
  }

  nextRound() {
    this.round++;
    this.drawer = this.drawerFor(this.round - 1);
    this.guesser = 1 - this.drawer;
    this.choices = LEVELS.map((level) => ({ level, word: this.pickWord(level) }));
    this.word = null;
    this.level = null;
    this.strokes = [];
    this.points = 0;
    this.guesses = []; // the guesser's wrong guesses, newest last: { text, close }
    this.revealed = new Set(); // hinted letter positions
    this.options = null; // multiple choice for controller guessers
    this.ruledOut = [];
    this.lockedUntil = 0;
    this.result = null;
    this.runPhase('choose', TIMING.chooseMs, () => this.choose(Math.floor(this.rng() * LEVELS.length)));
  }

  pickWord(level) {
    let pool = this.words[level].filter((w) => !this.used.has(w));
    if (!pool.length) {
      this.words[level].forEach((w) => this.used.delete(w));
      pool = this.words[level].slice();
    }
    const word = pool[Math.floor(this.rng() * pool.length)];
    this.used.add(word);
    return word;
  }

  choose(index) {
    const c = this.choices[index];
    this.word = c.word;
    this.level = c.level;
    // Free the words that weren't picked so they can come up again.
    this.choices.forEach((other, i) => i !== index && this.used.delete(other.word));
    if (this.ctx.players[this.guesser].local) this.options = this.makeOptions();
    this.runPhase('draw', TIMING.drawMs, () => this.finishRound(false));
  }

  /** The word plus three others of the same difficulty, shuffled. */
  makeOptions() {
    const others = this.words[this.level].filter((w) => w !== this.word);
    const opts = [this.word];
    while (opts.length < 4 && others.length) opts.push(others.splice(Math.floor(this.rng() * others.length), 1)[0]);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }

  maybeHint() {
    const elapsed = 1 - (this.phaseEnds - this.ctx.now()) / this.phaseMs;
    const due = HINT_AT.filter((at) => elapsed >= at).length;
    const letters = [...this.word].map((ch, i) => i).filter((i) => /[a-z0-9]/i.test(this.word[i]) && !this.revealed.has(i));
    // Never give away the whole word.
    while (this.revealed.size < due && letters.length > 1) {
      this.revealed.add(letters.splice(Math.floor(this.rng() * letters.length), 1)[0]);
    }
  }

  finishRound(guessed) {
    this.stopTimer();
    const ms = TIMING.drawMs - Math.max(0, this.phaseEnds - this.ctx.now());
    let stars = 0;
    if (guessed) {
      const third = TIMING.drawMs / 3;
      stars = (ms <= third ? 3 : ms <= 2 * third ? 2 : 1) + STARS[this.level];
    }
    this.stars += stars;
    this.result = { word: this.word, guessed, ms, stars };
    this.history.push({ word: this.word, level: this.level, drawer: this.drawer, guessed, ms, stars });
    const last = this.round >= ROUNDS;
    this.runPhase('reveal', TIMING.revealMs, () => (last ? this.finish() : this.nextRound()));
  }

  finish() {
    this.stopTimer();
    this.phase = 'over';
    this.phaseEnds = null;
    this.push();
  }

  // ---- input ----------------------------------------------------------------

  onInput(slot, input) {
    if (input.type === 'rematch' && (this.phase === 'over' || this.phase === 'needPhone')) return this.start();
    if (this.phase === 'choose' && slot === this.drawer && input.type === 'choose') {
      if (Number.isInteger(input.index) && input.index >= 0 && input.index < LEVELS.length) this.choose(input.index);
      return;
    }
    if (this.phase !== 'draw') return;
    if (slot === this.drawer) return this.drawerInput(input);
    if (slot === this.guesser) return this.guesserInput(input);
  }

  drawerInput(input) {
    if (input.type === 'draw') return this.addPoints(input);
    if (input.type === 'undo') {
      const gone = this.strokes.pop();
      if (gone) this.points -= gone.pts.length / 2;
    } else if (input.type === 'clear') {
      this.strokes = [];
      this.points = 0;
    } else if (input.type === 'skip') {
      return this.finishRound(false);
    } else {
      return;
    }
    this.push();
  }

  /** { type: 'draw', newStroke, color, pts: [x, y, ...] } in 0..1 canvas units. */
  addPoints({ newStroke, color, pts }) {
    if (!Array.isArray(pts) || pts.length < 2 || pts.length % 2 || pts.length > LIMITS.batch) return;
    if (!pts.every((v) => typeof v === 'number' && Number.isFinite(v))) return;
    if (newStroke || !this.strokes.length) {
      if (this.strokes.length >= LIMITS.strokes) return;
      const c = Number.isInteger(color) && color >= 0 && color < COLORS.length ? color : 0;
      this.strokes.push({ c, pts: [] });
    }
    const stroke = this.strokes[this.strokes.length - 1].pts;
    for (let i = 0; i < pts.length && this.points < LIMITS.points; i += 2) {
      stroke.push(round3(Math.min(1, Math.max(0, pts[i]))), round3(Math.min(1, Math.max(0, pts[i + 1]))));
      this.points++;
    }
    this.pushSoon();
  }

  guesserInput(input) {
    if (input.type === 'guess' && typeof input.text === 'string') {
      const text = input.text.trim().slice(0, LIMITS.guessLength);
      if (!text) return;
      const verdict = judge(text, this.word);
      if (verdict === 'right') return this.finishRound(true);
      this.guesses.push({ text, close: verdict === 'close' });
      if (this.guesses.length > LIMITS.guesses) this.guesses.shift();
      return this.push();
    }
    if (input.type === 'pick' && this.options && Number.isInteger(input.index) && this.options[input.index] !== undefined) {
      if (this.ctx.now() < this.lockedUntil || this.ruledOut.includes(input.index)) return;
      if (this.options[input.index] === this.word) return this.finishRound(true);
      this.ruledOut.push(input.index);
      this.lockedUntil = this.ctx.now() + GUESS_COOLDOWN_MS;
      this.guesses.push({ text: this.options[input.index], close: false });
      this.push();
    }
  }

  // ---- views ----------------------------------------------------------------

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  /** "_ _ a _ _" style: letters hidden except hints; spaces and dashes shown. */
  blanks() {
    if (!this.word) return null;
    return [...this.word].map((ch, i) => (/[a-z0-9]/i.test(ch) ? (this.revealed.has(i) ? ch : '_') : ch)).join('');
  }

  common() {
    const showWord = this.phase === 'reveal' || this.phase === 'over';
    return {
      phase: this.phase,
      round: this.round,
      rounds: ROUNDS,
      drawer: this.drawer,
      guesser: this.guesser,
      level: this.level,
      blanks: this.blanks(),
      word: showWord ? this.word : null,
      strokes: this.strokes || [],
      colors: COLORS,
      guesses: this.guesses || [],
      options: this.options,
      ruledOut: this.ruledOut || [],
      lockedMs: Math.max(0, (this.lockedUntil || 0) - this.ctx.now()),
      timeLeftMs: this.timeLeftMs(),
      phaseMs: this.phaseMs || 0,
      result: this.result,
      history: this.history,
      stars: this.stars,
      maxStars: ROUNDS * (3 + STARS.hard),
    };
  }

  hostView() {
    return Object.assign(this.common(), { players: this.ctx.players });
  }

  playerView(slot) {
    const v = Object.assign(this.common(), { you: slot });
    if (slot === this.drawer) {
      v.word = this.word; // the drawer always knows it
      v.choices = this.phase === 'choose' ? this.choices : null;
      if (this.phase === 'draw') v.strokes = []; // the drawer's phone keeps its own copy while drawing
    }
    return v;
  }
}

export default {
  id: 'sketch-guess',
  name: 'Sketch & Guess',
  category: 'casual',
  tagline: 'One of you draws a secret word on your phone, the other guesses. Play as a team and collect stars. 6 rounds.',
  create: (ctx) => new SketchGuess(ctx),
};
