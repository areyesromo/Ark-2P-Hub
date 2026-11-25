// Asteroids, the 1 player mode of Asteroid Duel (asteroid-duel.js): its own engine, under Asteroid Duel's id, so the two are one game
// in the lobby (see soloGameOf in index.js). It came from Ark 1P Hub.
//
// Asteroids. Turn your ship, thrust and shoot. Big rocks split into two
// middle ones, middle ones into two small ones, small ones are gone. Hit a
// rock and you lose a ship (you come back in the middle, safe for a moment).
// Clear the screen and a bigger wave comes. Everything wraps round the
// edges. Score: 20 for a big rock, 50 a middle one, 100 a small one; an extra
// ship every 10,000 points.

import { lookOf } from '../solo/games/looks.js';

export const FIELD = { w: 160, h: 90 };
export const SHIP = { r: 2.2, turn: 4.2, thrust: 60, drag: 0.6, maxSpeed: 55 }; // turn: radians/s; thrust: units/s²
export const SHOT = { speed: 90, lifeMs: 900, max: 5, cooldownMs: 180 };
export const ROCKS = { sizes: [7, 4, 2.2], points: [20, 50, 100], speed: [10, 16, 24], firstWave: 4, maxWave: 11 };
export const TIMING = { tickMs: 1000 / 60, sendEvery: 2, respawnMs: 1500, safeMs: 2500, waveMs: 2000 };
export const LIVES = 3;
export const EXTRA_LIFE_EVERY = 10000;

const TAU = Math.PI * 2;
const wrap = (v, max) => ((v % max) + max) % max;

/** The shortest distance between two points on the wrap-round field. */
function dist2(a, b) {
  let dx = Math.abs(a.x - b.x);
  let dy = Math.abs(a.y - b.y);
  dx = Math.min(dx, FIELD.w - dx);
  dy = Math.min(dy, FIELD.h - dy);
  return dx * dx + dy * dy;
}

export class Asteroids {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.look = lookOf(ctx, 'asteroid-duel');
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.score = 0;
    this.lives = LIVES;
    this.wave = 0;
    this.shots = [];
    this.rocks = [];
    this.nextShotId = 1;
    this.lastShot = -Infinity;
    this.rot = 0; // -1, 0 or 1: the player is turning left / not / right
    this.thrusting = false;
    this.kills = 0;
    this.ticks = 0;
    this.respawnAt = 0;
    this.spawnShip();
    this.nextWave();
    this.phase = 'play';
    this.loop();
  }

  spawnShip() {
    this.ship = { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0, a: -Math.PI / 2, alive: true, safeUntil: this.ctx.now() + TIMING.safeMs };
  }

  /** A new wave of big rocks, around the edges and away from the ship. */
  nextWave() {
    this.wave++;
    const n = Math.min(ROCKS.maxWave, ROCKS.firstWave + this.wave - 1);
    for (let i = 0; i < n; i++) {
      let p;
      do {
        p = { x: this.rng() * FIELD.w, y: this.rng() * FIELD.h };
      } while (dist2(p, this.ship) < 30 * 30);
      this.addRock(p.x, p.y, 0);
    }
    this.waveAt = null;
  }

  addRock(x, y, size) {
    const a = this.rng() * TAU;
    const speed = ROCKS.speed[size] * (0.6 + this.rng() * 0.8);
    // Each rock gets a lumpy outline (radius multipliers) the TV draws.
    const shape = Array.from({ length: 9 }, () => Math.round((0.75 + this.rng() * 0.35) * 100) / 100);
    this.rocks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size, r: ROCKS.sizes[size], spin: (this.rng() - 0.5) * 2, rot: 0, shape });
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
    if (this.phase === 'play') {
      if (!this.ship.alive && now >= this.respawnAt) this.trySpawn(now);
      if (!this.rocks.length && this.waveAt === null) this.waveAt = now + TIMING.waveMs;
      if (this.waveAt !== null && now >= this.waveAt) this.nextWave();
    }
    if (this.phase !== 'play') return this.ctx.update();
    this.ticks++;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  /** Back in the middle, once no rock is right on top of it. */
  trySpawn(now) {
    const centre = { x: FIELD.w / 2, y: FIELD.h / 2 };
    if (this.rocks.some((r) => dist2(r, centre) < (r.r + 12) ** 2)) return;
    this.spawnShip();
    this.ship.safeUntil = now + TIMING.safeMs;
  }

  step(dt, now) {
    const s = this.ship;
    if (s.alive) {
      s.a += this.rot * SHIP.turn * dt;
      if (this.thrusting) {
        s.vx += Math.cos(s.a) * SHIP.thrust * dt;
        s.vy += Math.sin(s.a) * SHIP.thrust * dt;
      }
      const drag = Math.exp(-SHIP.drag * dt);
      s.vx *= drag;
      s.vy *= drag;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > SHIP.maxSpeed) {
        s.vx *= SHIP.maxSpeed / sp;
        s.vy *= SHIP.maxSpeed / sp;
      }
      s.x = wrap(s.x + s.vx * dt, FIELD.w);
      s.y = wrap(s.y + s.vy * dt, FIELD.h);
    }
    for (const r of this.rocks) {
      r.x = wrap(r.x + r.vx * dt, FIELD.w);
      r.y = wrap(r.y + r.vy * dt, FIELD.h);
      r.rot += r.spin * dt;
    }
    for (const b of this.shots) {
      b.x = wrap(b.x + b.vx * dt, FIELD.w);
      b.y = wrap(b.y + b.vy * dt, FIELD.h);
    }
    this.shots = this.shots.filter((b) => now - b.at < SHOT.lifeMs);

    // Shots against rocks: a hit rock splits (or goes), the shot is spent.
    for (const b of this.shots.slice()) {
      const i = this.rocks.findIndex((r) => dist2(r, b) < r.r * r.r);
      if (i === -1) continue;
      this.shots = this.shots.filter((x) => x !== b);
      this.breakRock(i);
    }

    if (s.alive && now >= s.safeUntil && this.rocks.some((r) => dist2(r, s) < (r.r + SHIP.r * 0.8) ** 2)) this.loseShip(now);
  }

  breakRock(i) {
    const r = this.rocks[i];
    this.rocks.splice(i, 1);
    const before = this.score;
    this.score += ROCKS.points[r.size];
    this.kills++;
    if (Math.floor(this.score / EXTRA_LIFE_EVERY) > Math.floor(before / EXTRA_LIFE_EVERY)) this.lives++;
    if (r.size < ROCKS.sizes.length - 1) for (let k = 0; k < 2; k++) this.addRock(r.x, r.y, r.size + 1);
  }

  loseShip(now) {
    this.ship.alive = false;
    this.lives--;
    this.thrusting = false;
    if (this.lives <= 0) {
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    this.respawnAt = now + TIMING.respawnMs;
  }

  fire() {
    const s = this.ship;
    const now = this.ctx.now();
    if (!s.alive || this.shots.length >= SHOT.max || now - this.lastShot < SHOT.cooldownMs) return;
    this.lastShot = now;
    this.shots.push({
      id: this.nextShotId++,
      x: wrap(s.x + Math.cos(s.a) * SHIP.r, FIELD.w),
      y: wrap(s.y + Math.sin(s.a) * SHIP.r, FIELD.h),
      vx: s.vx + Math.cos(s.a) * SHOT.speed,
      vy: s.vy + Math.sin(s.a) * SHOT.speed,
      at: now,
    });
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    if (input.type === 'ctl') {
      // Held controls, sent whenever they change: turning (-1, 0, 1) and the thruster.
      if (input.rot === -1 || input.rot === 0 || input.rot === 1) this.rot = input.rot;
      if (typeof input.thrust === 'boolean') this.thrusting = input.thrust;
    } else if (input.type === 'fire') {
      this.fire();
    }
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
      this.ctx.update();
    } else if (this.phase === 'paused') {
      // Timers that count from a moment (safety, respawn, the next wave, shots) move on by the pause.
      const gap = this.ctx.now() - this.pausedAt;
      this.ship.safeUntil += gap;
      if (this.respawnAt) this.respawnAt += gap;
      if (this.waveAt !== null) this.waveAt += gap;
      this.lastShot += gap;
      for (const b of this.shots) b.at += gap;
      this.phase = 'play';
      this.ctx.update();
      this.loop();
    }
  }

  hostView() {
    const now = this.ctx.now();
    const s = this.ship;
    const r1 = (v) => Math.round(v * 100) / 100;
    return {
      solo: true, // (the screens: Asteroids', not Asteroid Duel's)
      look: this.look,
      phase: this.phase,
      player: this.ctx.player,
      field: FIELD,
      ship: { x: r1(s.x), y: r1(s.y), vx: r1(s.vx), vy: r1(s.vy), a: r1(s.a), r: SHIP.r, alive: s.alive, safe: s.alive && now < s.safeUntil, thrust: this.thrusting && s.alive, rot: this.rot },
      rocks: this.rocks.map((r) => ({ x: r1(r.x), y: r1(r.y), vx: r1(r.vx), vy: r1(r.vy), r: r.r, rot: r1(r.rot), spin: r.spin, shape: r.shape })),
      shots: this.shots.map((b) => ({ id: b.id, x: r1(b.x), y: r1(b.y), vx: b.vx, vy: b.vy })),
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      kills: this.kills,
      turn: SHIP.turn,
    };
  }

  playerView() {
    return {
      solo: true, phase: this.phase, score: this.score, lives: this.lives, wave: this.wave, alive: this.ship.alive };
  }
}

/** The 1 player mode: played as a solo game (see server/solo/). */
export const soloAsteroids = {
  id: 'asteroid-duel',
  name: 'Asteroids',
  tagline: 'Turn, thrust and blast the rocks to bits before they hit you.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Asteroids(ctx, ctx.rng),
};
