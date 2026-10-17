// Bomb Squad: a co-op game. One of you has the bomb on your phone, the other
// has the defusal manual on theirs, and neither can see the other's screen.
// Talk it through: the defuser describes what's on the bomb, the expert finds
// the right rules and says what to do. Three strikes, or the timer running
// out, and it goes off. You swap roles every bomb and collect stars for each
// one defused (more for time to spare). The TV shows the timer and progress.

import { settingOf } from './options.js';
import {
  makeEdgework, makeModules, manual, wireAnswer, buttonAction, clockText, symbolOrder, passwordShown,
  STRIP_DIGITS, HOLD_MS, WHEEL_SIZE,
} from './bomb-squad-modules.js';

export const BOMBS = 3;
export const MAX_STRIKES = 3;
/** Difficulty: how many modules and how long. */
export const LEVELS = {
  1: { name: 'Easy', modules: 2, ms: 4 * 60000 },
  2: { name: 'Normal', modules: 3, ms: 4 * 60000 },
  3: { name: 'Hard', modules: 4, ms: 3.5 * 60000 },
};
export const TIMING = { briefMs: 6000, resultMs: 5000 };
const MANUAL = manual();

export class BombSquad {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.bombs = settingOf(ctx, 'bombs', BOMBS);
    this.level = LEVELS[settingOf(ctx, 'level', 2)] ? settingOf(ctx, 'level', 2) : 2;
    this.firstDefuser = 0;
  }

  start() {
    this.clearTimer();
    this.bombIndex = 0;
    this.stars = 0;
    this.history = []; // { defuser, defused, reason, timeLeftMs, strikes, stars }
    this.result = null;
    this.bomb = null;
    // Both screens must stay private: no controller players here.
    if (this.ctx.players.some((p) => p.local)) {
      this.phase = 'needPhones';
      return this.ctx.update();
    }
    this.nextBomb();
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  later(ms, fn) {
    this.clearTimer();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  get defuser() {
    return (this.firstDefuser + this.bombIndex - 1) % 2;
  }

  nextBomb() {
    this.bombIndex++;
    const lv = LEVELS[this.level];
    this.bomb = { edge: makeEdgework(this.rng), modules: makeModules(lv.modules, this.rng), strikes: 0, totalMs: lv.ms, endsAt: null };
    this.result = null;
    this.phase = 'brief';
    this.phaseEnds = this.ctx.now() + TIMING.briefMs;
    this.later(TIMING.briefMs, () => this.arm());
    this.ctx.update();
  }

  arm() {
    this.phase = 'live';
    this.bomb.endsAt = this.ctx.now() + this.bomb.totalMs;
    this.later(this.bomb.totalMs, () => this.finishBomb(false, 'time'));
    this.ctx.update();
  }

  timeLeft() {
    return this.bomb && this.bomb.endsAt ? Math.max(0, this.bomb.endsAt - this.ctx.now()) : this.bomb ? this.bomb.totalMs : 0;
  }

  strike() {
    this.bomb.strikes++;
    this.bomb.lastStrikeAt = this.ctx.now();
    if (this.bomb.strikes >= MAX_STRIKES) return this.finishBomb(false, 'strikes');
    this.ctx.update();
  }

  solve(m) {
    m.solved = true;
    if (this.bomb.modules.every((x) => x.solved)) return this.finishBomb(true, 'defused');
    this.ctx.update();
  }

  /** Stars for a bomb: 1 for defusing it, +1 with a quarter of the time left, +2 with half. */
  starsFor(defused, timeLeftMs) {
    if (!defused) return 0;
    const f = timeLeftMs / this.bomb.totalMs;
    return 1 + (f >= 0.5 ? 2 : f >= 0.25 ? 1 : 0);
  }

  finishBomb(defused, reason) {
    const timeLeftMs = this.timeLeft();
    const stars = this.starsFor(defused, timeLeftMs);
    this.stars += stars;
    this.result = { defused, reason, timeLeftMs, strikes: this.bomb.strikes, stars };
    this.history.push({ defuser: this.defuser, ...this.result });
    this.bomb.endsAt = null;
    this.bomb.frozenMs = timeLeftMs;
    this.phase = 'result';
    this.phaseEnds = this.ctx.now() + TIMING.resultMs;
    this.later(TIMING.resultMs, () => (this.bombIndex >= this.bombs ? this.finish() : this.nextBomb()));
    this.ctx.update();
  }

  finish() {
    this.clearTimer();
    this.phase = 'over';
    this.firstDefuser = 1 - this.firstDefuser; // the other one starts with the bomb next time
    this.ctx.update();
  }

  // ---- the defuser's hands ----

  onInput(slot, input) {
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.start();
      return;
    }
    if (this.phase !== 'live' || slot !== this.defuser) return;
    const m = this.bomb.modules[input.module];
    if (!m || m.solved) return;
    const edge = this.bomb.edge;
    if (m.type === 'wires' && input.type === 'cut') {
      const i = input.wire;
      if (!Number.isInteger(i) || i < 0 || i >= m.wires.length || m.cut.includes(i)) return;
      m.cut.push(i);
      return i === wireAnswer(m.wires, edge) ? this.solve(m) : this.strike();
    }
    if (m.type === 'button' && input.type === 'press') {
      if (m.pressedAt !== null) return;
      m.pressedAt = this.ctx.now();
      // Light the strip once it counts as a hold.
      this.ctx.setTimeout(() => this.ctx.update(), HOLD_MS + 20);
      return this.ctx.update();
    }
    if (m.type === 'button' && input.type === 'release') {
      if (m.pressedAt === null) return;
      const held = this.ctx.now() - m.pressedAt >= HOLD_MS;
      m.pressedAt = null;
      const want = buttonAction(m, edge);
      if (want === 'tap') return held ? this.strike() : this.solve(m);
      if (!held) return this.strike();
      return clockText(this.timeLeft()).includes(String(STRIP_DIGITS[m.strip])) ? this.solve(m) : this.strike();
    }
    if (m.type === 'symbols' && input.type === 'symbol') {
      const i = input.index;
      if (!Number.isInteger(i) || i < 0 || i > 3 || m.pressed.includes(i)) return;
      const next = symbolOrder(m.symbols)[m.pressed.length];
      if (i !== next) return this.strike();
      m.pressed.push(i);
      return m.pressed.length === 4 ? this.solve(m) : this.ctx.update();
    }
    if (m.type === 'password' && input.type === 'spin') {
      const c = input.wheel;
      if (!Number.isInteger(c) || c < 0 || c >= m.wheels.length) return;
      m.at[c] = (m.at[c] + (input.dir < 0 ? WHEEL_SIZE - 1 : 1)) % WHEEL_SIZE;
      return this.ctx.update();
    }
    if (m.type === 'password' && input.type === 'submit') {
      return passwordShown(m) === m.word ? this.solve(m) : this.strike();
    }
  }

  // ---- views ----

  /** What the bomb looks like, without any answers (the defuser's phone). */
  bombFace() {
    const now = this.ctx.now();
    return {
      edge: this.bomb.edge,
      modules: this.bomb.modules.map((m) => {
        const base = { type: m.type, solved: m.solved };
        if (m.type === 'wires') return { ...base, wires: m.wires, cut: m.cut };
        if (m.type === 'button') {
          const holding = m.pressedAt !== null && now - m.pressedAt >= HOLD_MS;
          return { ...base, color: m.color, label: m.label, pressed: m.pressedAt !== null, strip: holding ? m.strip : null };
        }
        if (m.type === 'symbols') return { ...base, symbols: m.symbols, pressed: m.pressed };
        return { ...base, letters: passwordShown(m).toUpperCase(), wheels: m.wheels.length };
      }),
    };
  }

  view() {
    const lv = LEVELS[this.level];
    const b = this.bomb;
    return {
      phase: this.phase,
      level: this.level,
      levelName: lv.name,
      bombIndex: this.bombIndex,
      bombs: this.bombs,
      defuser: this.bomb ? this.defuser : null,
      timeLeftMs: b ? (b.endsAt ? this.timeLeft() : b.frozenMs !== undefined ? b.frozenMs : b.totalMs) : 0,
      running: Boolean(b && b.endsAt),
      totalMs: b ? b.totalMs : lv.ms,
      strikes: b ? b.strikes : 0,
      maxStrikes: MAX_STRIKES,
      lastStrikeAt: b && b.lastStrikeAt ? b.lastStrikeAt : null,
      modules: b ? b.modules.map((m) => ({ type: m.type, solved: m.solved })) : [],
      countdown: this.phase === 'brief' ? Math.ceil(Math.max(0, this.phaseEnds - this.ctx.now()) / 1000) : 0,
      result: this.result,
      history: this.history,
      stars: this.stars,
      maxStars: this.bombs * 3,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    const v = Object.assign(this.view(), { you: slot });
    const live = this.phase === 'brief' || this.phase === 'live' || this.phase === 'result';
    if (live && this.bomb) {
      v.role = slot === this.defuser ? 'defuser' : 'expert';
      if (v.role === 'defuser') v.bomb = this.bombFace();
      else v.manual = MANUAL;
    }
    return v;
  }
}

export default {
  id: 'bomb-squad',
  name: 'Bomb Squad',
  category: 'casual',
  needsPhone: true, // the bomb and the manual are both secret
  music: 'thinking',
  tagline: 'Co-op: one of you has a bomb on your phone, the other has the manual. Talk it through and defuse it before the timer runs out. Swap every bomb.',
  create: (ctx) => new BombSquad(ctx),
};
