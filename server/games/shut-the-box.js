// Shut the Box. Each of you has a box of tiles numbered 1 to 9 (or 1 to 12), all open. Each round
// you play your box in turn: roll two dice (or just one, once the 7 and up are all shut), then shut
// any open tiles that add up to the roll (an 8: the 8, or 5 + 3, or 6 + 2, or 1 + 3 + 4 …). Keep
// going until you can't: what's still open, added up, is your score. Shut every tile and you've
// "shut the box": 0. Then the other plays, knowing the score to beat. The lower score takes the
// round (level: nobody). Who goes first swaps every round; first to 3 rounds (or 2 or 5) wins.
// Out of time rolling: the dice roll for you. Out of time shutting: your turn ends as it stands.

import { settingOf } from './options.js';

export const WIN_SCORE = 3;
export const TILES = 9;
export const TIMING = { rollMs: 15000, shutMs: 25000, stuckMs: 2200, roundEndMs: 5000 };

/** Tile n (1 …) is bit n - 1 of a mask. The sum of a mask's tiles. */
export function maskSum(mask) {
  let s = 0;
  for (let n = 1; mask; n++, mask >>= 1) if (mask & 1) s += n;
  return s;
}

/** The ways to shut tiles from `open` (a mask) that add up to `roll`: a list of masks. */
export function waysToShut(open, roll) {
  const out = [];
  for (let sub = open; sub; sub = (sub - 1) & open) if (maskSum(sub) === roll) out.push(sub);
  return out;
}

/** May one die be rolled? Only when the 7 and every tile above it are shut. */
export const oneDieOk = (open) => (open >> 6) === 0;

export class ShutTheBox {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.tiles = settingOf(ctx, 'tiles', TILES);
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.wins = [0, 0];
    this.round = 0;
    this.starter = 1;
    this.winner = null;
    this.newRound();
  }

  get full() {
    return (1 << this.tiles) - 1;
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    this.open = [this.full, this.full];
    this.scores = [null, null]; // each box's score once its turn is over
    this.result = null;
    this.turn = this.starter;
    this.startTurn();
  }

  startTurn() {
    this.dice = [];
    this.n = (this.n || 0) + 1;
    this.phase = 'roll';
    this.armClock(TIMING.rollMs, 'rollTimeUp');
  }

  rollTimeUp() {
    this.roll(oneDieOk(this.open[this.turn]) ? 1 : 2);
  }

  roll(count) {
    this.dice = [];
    for (let k = 0; k < count; k++) this.dice.push(1 + Math.floor(this.rng() * 6));
    this.n++;
    const total = this.dice.reduce((a, b) => a + b, 0);
    if (!waysToShut(this.open[this.turn], total).length) {
      // Nothing adds up: the turn's over.
      this.phase = 'stuck';
      this.deadline = null;
      return this.arm(TIMING.stuckMs, 'endTurn');
    }
    this.phase = 'shut';
    this.armClock(TIMING.shutMs, 'endTurn');
  }

  shut(mask) {
    this.open[this.turn] &= ~mask;
    this.n++;
    if (!this.open[this.turn]) return this.endTurn(); // shut the box!
    this.startTurn();
  }

  endTurn() {
    this.clearTimer();
    const s = this.turn;
    this.scores[s] = maskSum(this.open[s]);
    if (this.scores[1 - s] === null) {
      this.turn = 1 - s;
      return this.startTurn();
    }
    // Both done: the lower score takes the round.
    const [a, b] = this.scores;
    const w = a === b ? null : a < b ? 0 : 1;
    if (w !== null) this.wins[w]++;
    this.result = { winner: w, scores: this.scores.slice() };
    this.turn = null;
    this.dice = [];
    this.deadline = null;
    if (w !== null && this.wins[w] >= this.winScore) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.roundEndMs, 'newRound');
  }

  armClock(ms, then) {
    this.deadline = this.clock ? this.ctx.now() + ms : null;
    this.arm(ms, then);
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && (then === 'rollTimeUp' || (then === 'endTurn' && this.phase === 'shut'))) return;
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
    if (!this.clock && (this.phase === 'roll' || this.phase === 'shut')) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (slot !== this.turn) return;
    if (input.type === 'roll' && this.phase === 'roll') {
      if (input.dice === 2 || (input.dice === 1 && oneDieOk(this.open[slot]))) this.roll(input.dice);
      return;
    }
    if (input.type === 'shut' && this.phase === 'shut' && Array.isArray(input.tiles)) {
      const t = input.tiles;
      if (!t.length || t.length > this.tiles || !t.every((n) => Number.isInteger(n) && n >= 1 && n <= this.tiles)) return;
      let mask = 0;
      for (const n of t) mask |= 1 << (n - 1);
      if (maskSum(mask) !== this.dice.reduce((a, b) => a + b, 0) || (mask & ~this.open[slot]) || new Set(t).size !== t.length) return;
      this.shut(mask);
    }
  }

  view() {
    const total = this.dice.reduce((a, b) => a + b, 0);
    return {
      phase: this.phase,
      round: this.round,
      tiles: this.tiles,
      // Each box as a list of the open tile numbers.
      open: this.open.map((m) => Array.from({ length: this.tiles }, (_, i) => i + 1).filter((n) => m & (1 << (n - 1)))),
      scores: this.scores,
      wins: this.wins,
      winScore: this.winScore,
      turn: this.turn,
      dice: this.dice,
      total,
      oneDie: this.phase === 'roll' && oneDieOk(this.open[this.turn]),
      n: this.n,
      result: this.result,
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
  id: 'shut-the-box',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Shut the Box',
  tagline: 'Roll the dice and shut tiles that add up to the roll, until you can\'t. Lowest total left wins the round.',
  create: (ctx) => new ShutTheBox(ctx),
};
