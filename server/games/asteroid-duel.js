// Asteroid Duel: two ships in a field of drifting rocks; the edges wrap round. Point the stick
// where you want to face: the ship turns that way, and pushing further fires the engine. Shoot
// your rival; big rocks split into smaller ones when shot, and flying into one hurts. Three lives
// a round: a hit costs one, and you come back at your spot after a moment with a short shield.
// Last ship flying takes the round (both out at once: a draw); after ROUND_MS, more lives left
// wins it. First to WIN_SCORE rounds.
//
// Same loop as Pong / Tanks: physics at 60 Hz, ~30 views a second.

import { settingOf } from './options.js';

export const WIN_SCORE = 3;
export const FIELD = { w: 16, h: 9 };

export const SHIP = { r: 0.35, turnRate: 5, accel: 7, drag: 0.5, maxSpeed: 6, lives: 3, thrustFrom: 0.45 };
export const BULLET = { r: 0.08, speed: 11, lifeMs: 900, reloadMs: 280, max: 3 }; // max: your shots in the air at once
// Rock sizes 1 (small) to 3 (big): radius and drifting speed.
export const ROCK = { sizes: [0.3, 0.55, 0.9], speeds: [1.6, 1.2, 0.8], start: 2 }; // start: mirrored pairs of big rocks
export const PHYSICS = { tickMs: 1000 / 60, sendEvery: 2 };
export const TIMING = { countdownMs: 3000, roundEndMs: 2500, roundMs: 90000, respawnMs: 1500, shieldMs: 2000, rockMs: 4000, retryMs: 250 };
const CLEAR = 1; // spawns (a ship, a new rock) keep this much space beyond touching

const START = [
  { x: 2.5, y: FIELD.h / 2, angle: 0 },
  { x: FIELD.w - 2.5, y: FIELD.h / 2, angle: Math.PI },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const wrap = (v, size) => ((v % size) + size) % size;
/** The shortest way from b to a across a wrapping edge. */
const delta = (a, b, size) => wrap(a - b + size / 2, size) - size / 2;
const dist = (a, b) => Math.hypot(delta(a.x, b.x, FIELD.w), delta(a.y, b.y, FIELD.h));
const rockR = (rock) => ROCK.sizes[rock.size - 1];

export class AsteroidDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.rockIds = 0;
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.nextRound();
    this.last = this.ctx.now();
    this.frame = 0;
    this.loop();
  }

  nextRound() {
    this.round++;
    this.ships = START.map((s) => ({ x: s.x, y: s.y, angle: s.angle, vx: 0, vy: 0, lives: SHIP.lives, alive: true, respawnAt: 0, shieldUntil: 0, reloadUntil: 0, thrust: false }));
    // A stick or trigger held through the pause keeps working (controllers and phones only send changes).
    if (!this.controls) this.controls = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    if (!this.triggers) this.triggers = [false, false];
    this.bullets = [];
    this.rocks = [];
    // Big rocks in mirrored pairs (the same distance from each ship, drifting the mirrored way).
    for (let i = 0; i < ROCK.start; i++) {
      const a = this.rng() * Math.PI * 2;
      this.addPair(3, 5 + this.rng() * 2, 0.5 + this.rng() * (FIELD.h - 1), Math.cos(a), Math.sin(a));
    }
    this.nextRockAt = Infinity;
    this.result = null;
    this.enter('countdown', TIMING.countdownMs);
  }

  /** A rock and its mirror image through the centre. */
  addPair(size, x, y, dx, dy) {
    const sp = ROCK.speeds[size - 1];
    this.rocks.push({ id: ++this.rockIds, size, x, y, vx: dx * sp, vy: dy * sp });
    this.rocks.push({ id: ++this.rockIds, size, x: FIELD.w - x, y: FIELD.h - y, vx: -dx * sp, vy: -dy * sp });
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  loop() {
    this.timer = this.ctx.setTimeout(() => {
      this.tick();
      if (this.phase !== 'over') this.loop();
    }, PHYSICS.tickMs);
  }

  tick() {
    const now = this.ctx.now();
    const dt = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    const before = this.phase;

    if (this.phase === 'countdown' && now >= this.phaseEnds) {
      this.roundEnds = now + TIMING.roundMs;
      this.phase = 'play';
      this.phaseEnds = null;
    } else if (this.phase === 'roundEnd' && now >= this.phaseEnds) {
      this.nextRound();
    }

    if (this.phase === 'play') {
      const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000)));
      for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps, now);
      if (this.phase === 'play' && now >= this.roundEnds) this.timeUp();
    }

    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  step(dt, now) {
    this.ships.forEach((s, i) => {
      if (!s.alive) {
        // Back at your spot once it's clear of rocks and your rival (checked every step).
        if (s.lives > 0 && now >= s.respawnAt && this.clear(START[i], SHIP.r, i)) {
          Object.assign(s, { x: START[i].x, y: START[i].y, angle: START[i].angle, vx: 0, vy: 0, alive: true, shieldUntil: now + TIMING.shieldMs });
        }
        return;
      }
      this.steer(s, this.controls[i], dt);
      if (this.triggers[i]) this.fire(i);
    });
    this.bullets.forEach((b) => {
      b.x = wrap(b.x + b.vx * dt, FIELD.w);
      b.y = wrap(b.y + b.vy * dt, FIELD.h);
    });
    this.bullets = this.bullets.filter((b) => now - b.born < BULLET.lifeMs);
    this.rocks.forEach((r) => {
      r.x = wrap(r.x + r.vx * dt, FIELD.w);
      r.y = wrap(r.y + r.vy * dt, FIELD.h);
    });

    const hadRocks = this.rocks.length > 0;
    this.collide(now);
    // An empty sky gets a new mirrored pair from the side edges after a moment.
    if (hadRocks && !this.rocks.length) this.nextRockAt = now + TIMING.rockMs;
    if (!this.rocks.length && now >= this.nextRockAt) this.newPair(now);

    const out = this.ships.map((s) => s.lives <= 0);
    if (out[0] || out[1]) {
      const draw = out[0] && out[1];
      this.endRound({ reason: 'out', draw, roundWinner: draw ? null : out[0] ? 1 : 0 });
    }
  }

  /**
   * A new mirrored pair of big rocks, clear of both ships: from the side edges if there's room,
   * else anywhere in the left half (and its mirror); none fits, another try in a moment.
   */
  newPair(now) {
    const r = ROCK.sizes[2];
    for (let i = 0; i < 16; i++) {
      const x = i < 8 ? 0.5 : 1 + this.rng() * (FIELD.w / 2 - 2);
      const y = 0.5 + this.rng() * (FIELD.h - 1);
      if (!this.clear({ x, y }, r) || !this.clear({ x: FIELD.w - x, y: FIELD.h - y }, r)) continue;
      const a = (this.rng() - 0.5) * 1.2; // heading into the field, roughly across it
      this.addPair(3, x, y, Math.cos(a), Math.sin(a));
      this.nextRockAt = Infinity;
      return;
    }
    this.nextRockAt = now + TIMING.retryMs;
  }

  /** Is a circle at `p` (radius r) well clear of every rock and ship (but `self`)? */
  clear(p, r, self) {
    if (this.rocks.some((rock) => dist(p, rock) < rockR(rock) + r + CLEAR)) return false;
    return this.ships.every((s, i) => i === self || !s.alive || dist(p, s) >= SHIP.r + r + CLEAR);
  }

  /** Turn towards the stick; past a light push, the engine fires too. */
  steer(s, c, dt) {
    const mag = Math.min(1, Math.hypot(c.x, c.y));
    s.thrust = false;
    if (mag > 0.15) {
      const diff = wrapAngle(Math.atan2(c.y, c.x) - s.angle);
      const turn = SHIP.turnRate * dt;
      s.angle = wrapAngle(s.angle + clamp(diff, -turn, turn));
      const push = Math.max(0, (mag - SHIP.thrustFrom) / (1 - SHIP.thrustFrom)) * Math.max(0, Math.cos(diff));
      if (push > 0) {
        s.vx += Math.cos(s.angle) * SHIP.accel * push * dt;
        s.vy += Math.sin(s.angle) * SHIP.accel * push * dt;
        s.thrust = true;
      }
    }
    const keep = Math.max(0, 1 - SHIP.drag * dt);
    s.vx *= keep;
    s.vy *= keep;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > SHIP.maxSpeed) {
      s.vx *= SHIP.maxSpeed / sp;
      s.vy *= SHIP.maxSpeed / sp;
    }
    s.x = wrap(s.x + s.vx * dt, FIELD.w);
    s.y = wrap(s.y + s.vy * dt, FIELD.h);
  }

  collide(now) {
    const hittable = (s) => s.alive && now >= s.shieldUntil;
    // Shots: into the rival, or into a rock (which splits).
    this.bullets = this.bullets.filter((b) => {
      const rival = this.ships[1 - b.owner];
      if (hittable(rival) && dist(b, rival) < SHIP.r + BULLET.r) {
        this.lose(rival, now);
        return false;
      }
      const rock = this.rocks.find((r) => dist(b, r) < rockR(r) + BULLET.r);
      if (rock) {
        this.split(rock, b.vx, b.vy);
        return false;
      }
      return true;
    });
    // Ships into rocks: both ships are checked before anything breaks, so neither goes first.
    const hits = this.ships.map((s) => (hittable(s) ? this.rocks.find((r) => dist(s, r) < rockR(r) + SHIP.r) : null));
    hits.forEach((rock, i) => {
      if (!rock) return;
      const s = this.ships[i];
      this.lose(s, now);
      if (this.rocks.includes(rock)) this.split(rock, s.vx, s.vy);
    });
    // Ships bump off each other (no harm done).
    const [a, b] = this.ships;
    if (a.alive && b.alive) {
      const dx = delta(b.x, a.x, FIELD.w);
      const dy = delta(b.y, a.y, FIELD.h);
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < SHIP.r * 2) {
        const nx = dx / d;
        const ny = dy / d;
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (closing > 0) {
          a.vx -= closing * nx;
          a.vy -= closing * ny;
          b.vx += closing * nx;
          b.vy += closing * ny;
        }
        const push = (SHIP.r * 2 - d) / 2;
        a.x = wrap(a.x - nx * push, FIELD.w);
        a.y = wrap(a.y - ny * push, FIELD.h);
        b.x = wrap(b.x + nx * push, FIELD.w);
        b.y = wrap(b.y + ny * push, FIELD.h);
      }
    }
  }

  lose(s, now) {
    s.lives--;
    s.alive = false;
    s.thrust = false;
    s.respawnAt = now + TIMING.respawnMs;
  }

  /** A rock breaks: two smaller ones fly off across the way it was hit (the smallest just go). */
  split(rock, hx, hy) {
    this.rocks = this.rocks.filter((r) => r !== rock);
    if (rock.size === 1) return;
    const size = rock.size - 1;
    const sp = ROCK.speeds[size - 1];
    const a = Math.atan2(hy, hx) + Math.PI / 2;
    [1, -1].forEach((side) => {
      this.rocks.push({ id: ++this.rockIds, size, x: rock.x, y: rock.y, vx: side * Math.cos(a) * sp, vy: side * Math.sin(a) * sp });
    });
  }

  fire(slot) {
    const s = this.ships[slot];
    const now = this.ctx.now();
    if (this.phase !== 'play' || !s.alive || now < s.reloadUntil) return;
    if (this.bullets.filter((b) => b.owner === slot).length >= BULLET.max) return;
    s.reloadUntil = now + BULLET.reloadMs;
    const ux = Math.cos(s.angle);
    const uy = Math.sin(s.angle);
    this.bullets.push({
      x: wrap(s.x + ux * (SHIP.r + 0.1), FIELD.w),
      y: wrap(s.y + uy * (SHIP.r + 0.1), FIELD.h),
      vx: s.vx + ux * BULLET.speed,
      vy: s.vy + uy * BULLET.speed,
      owner: slot,
      born: now,
    });
  }

  timeUp() {
    const [a, b] = this.ships.map((s) => s.lives);
    this.endRound({ reason: 'time', draw: a === b, roundWinner: a === b ? null : a > b ? 0 : 1 });
  }

  endRound(result) {
    this.bullets = [];
    if (result.roundWinner !== null) this.scores[result.roundWinner]++;
    this.result = result;
    const champ = this.scores.findIndex((s) => s >= this.winScore);
    if (champ !== -1) {
      this.winner = champ;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('roundEnd', TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'move' && typeof input.x === 'number' && typeof input.y === 'number' && Number.isFinite(input.x) && Number.isFinite(input.y)) {
      // Stick / joystick direction in TV coordinates (-1..1, down is +y).
      this.controls[slot] = { x: clamp(input.x, -1, 1), y: clamp(input.y, -1, 1) };
      // A controller's trigger rides along with its stick; a press shoots at once.
      if (typeof input.fire === 'boolean') {
        const pressed = input.fire && !this.triggers[slot];
        this.triggers[slot] = input.fire;
        if (pressed) this.fire(slot);
      }
    } else if (input.type === 'fire') {
      this.fire(slot);
    } else if (input.type === 'trigger' && typeof input.on === 'boolean') {
      // Held: fires as fast as the reload (and the shots in the air) allow.
      this.triggers[slot] = input.on;
      if (input.on) this.fire(slot);
    }
  }

  countdown() {
    return this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  timeLeft() {
    if (this.phase !== 'play') return null;
    return Math.max(0, Math.ceil((this.roundEnds - this.ctx.now()) / 1000));
  }

  hostView() {
    const now = this.ctx.now();
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      players: this.ctx.players,
      countdown: this.countdown(),
      timeLeft: this.timeLeft(),
      field: FIELD,
      shipR: SHIP.r,
      maxLives: SHIP.lives,
      ships: this.ships.map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, angle: s.angle, alive: s.alive, shield: s.alive && now < s.shieldUntil, lives: s.lives, thrust: s.thrust })),
      bullets: this.bullets.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, owner: b.owner })),
      rocks: this.rocks.map((r) => ({ id: r.id, x: r.x, y: r.y, vx: r.vx, vy: r.vy, r: rockR(r) })),
      result: this.result,
      winner: this.winner,
    };
  }

  playerView(slot) {
    const s = this.ships[slot];
    return {
      phase: this.phase,
      you: slot,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      countdown: this.countdown(),
      timeLeft: this.timeLeft(),
      lives: this.ships.map((x) => x.lives),
      maxLives: SHIP.lives,
      alive: s.alive,
      ready: s.alive && this.ctx.now() >= s.reloadUntil && this.bullets.filter((b) => b.owner === slot).length < BULLET.max,
      result: this.result,
      winner: this.winner,
    };
  }
}

export default {
  id: 'asteroid-duel',
  name: 'Asteroid Duel',
  tagline: 'Two ships in a field of drifting rocks. Turn, thrust and shoot your rival; mind the rocks. Three lives a round.',
  create: (ctx) => new AsteroidDuel(ctx),
};
