// Make 24: four numbers, the same for you both. Join two of them with + − × ÷ and they become one
// number; keep going till one is left. Make it 24 and you take the round (first to do it). Every
// puzzle can be done (some take a fraction on the way). Nobody in time: a way to do it is shown
// and nobody scores (or both of you give up on it: the same). First to WIN_SCORE rounds.

import { settingOf } from './options.js';

export const WIN_SCORE = 5;
export const PUZZLE_SECONDS = 90;
export const TIMING = { roundEndMs: 5500 };
export const OPS = ['+', '-', '*', '/'];

// ---- exact fractions ([top, bottom], bottom > 0, in lowest terms) ------------------

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function frac(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}
export function apply([an, ad], op, [bn, bd]) {
  if (op === '+') return frac(an * bd + bn * ad, ad * bd);
  if (op === '-') return frac(an * bd - bn * ad, ad * bd);
  if (op === '*') return frac(an * bn, ad * bd);
  if (op === '/') return bn === 0 ? null : frac(an * bd, ad * bn);
  return null;
}
const is24 = (f) => f[0] === 24 && f[1] === 1;
const SIGN = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/**
 * Replays steps ([i, op, j]: join items i and j of the list, the result goes on the end) on the
 * numbers. Gives the final value and the sum written out, or null for a step that can't be.
 */
export function replay(numbers, steps) {
  let items = numbers.map((n) => ({ v: frac(n), text: String(n), simple: true }));
  for (const step of steps) {
    if (!Array.isArray(step) || step.length !== 3) return null;
    const [i, op, j] = step;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i === j || i < 0 || j < 0 || i >= items.length || j >= items.length || !OPS.includes(op)) return null;
    const v = apply(items[i].v, op, items[j].v);
    if (!v) return null;
    const wrap = (x) => (x.simple ? x.text : '(' + x.text + ')');
    const joined = { v, text: wrap(items[i]) + ' ' + SIGN[op] + ' ' + wrap(items[j]), simple: false };
    items = items.filter((_, k) => k !== i && k !== j).concat(joined);
  }
  return items.length === 1 ? items[0] : null;
}

/** Every way to make 24 from these numbers (as written sums), up to `max` of them. */
export function solutions(numbers, max = Infinity) {
  const found = new Set();
  const walk = (items) => {
    if (found.size >= max) return;
    if (items.length === 1) {
      if (is24(items[0].v)) found.add(items[0].text);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          if ((op === '+' || op === '*') && j < i) continue; // (the same sum either way round)
          const v = apply(items[i].v, op, items[j].v);
          if (!v) continue;
          const wrap = (x) => (x.simple ? x.text : '(' + x.text + ')');
          const rest = items.filter((_, k) => k !== i && k !== j);
          walk(rest.concat({ v, text: wrap(items[i]) + ' ' + SIGN[op] + ' ' + wrap(items[j]), simple: false }));
        }
      }
    }
  };
  walk(numbers.map((n) => ({ v: frac(n), text: String(n), simple: true })));
  return [...found];
}

/** A puzzle: four numbers 1 to 9 that can make 24, and one way to. */
export function newPuzzle(rng) {
  for (;;) {
    const numbers = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 9));
    const ways = solutions(numbers, 1);
    if (ways.length) return { numbers, way: ways[0] };
  }
}

export class Make24 {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.seconds = settingOf(ctx, 'seconds', PUZZLE_SECONDS);
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.seen = [];
    this.newRound();
  }

  newRound() {
    this.clearTimer();
    this.round++;
    let p = newPuzzle(this.rng);
    for (let tries = 0; tries < 20 && this.seen.includes(p.numbers.slice().sort().join()); tries++) p = newPuzzle(this.rng);
    this.seen.push(p.numbers.slice().sort().join());
    this.numbers = p.numbers;
    this.way = p.way;
    this.progress = [0, 0]; // numbers joined so far on each phone (0 to 3), for the TV
    this.skips = [false, false]; // gave up on this one (both: it's shown, and the next)
    this.result = null;
    this.phase = 'play';
    this.deadline = this.seconds ? this.ctx.now() + this.seconds * 1000 : null;
    if (this.seconds) this.arm(this.seconds * 1000, 'timeUp');
    this.ctx.update();
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
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
    if (this.phase === 'play' && !this.seconds) return;
    if (this.deadline) this.deadline += downMs;
    this.arm(Math.max(0, this.due + downMs - this.ctx.now()), this.after);
  }

  timeUp() {
    this.endRound(null, null);
  }

  endRound(winner, text) {
    this.clearTimer();
    this.result = { winner, text: text || this.way, solved: winner !== null };
    this.deadline = null;
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.roundEndMs, 'newRound');
    this.ctx.update();
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'progress') {
      const n = input.joined;
      if (!Number.isInteger(n) || n < 0 || n > 3 || n === this.progress[slot]) return;
      this.progress[slot] = n;
      return this.ctx.update();
    }
    if (input.type === 'skip') {
      this.skips[slot] = !this.skips[slot];
      if (this.skips[0] && this.skips[1]) return this.endRound(null, null);
      return this.ctx.update();
    }
    if (input.type !== 'solve' || !Array.isArray(input.steps) || input.steps.length !== 3) return;
    const done = replay(this.numbers, input.steps);
    if (!done || !is24(done.v)) return; // (the phone only sends a 24)
    this.progress[slot] = 3;
    this.endRound(slot, done.text);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      numbers: this.numbers,
      progress: this.progress,
      skips: this.skips,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: Boolean(this.seconds),
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot });
  }
}

export default {
  id: 'make-24',
  phoneOnly: true, // (each of you works it out on your own phone)
  handheld: true,
  music: 'thinking',
  name: 'Make 24',
  tagline: 'Four numbers: join two with + − × ÷ and they become one. Make 24 before your rival does.',
  create: (ctx) => new Make24(ctx),
};
