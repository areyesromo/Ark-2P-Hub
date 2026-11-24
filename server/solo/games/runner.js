// Runner. You run on and on to the right; the ground throws cactuses at you
// (jump them) and birds fly in low (duck under them, or jump the low ones).
// Hold jump for a higher jump. The run gets faster the further you go.
// Score: how far you got, in metres.

import { lookOf } from './looks.js';

export const FIELD = { w: 100, h: 40, ground: 34 };
export const RUNNER = { x: 14, w: 4, h: 7, duckH: 3.5 };
export const PHYS = { gravity: 220, jump: 66, holdGravity: 120, maxHoldMs: 260 }; // units/s and units/s²
export const SPEED = { start: 32, max: 75, perMetre: 0.035 }; // units per second; 10 units = a metre
export const GAP = { min: 26, max: 60 }; // distance between obstacles, shrinking a little as speed grows
export const TIMING = { tickMs: 1000 / 60, sendEvery: 2, readyMs: 1200 };

export class Runner {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.look = lookOf(ctx, 'runner');
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.y = 0; // height above the ground
    this.vy = 0;
    this.ducking = false;
    this.holding = false; // jump held (a longer, higher jump)
    this.jumpAt = 0;
    this.distance = 0;
    this.speed = SPEED.start;
    this.obstacles = [];
    this.nextAt = FIELD.w + 10;
    this.jumps = 0;
    this.dodged = 0;
    this.ticks = 0;
    this.crashed = false;
    this.phase = 'ready';
    this.ctx.update();
  }

  get metres() {
    return Math.floor(this.distance / 10);
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
    const now = this.ctx.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    const steps = Math.max(1, Math.ceil(dt / (TIMING.tickMs / 1000)));
    for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps, now);
    if (this.phase !== 'play') return this.ctx.update();
    this.ticks++;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  /** A new obstacle at x: cactuses (1 to 3 together, short or tall) or a bird at one of three heights. */
  spawn(x) {
    const birds = this.metres > 40; // no birds right at the start
    if (birds && this.rng() < 0.3) {
      // low: jump it; middle: duck under it; high: just keep running.
      const height = [2.5, 6, 11][Math.floor(this.rng() * 3)];
      this.obstacles.push({ kind: 'bird', x, y: height, w: 5, h: 3 });
    } else {
      const n = 1 + Math.floor(this.rng() * (this.metres > 80 ? 3 : 2));
      const tall = this.rng() < 0.4;
      this.obstacles.push({ kind: 'cactus', x, y: 0, w: 2.5 * n, h: tall ? 7 : 4.5, n });
    }
    const gap = GAP.min + this.rng() * (GAP.max - GAP.min);
    this.nextAt = x + gap * (this.speed / SPEED.start) ** 0.6;
  }

  step(dt, now) {
    // Jumping: a held jump floats a little longer.
    if (this.y > 0 || this.vy > 0) {
      const floating = this.holding && this.vy > 0 && now - this.jumpAt < PHYS.maxHoldMs;
      this.vy -= (floating ? PHYS.holdGravity : this.ducking ? PHYS.gravity * 2 : PHYS.gravity) * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    const dx = this.speed * dt;
    this.distance += dx;
    for (const o of this.obstacles) o.x -= dx;
    this.nextAt -= dx;
    for (const o of this.obstacles) {
      if (!o.passed && o.x + o.w < RUNNER.x) {
        o.passed = true;
        this.dodged++;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -5);
    if (this.nextAt <= FIELD.w + 5) this.spawn(Math.max(this.nextAt, FIELD.w + 5));
    this.speed = Math.min(SPEED.max, SPEED.start + this.metres * SPEED.perMetre);

    // A crash: the runner's box (shorter when ducking on the ground) against each obstacle, a little forgiving.
    const h = this.ducking && this.y === 0 ? RUNNER.duckH : RUNNER.h;
    const r = { x: RUNNER.x + 0.5, y: this.y, w: RUNNER.w - 1, h: h - 0.5 };
    const hit = this.obstacles.find((o) => r.x < o.x + o.w - 0.4 && r.x + r.w > o.x + 0.4 && r.y < o.y + o.h - 0.4 && r.y + r.h > o.y + 0.4);
    if (hit) {
      this.crashed = true;
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  jump(on) {
    this.holding = on;
    if (!on) return;
    if (this.phase === 'ready') {
      this.phase = 'play';
      this.loop();
    }
    if (this.phase !== 'play' || this.y > 0) return;
    this.vy = PHYS.jump;
    this.y = 0.01;
    this.jumpAt = this.ctx.now();
    this.jumps++;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (input.type === 'jump' && typeof input.on === 'boolean') this.jump(input.on);
    else if (input.type === 'duck' && typeof input.on === 'boolean' && (this.phase === 'play' || this.phase === 'ready')) this.ducking = input.on;
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.phase = 'paused';
      this.ctx.update();
    } else if (this.phase === 'paused') {
      this.phase = 'play';
      this.holding = false;
      this.ctx.update();
      this.loop();
    }
  }

  hostView() {
    const r = (v) => Math.round(v * 100) / 100;
    return {
      look: this.look,
      phase: this.phase,
      player: this.ctx.player,
      field: FIELD,
      runner: { x: RUNNER.x, y: r(this.y), vy: r(this.vy), w: RUNNER.w, h: this.ducking && this.y === 0 ? RUNNER.duckH : RUNNER.h, ducking: this.ducking },
      obstacles: this.obstacles.map((o) => ({ kind: o.kind, x: r(o.x), y: o.y, w: o.w, h: o.h, n: o.n || 0 })),
      speed: this.phase === 'play' ? r(this.speed) : 0,
      distance: r(this.distance),
      gravity: PHYS.gravity,
      crashed: this.crashed,
      jumps: this.jumps,
      dodged: this.dodged,
      score: this.metres,
    };
  }

  playerView() {
    return { phase: this.phase, score: this.metres, ducking: this.ducking, speed: Math.round(this.speed) };
  }
}

export default {
  id: 'runner',
  name: 'Runner',
  tagline: 'Run, jump the cactuses, duck the birds. How far can you go?',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'm' },
  create: (ctx) => new Runner(ctx, ctx.rng),
};
