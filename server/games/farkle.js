// Farkle: push-your-luck dice for two. On your turn roll six dice, and set aside at least one
// scoring die: each 1 is 100, each 5 is 50; three of a kind is 100 times the number (three 1s:
// 1,000); four, five or six of a kind 1,000, 2,000 or 3,000; a straight 1 to 6, three pairs, or four
// of a kind with a pair 1,500; two triples 2,500. Then roll the dice that are left, or bank what
// you've scored this turn. A roll with nothing that scores is a "farkle": you lose this turn's
// points. Set all six aside ("hot dice") and you roll all six again. First to bank 10,000 (or 5,000
// or 3,000), then the other has one last turn to beat it. Out of time to roll: the dice roll for
// you. Out of time choosing: it counts as a farkle.

import { settingOf } from './options.js';

export const TARGET = 10000;
export const TIMING = { rollMs: 15000, pickMs: 30000, farkleMs: 2400, bankMs: 1600 };

/**
 * What a set of dice scores when every one of them counts, or 0 if any die doesn't score.
 * (The most it can be worth, e.g. four 1s: four of a kind, 1,000; or three 1s and a 1, 1,100.)
 */
export function scoreOf(dice) {
  const n = dice.length;
  if (!n) return 0;
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  let special = 0;
  if (n === 6) {
    const counts = c.slice(1).filter(Boolean).sort((a, b) => a - b).join('');
    if (counts === '111111') special = 1500; // a straight
    else if (counts === '222' || counts === '24') special = 1500; // three pairs; four and a pair
    else if (counts === '33') special = 2500; // two triples
  }
  let total = 0;
  for (let f = 1; f <= 6; f++) {
    const k = c[f];
    if (!k) continue;
    const single = f === 1 ? 100 : f === 5 ? 50 : 0;
    const triple = f === 1 ? 1000 : f * 100;
    const kind = k >= 3 ? [0, 0, 0, triple, 1000, 2000, 3000][k] : 0;
    // Best use of k of this face: all as a set, a triple and singles, or all as singles.
    const best = Math.max(kind, k >= 3 && single ? triple + (k - 3) * single : 0, single * k);
    if (!best) return special; // a die that scores nothing (only a six-dice set can use it)
    total += best;
  }
  return Math.max(total, special);
}

/** The most the dice could score (every scoring die set aside), and whether anything scores. */
export function bestScore(dice) {
  let best = 0;
  for (let m = 1; m < 1 << dice.length; m++) {
    const s = scoreOf(dice.filter((_, i) => m & (1 << i)));
    if (s > best) best = s;
  }
  return best;
}

export class Farkle {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.target = settingOf(ctx, 'target', TARGET);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
    this.starter = 1;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.starter = 1 - this.starter;
    this.turn = this.starter;
    this.lastTurn = null; // who has the final turn, once someone reaches the target
    this.winner = null;
    this.n = 0;
    this.log = []; // each finished turn: { by, points, farkle }
    this.startTurn();
  }

  startTurn() {
    this.dice = []; // this roll
    this.kept = []; // set aside this turn (a list of sets, for the TV)
    this.turnPoints = 0;
    this.left = 6;
    this.phase = 'roll';
    this.armClock(TIMING.rollMs, 'rollTimeUp');
  }

  rollTimeUp() {
    this.roll();
  }

  roll() {
    this.dice = [];
    for (let k = 0; k < this.left; k++) this.dice.push(1 + Math.floor(this.rng() * 6));
    this.n++;
    if (!bestScore(this.dice)) {
      this.phase = 'farkle';
      this.deadline = null;
      return this.arm(TIMING.farkleMs, 'farkled');
    }
    this.phase = 'pick';
    this.armClock(TIMING.pickMs, 'pickTimeUp');
  }

  /** Out of time choosing: a farkle. */
  pickTimeUp() {
    this.farkled();
  }

  farkled() {
    this.endTurn(0, true);
  }

  keep(idx, then) {
    const set = idx.map((i) => this.dice[i]);
    this.turnPoints += scoreOf(set);
    this.kept.push(set);
    this.left -= set.length;
    if (!this.left) this.left = 6; // hot dice: all six again
    this.dice = this.dice.filter((_, i) => !idx.includes(i));
    this.n++;
    if (then === 'bank') return this.endTurn(this.turnPoints, false);
    this.roll();
  }

  endTurn(points, farkle) {
    this.clearTimer();
    const s = this.turn;
    this.scores[s] += points;
    this.log.push({ by: s, points, farkle });
    this.banked = { by: s, points, farkle };
    this.n++;
    if (this.lastTurn === s) return this.finish(); // the last turn's been played
    if (this.lastTurn === null && this.scores[s] >= this.target) this.lastTurn = 1 - s; // they get one more go
    this.turn = 1 - s;
    this.phase = 'banked';
    this.deadline = null;
    this.dice = [];
    this.arm(farkle ? 1 : TIMING.bankMs, 'startTurn');
  }

  finish() {
    this.clearTimer();
    const [a, b] = this.scores;
    this.winner = a === b ? null : a > b ? 0 : 1;
    this.phase = 'over';
    this.turn = null;
    this.deadline = null;
    this.ctx.update();
  }

  armClock(ms, then) {
    this.deadline = this.clock ? this.ctx.now() + ms : null;
    this.arm(ms, then);
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && /TimeUp$/.test(then)) return;
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
    if (this.deadline) this.deadline += downMs;
    if (!this.clock && /TimeUp$/.test(this.after)) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (slot !== this.turn) return;
    if (input.type === 'roll' && this.phase === 'roll') return this.roll();
    if (input.type === 'keep' && this.phase === 'pick' && Array.isArray(input.dice) && (input.then === 'roll' || input.then === 'bank')) {
      const idx = input.dice;
      if (!idx.length || new Set(idx).size !== idx.length || !idx.every((i) => Number.isInteger(i) && i >= 0 && i < this.dice.length)) return;
      if (!scoreOf(idx.map((i) => this.dice[i]))) return; // every die set aside must score
      this.keep(idx, input.then);
    }
  }

  view() {
    return {
      phase: this.phase,
      scores: this.scores,
      target: this.target,
      turn: this.turn,
      lastTurn: this.lastTurn,
      dice: this.dice,
      kept: this.kept,
      turnPoints: this.turnPoints,
      left: this.left,
      best: this.phase === 'pick' ? bestScore(this.dice) : 0,
      banked: this.banked || null,
      log: this.log.slice(-12),
      n: this.n,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
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
  id: 'farkle',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Farkle',
  tagline: 'Roll six dice, set aside 1s, 5s and sets, then roll on or bank. Nothing scores? Farkle: you lose the turn. First to 10,000.',
  create: (ctx) => new Farkle(ctx),
};
