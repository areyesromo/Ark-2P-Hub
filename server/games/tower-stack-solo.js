// Stack, the 1 player mode of Tower Stack (tower-stack.js): its own engine, under Tower Stack's id, so the two are one game
// in the lobby (see soloGameOf in index.js). It came from Ark 1P Hub.
//
// Stack. A block slides back and forth above the tower: tap to drop it. The
// part hanging over the edge is cut off, so the blocks get narrower; drop it
// right on top (a perfect drop) and nothing is lost, and a few perfect drops
// in a row win back some width. Miss the tower completely and it's over. It
// gets faster as the tower grows. Score: blocks stacked.
//
// The sliding block moves on a fixed schedule, so it needs no ticking: the
// screens draw it from its start time, and a drop says when the player saw it.

import { lookOf } from '../solo/games/looks.js';

export const FIELD = { w: 100 };
export const BASE = { x: 20, w: 60 };
export const SPEED = { start: 45, perBlock: 1.6, max: 120 }; // units per second
export const PERFECT = 2.5; // this close counts as right on top
export const GROW = { every: 3, by: 4 }; // perfect drops in a row that win width back, and how much
export const LAG = { early: 600, late: 120 }; // how far a drop's own time may be from the server's (ms)

export class Stack {
  constructor(ctx) {
    this.ctx = ctx;
    this.look = lookOf(ctx, 'tower-stack');
    this.timer = null;
  }

  start() {
    this.tower = [{ ...BASE }];
    this.perfects = 0; // in a row
    this.bestPerfects = 0;
    this.cut = null; // the piece that fell off the last block, for the screens to drop
    this.drops = 0;
    this.phase = 'play';
    this.launch();
    this.ctx.update();
  }

  get top() {
    return this.tower[this.tower.length - 1];
  }

  get placed() {
    return this.tower.length - 1;
  }

  /** A new block, as wide as the top one, starting from alternate sides. */
  launch() {
    const w = this.top.w;
    this.moving = {
      w,
      span: FIELD.w - w, // its left edge goes from 0 to here and back
      from: this.placed % 2 ? FIELD.w - w : 0,
      dir: this.placed % 2 ? -1 : 1,
      speed: Math.min(SPEED.max, SPEED.start + this.placed * SPEED.perBlock),
      startedAt: this.ctx.now(),
      pausedFor: 0,
    };
  }

  /** The sliding block's left edge t ms after it started (it bounces between the edges). */
  xAt(t) {
    const m = this.moving;
    if (m.span <= 0) return 0;
    const start = m.dir > 0 ? m.from : 2 * m.span - m.from; // as if always going right on a loop twice as long
    const d = (start + (m.speed * t) / 1000) % (2 * m.span);
    return d <= m.span ? d : 2 * m.span - d;
  }

  get movingFor() {
    const m = this.moving;
    const until = this.phase === 'paused' ? this.pausedAt : this.ctx.now();
    return until - m.startedAt - m.pausedFor;
  }

  drop(seen) {
    // The player saw the block a moment before the drop reached us: use their moment, within reason.
    const actual = this.movingFor;
    const t = Number.isFinite(seen) && seen <= actual + LAG.late && seen >= actual - LAG.early ? Math.max(0, seen) : actual;
    const x = this.xAt(t);
    const top = this.top;
    const w = this.moving.w;
    this.drops++;
    if (Math.abs(x - top.x) <= PERFECT) {
      this.perfects++;
      this.bestPerfects = Math.max(this.bestPerfects, this.perfects);
      let block = { x: top.x, w };
      // A few perfect drops in a row: the block grows back a little (never past the base).
      if (this.perfects % GROW.every === 0 && w < BASE.w) {
        const nw = Math.min(BASE.w, w + GROW.by);
        block = { x: Math.max(0, Math.min(FIELD.w - nw, top.x - (nw - w) / 2)), w: nw };
      }
      this.cut = null;
      this.tower.push(block);
    } else {
      this.perfects = 0;
      const left = Math.max(x, top.x);
      const right = Math.min(x + w, top.x + top.w);
      if (right - left <= 0) {
        this.cut = { x, w, all: true };
        this.phase = 'over';
        this.moving = null;
        this.ctx.update();
        return;
      }
      // The overhang falls off: on the left or the right of what stays.
      this.cut = x < top.x ? { x, w: top.x - x } : { x: right, w: x + w - right };
      this.tower.push({ x: left, w: right - left });
    }
    this.launch();
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (input.type === 'drop' && this.phase === 'play') this.drop(typeof input.t === 'number' ? input.t : NaN);
  }

  togglePause() {
    if (this.phase === 'play') {
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
    } else if (this.phase === 'paused') {
      this.moving.pausedFor += this.ctx.now() - this.pausedAt;
      this.phase = 'play';
    } else return;
    this.ctx.update();
  }

  view() {
    const m = this.moving;
    return {
      solo: true, // (the screens: Stack's, not Tower Stack's)
      phase: this.phase,
      field: FIELD,
      // The top of the tower is enough to draw (the screens scroll up with it).
      tower: this.tower.slice(-14),
      height: this.tower.length,
      // elapsed: how long the block had been moving when this view was made; the screens carry on from there.
      moving: m && { w: m.w, span: m.span, from: m.from, dir: m.dir, speed: m.speed, elapsed: this.movingFor },
      cut: this.cut,
      drops: this.drops,
      perfects: this.perfects,
      bestPerfects: this.bestPerfects,
      score: this.placed,
      look: this.look,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

/** The 1 player mode: played as a solo game (see server/solo/). */
export const soloStack = {
  id: 'tower-stack',
  name: 'Stack',
  tagline: 'Drop the sliding block on the tower. Overhangs get cut off. How high can you go?',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Stack(ctx),
};
