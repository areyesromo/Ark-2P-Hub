// Flappy. A little bird falls all the time; each tap flaps it up. Fly through
// the gaps between the pipes without touching them or the ground.
// The pipes come a little faster and their gaps get a little smaller as you
// go. Score: pipes passed.

import { lookOf } from './looks.js';

export const FIELD = { w: 100, h: 60 };
export const BIRD = { x: 26, r: 2.2 };
export const PHYS = { gravity: 150, flap: -52, maxFall: 70 }; // units per second (squared)
export const PIPES = { w: 9, gap: 19, minGap: 14, spacing: 40, speed: 30, maxSpeed: 44, margin: 7 };
export const TIMING = { tickMs: 1000 / 60, sendEvery: 2 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Flappy {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.look = lookOf(ctx, 'flappy');
    this.timer = null;
  }

  start() {
    this.bird = { y: FIELD.h / 2, vy: 0 };
    this.pipes = [];
    this.passed = 0;
    this.flaps = 0;
    this.ticks = 0;
    this.distance = 0; // how far the pipes have moved, for the scrolling ground
    this.crashed = false;
    // Waits for the first flap, the bird bobbing in place.
    this.phase = 'ready';
    this.ctx.update();
  }

  get speed() {
    return Math.min(PIPES.maxSpeed, PIPES.speed + this.passed * 0.5);
  }

  get gap() {
    return Math.max(PIPES.minGap, PIPES.gap - this.passed * 0.15);
  }

  addPipe(x) {
    const gap = this.gap;
    const lo = PIPES.margin + gap / 2;
    const hi = FIELD.h - PIPES.margin - gap / 2;
    this.pipes.push({ x, gapY: lo + this.rng() * (hi - lo), gap, passed: false });
  }

  loop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.lastTick = this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.tick();
    }, TIMING.tickMs);
  }

  tick() {
    const dt = Math.min(0.1, (this.ctx.now() - this.lastTick) / 1000);
    // Small fixed steps, so a late tick can't carry the bird through a pipe.
    const steps = Math.max(1, Math.ceil(dt / (TIMING.tickMs / 1000)));
    for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps);
    if (this.phase !== 'play') return this.ctx.update();
    this.ticks++;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  step(dt) {
    const b = this.bird;
    b.vy = Math.min(PHYS.maxFall, b.vy + PHYS.gravity * dt);
    b.y += b.vy * dt;
    // The sky has a lid: flapping at the top keeps you there, it doesn't end the run.
    if (b.y < BIRD.r) {
      b.y = BIRD.r;
      b.vy = Math.max(0, b.vy);
    }
    const dx = this.speed * dt;
    this.distance += dx;
    for (const p of this.pipes) p.x -= dx;
    this.pipes = this.pipes.filter((p) => p.x + PIPES.w > -2);
    const last = this.pipes[this.pipes.length - 1];
    if (!last || last.x <= FIELD.w - PIPES.spacing) this.addPipe(last ? last.x + PIPES.spacing : FIELD.w + 10);

    for (const p of this.pipes) {
      if (!p.passed && p.x + PIPES.w < BIRD.x - BIRD.r) {
        p.passed = true;
        this.passed++;
      }
    }
    if (b.y + BIRD.r >= FIELD.h || this.hitsPipe()) this.crash();
  }

  /** The bird (a circle) against each pipe's two rectangles: above the gap and below it. */
  hitsPipe() {
    const y = this.bird.y;
    const touches = (x0, y0, x1, y1) => (BIRD.x - clamp(BIRD.x, x0, x1)) ** 2 + (y - clamp(y, y0, y1)) ** 2 < BIRD.r ** 2;
    return this.pipes.some((p) => touches(p.x, 0, p.x + PIPES.w, p.gapY - p.gap / 2) || touches(p.x, p.gapY + p.gap / 2, p.x + PIPES.w, FIELD.h));
  }

  crash() {
    this.crashed = true;
    this.bird.y = clamp(this.bird.y, BIRD.r, FIELD.h - BIRD.r);
    this.phase = 'over';
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  flap() {
    if (this.phase === 'ready') {
      this.phase = 'play';
      this.loop();
    }
    if (this.phase !== 'play') return;
    this.bird.vy = PHYS.flap;
    this.flaps++;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (input.type === 'flap') this.flap();
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.phase = 'paused';
      this.ctx.update();
    } else if (this.phase === 'paused') {
      // Carries on with a flap, so the bird doesn't drop straight into the ground.
      this.phase = 'play';
      this.bird.vy = PHYS.flap;
      this.ctx.update();
      this.loop();
    }
  }

  hostView() {
    return {
      phase: this.phase,
      player: this.ctx.player,
      field: FIELD,
      bird: { x: BIRD.x, y: this.bird.y, vy: this.bird.vy, r: BIRD.r },
      pipes: this.pipes.map((p) => ({ x: p.x, gapY: p.gapY, gap: p.gap })),
      pipeW: PIPES.w,
      speed: this.phase === 'play' ? this.speed : 0,
      distance: this.distance,
      gravity: PHYS.gravity,
      crashed: this.crashed,
      score: this.passed,
      look: this.look,
    };
  }

  playerView() {
    return { phase: this.phase, score: this.passed, flaps: this.flaps };
  }
}

export default {
  id: 'flappy',
  name: 'Flappy',
  tagline: 'Tap to flap. Fly through the gaps in the pipes, as far as you can.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Flappy(ctx, ctx.rng),
};
