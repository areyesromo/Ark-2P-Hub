// Bowling (ten-pin): ten frames on one 3D lane, taking turns a frame at a time. Phones drag the
// ball to where they stand and swipe it up the lane (the angle aims, the speed is the power, a
// curve in the swipe puts spin on it); controllers move with the stick and hold A for power.
// The roll itself is worked out here (ten-pin-roll.js) the moment the ball is let go, and the
// TV plays it back. Strikes and spares score as in a real game, with the bonus balls in the
// last frame; the higher total wins. Setup: 10 frames or a quick 5, and bumpers (no gutters).

import { settingOf } from './options.js';
import { rollBall, rackPins, scoreCard, LANE } from './ten-pin-roll.js';

export const TIMING = {
  introMs: 2500,
  afterMs: 1300, // after the pins settle: a moment to see what's left (and the Strike! banner)
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (n) => Math.round(n * 1000) / 1000;

export class TenPin {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.frameCount = settingOf(ctx, 'frames', 10) === 5 ? 5 : 10;
    this.bumpers = settingOf(ctx, 'bumpers', 0) === 1;
    this.rollFn = (t, pins) => rollBall(t, pins, { rng: this.rng, bumpers: this.bumpers });
    this.timer = null;
  }

  start() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.balls = [[], []]; // pins down, ball by ball
    this.stances = [0, 0];
    this.turn = 0;
    this.pins = rackPins();
    this.roll = null;
    this.rollId = 0;
    this.lastThrow = null;
    this.last = null; // what the last ball did: { slot, count, kind: 'strike' | 'spare' | 'gutter' | 'split' | null }
    this.streak = [0, 0];
    this.bestStreak = [0, 0];
    this.winner = null;
    this.draw = false;
    this.enter('intro', TIMING.introMs, () => this.enter('aim'));
  }

  /** A new phase; `then` runs after `ms` (the one timer). */
  enter(phase, ms = 0, then = null) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    if (ms && then) {
      this.timer = this.ctx.setTimeout(() => {
        this.timer = null;
        then();
      }, ms);
    }
    this.ctx.update();
  }

  card(slot) {
    return scoreCard(this.balls[slot], this.frameCount);
  }

  onInput(slot, input) {
    if ((slot !== 0 && slot !== 1) || !input || typeof input !== 'object') return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'aim' || slot !== this.turn) return;
    if (input.type === 'stance') {
      if (!num(input.x)) return;
      this.stances[slot] = r3(clamp(input.x, -LANE.maxStance, LANE.maxStance));
      return this.ctx.update();
    }
    if (input.type === 'throw') {
      if (![input.stance, input.aim, input.power, input.spin].every(num)) return;
      const t = {
        stance: r3(clamp(input.stance, -LANE.maxStance, LANE.maxStance)),
        aim: r3(clamp(input.aim, -1, 1)),
        power: r3(clamp(input.power, 0, 1)),
        spin: r3(clamp(input.spin, -1, 1)),
      };
      this.stances[slot] = t.stance;
      this.lastThrow = t;
      this.roll = this.rollFn(t, this.pins);
      this.rollId++;
      this.enter('rolling', this.roll.ms + TIMING.afterMs, () => this.settle());
    }
  }

  /** The ball's done: score it, then the next ball (this player's, or the other's frame). */
  settle() {
    const slot = this.turn;
    const roll = this.roll;
    const before = this.card(slot).next;
    const count = roll.down.length;
    this.balls[slot].push(count);
    // What it was, for the banner (and the streak, for the trophies).
    const fresh = before.fresh;
    let kind = null;
    if (fresh && count === 10) kind = 'strike';
    else if (!fresh && roll.standing.length === 0) kind = 'spare';
    else if (roll.gutter) kind = 'gutter';
    else if (fresh && roll.standing.length >= 2 && isSplit(roll.standing)) kind = 'split';
    this.last = { slot, count, kind };
    if (kind === 'strike') {
      this.streak[slot]++;
      this.bestStreak[slot] = Math.max(this.bestStreak[slot], this.streak[slot]);
    } else this.streak[slot] = 0;
    this.roll = null;

    const next = this.card(slot).next;
    if (next && next.ball > 0) {
      // Another ball in this frame: at what's left, or a fresh rack (the last frame's bonus balls).
      this.pins = next.fresh ? rackPins() : roll.standing;
      return this.enter('aim');
    }
    // The frame's over: the other player's turn (if they've a frame to bowl).
    const other = 1 - slot;
    const nextPlayer = !this.card(other).done ? other : !this.card(slot).done ? slot : null;
    if (nextPlayer === null) return this.finish();
    this.turn = nextPlayer;
    this.pins = rackPins();
    this.enter('aim');
  }

  finish() {
    const [a, b] = [this.card(0).total, this.card(1).total];
    this.winner = a === b ? null : a > b ? 0 : 1;
    this.draw = this.winner === null;
    this.enter('over');
  }

  view() {
    const cards = [this.card(0), this.card(1)];
    return {
      phase: this.phase,
      frames: this.frameCount,
      bumpers: this.bumpers,
      turn: this.turn,
      stance: this.stances[this.turn],
      standing: this.pins,
      next: cards[this.turn].next,
      roll: this.phase === 'rolling' && this.roll ? { id: this.rollId, frames: this.roll.frames, ms: this.roll.ms, gutter: this.roll.gutter, throw: this.lastThrow } : null,
      last: this.last,
      cards,
      scores: cards.map((c) => c.total),
      bestStreak: this.bestStreak.slice(),
      perfect: cards.map((c) => c.done && c.total === 30 * this.frameCount),
      winner: this.phase === 'over' ? this.winner : null,
      draw: this.phase === 'over' && this.draw,
      lane: { hw: LANE.hw, headPin: LANE.headPin, maxStance: LANE.maxStance, oilEnd: LANE.oilEnd },
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot });
  }
}

/** A split: the head pin down, and the pins left standing in two groups with a gap between. */
function isSplit(standing) {
  if (standing.some((p) => p.i === 0)) return false;
  const xs = standing.map((p) => p.x).sort((a, b) => a - b);
  for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > 0.35) return true;
  return false;
}

export default {
  id: 'ten-pin',
  name: 'Bowling',
  motion: true, // phones can swing to bowl (with the swipe as well)
  tagline: 'Ten-pin bowling in 3D: swipe the ball down the lane, curve it into the pocket, and bowl strikes and spares over ten frames.',
  create: (ctx) => new TenPin(ctx),
};
