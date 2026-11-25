// Brick Breaker, the 1 player mode of Brick Breaker Duel (brick-duel.js): its own engine, under Brick Breaker Duel's id, so the two are one game
// in the lobby (see soloGameOf in index.js). It came from Ark 1P Hub.
//
// Brick Breaker. Keep the ball in play with your paddle and smash every
// brick. Where the ball hits the paddle sets the angle it flies off at, and it
// speeds up a little on every paddle hit. Higher rows score more. Clear the
// wall and a new, faster level begins (with a life back, up to the start
// count). Lose the ball 3 times and it's over. Score: points.
//
// The phone sends where the paddle should be (a drag strip, x 0..1); a
// controller or the keyboard sends a direction (axis -1..1).

import { settingOf } from './options.js';
import { lookOf } from '../solo/games/looks.js';

export const FIELD = { w: 100, h: 75 };
export const PADDLE = { y: 70, h: 2, w: 16, speed: 110 }; // speed: units per second on the stick
export const BALL = { r: 1.1, speed: 48, maxSpeed: 92, speedUp: 1.035, levelUp: 1.08 };
export const BRICKS = { cols: 10, top: 8, h: 3, gap: 0.6 };
export const ROW_POINTS = [7, 7, 5, 5, 3, 3, 1, 1];
export const LIVES = { normal: 3, easy: 5 };
export const TIMING = { tickMs: 1000 / 60, sendEvery: 2, autoLaunchMs: 3000, lostMs: 1200, levelMs: 1800 };
const MAX_BOUNCE = (60 * Math.PI) / 180; // off the paddle's very edge

// Each level's wall: one string per row, '#' a brick, '.' a gap.
export const LEVELS = [
  ['##########', '##########', '##########', '##########', '##########', '##########'],
  ['#.#.#.#.#.', '.#.#.#.#.#', '#.#.#.#.#.', '.#.#.#.#.#', '#.#.#.#.#.', '.#.#.#.#.#', '#.#.#.#.#.'],
  ['....##....', '...####...', '..######..', '.########.', '##########', '.########.', '..######..', '...####...'],
  ['##########', '#........#', '#.######.#', '#.#....#.#', '#.#.##.#.#', '#.#....#.#', '#.######.#', '##########'],
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Breaker {
  constructor(ctx) {
    this.ctx = ctx;
    this.look = lookOf(ctx, 'brick-duel');
    this.easy = settingOf(ctx, 'lives', 'normal') === 'easy';
    this.timer = null;
  }

  start() {
    this.score = 0;
    this.level = 0;
    this.lives = this.easy ? LIVES.easy : LIVES.normal;
    this.paddleX = FIELD.w / 2;
    this.target = null; // where the phone wants the paddle (x in field units)
    this.axis = 0;
    this.ticks = 0;
    this.buildLevel();
    this.serve();
    this.loop();
  }

  buildLevel() {
    const rows = LEVELS[this.level % LEVELS.length];
    const bw = FIELD.w / BRICKS.cols;
    this.bricks = [];
    rows.forEach((row, r) => {
      [...row].forEach((c, col) => {
        if (c !== '#') return;
        this.bricks.push({ x: col * bw + BRICKS.gap / 2, y: BRICKS.top + r * BRICKS.h + BRICKS.gap / 2, w: bw - BRICKS.gap, h: BRICKS.h - BRICKS.gap, row: r, alive: true });
      });
    });
    this.speedBase = BALL.speed * BALL.levelUp ** this.level;
  }

  /** The ball sits on the paddle until launched (or launches by itself after a moment). */
  serve() {
    this.phase = 'serve';
    this.speed = this.speedBase;
    this.ball = { x: this.paddleX, y: PADDLE.y - BALL.r, vx: 0, vy: 0 };
    this.phaseEnds = this.ctx.now() + TIMING.autoLaunchMs;
    this.ctx.update();
  }

  launch() {
    if (this.phase !== 'serve') return;
    // Off at a slight angle, towards the side the paddle is moving, else to the right.
    const a = (this.axis < 0 ? -1 : 1) * (Math.PI / 9);
    this.ball.vx = Math.sin(a) * this.speed;
    this.ball.vy = -Math.cos(a) * this.speed;
    this.phase = 'play';
    this.phaseEnds = null;
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
    this.movePaddle(dt);
    if (this.phase === 'serve') {
      this.ball.x = this.paddleX;
      if (now >= this.phaseEnds) this.launch();
    } else if (this.phase === 'play') {
      // Fixed small sub-steps keep collisions exact even if a tick runs late.
      const steps = Math.max(1, Math.ceil(dt / (TIMING.tickMs / 1000)) * 2);
      for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps);
    } else if ((this.phase === 'lost' || this.phase === 'cleared') && now >= this.phaseEnds) {
      if (this.phase === 'cleared') {
        this.level++;
        this.lives = Math.min(this.lives + 1, this.easy ? LIVES.easy : LIVES.normal);
        this.buildLevel();
      }
      this.serve();
    }
    if (this.phase === 'over' || this.phase === 'paused') return this.ctx.update();
    this.ticks++;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  movePaddle(dt) {
    const half = PADDLE.w / 2;
    if (this.target !== null) {
      // Follow the finger, quickly but not instantly (so a jump across still takes a moment).
      const d = this.target - this.paddleX;
      const max = PADDLE.speed * 1.6 * dt;
      this.paddleX += clamp(d, -max, max);
    } else {
      this.paddleX += this.axis * PADDLE.speed * dt;
    }
    this.paddleX = clamp(this.paddleX, half, FIELD.w - half);
  }

  step(dt) {
    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Walls (left, right, top).
    if (b.x < BALL.r) { b.x = BALL.r; b.vx = Math.abs(b.vx); }
    if (b.x > FIELD.w - BALL.r) { b.x = FIELD.w - BALL.r; b.vx = -Math.abs(b.vx); }
    if (b.y < BALL.r) { b.y = BALL.r; b.vy = Math.abs(b.vy); }

    // The paddle: only when coming down onto its top.
    const half = PADDLE.w / 2;
    if (b.vy > 0 && b.y + BALL.r >= PADDLE.y && b.y - BALL.r <= PADDLE.y + PADDLE.h && Math.abs(b.x - this.paddleX) <= half + BALL.r) {
      const off = clamp((b.x - this.paddleX) / half, -1, 1);
      this.speed = Math.min(BALL.maxSpeed, this.speed * BALL.speedUp);
      const a = off * MAX_BOUNCE;
      b.vx = Math.sin(a) * this.speed;
      b.vy = -Math.cos(a) * this.speed;
      b.y = PADDLE.y - BALL.r;
    }

    // One brick per sub-step: bounce off the side it was hit on.
    for (const k of this.bricks) {
      if (!k.alive) continue;
      const nx = clamp(b.x, k.x, k.x + k.w);
      const ny = clamp(b.y, k.y, k.y + k.h);
      const dx = b.x - nx;
      const dy = b.y - ny;
      if (dx * dx + dy * dy > BALL.r * BALL.r) continue;
      k.alive = false;
      this.score += ROW_POINTS[Math.min(k.row, ROW_POINTS.length - 1)];
      const overlapX = Math.min(b.x + BALL.r - k.x, k.x + k.w - (b.x - BALL.r));
      const overlapY = Math.min(b.y + BALL.r - k.y, k.y + k.h - (b.y - BALL.r));
      if (overlapX < overlapY) b.vx = b.x < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
      else b.vy = b.y < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      if (!this.bricks.some((x) => x.alive)) {
        this.phase = 'cleared';
        this.phaseEnds = this.ctx.now() + TIMING.levelMs;
      }
      break;
    }

    if (b.y - BALL.r > FIELD.h) {
      this.lives--;
      if (this.lives <= 0) {
        this.phase = 'over';
        if (this.timer) this.ctx.clearTimeout(this.timer);
        this.timer = null;
      } else {
        this.phase = 'lost';
        this.phaseEnds = this.ctx.now() + TIMING.lostMs;
      }
    }
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase === 'over' || this.phase === 'paused') return;
    if (input.type === 'aim' && typeof input.x === 'number' && Number.isFinite(input.x)) {
      this.target = clamp(input.x, 0, 1) * FIELD.w;
    } else if (input.type === 'axis' && typeof input.v === 'number' && Number.isFinite(input.v)) {
      this.axis = clamp(input.v, -1, 1);
      this.target = null;
    } else if (input.type === 'launch') {
      this.launch();
    }
  }

  togglePause() {
    if (this.phase === 'play' || this.phase === 'serve') {
      this.resumeTo = this.phase;
      this.pausedLeft = this.phaseEnds ? this.phaseEnds - this.ctx.now() : null;
      this.phase = 'paused';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.ctx.update();
    } else if (this.phase === 'paused') {
      this.phase = this.resumeTo;
      if (this.pausedLeft !== null) this.phaseEnds = this.ctx.now() + this.pausedLeft;
      this.ctx.update();
      this.loop();
    }
  }

  get variant() {
    return this.easy ? 'Easy' : '';
  }

  hostView() {
    return {
      solo: true, // (the screens: Brick Breaker's, not Brick Breaker Duel's)
      look: this.look,
      phase: this.phase,
      player: this.ctx.player,
      field: FIELD,
      paddle: { x: this.paddleX, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
      ball: { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy, r: BALL.r },
      bricks: this.bricks.map((k) => (k.alive ? [k.x, k.y, k.w, k.h, k.row] : null)),
      level: this.level + 1,
      lives: this.lives,
      score: this.score,
      variant: this.variant,
    };
  }

  playerView() {
    return {
      solo: true, // (the screens: Brick Breaker's, not Brick Breaker Duel's)
      phase: this.phase,
      level: this.level + 1,
      lives: this.lives,
      score: this.score,
      paddleX: this.paddleX / FIELD.w,
      bricksLeft: this.bricks.filter((k) => k.alive).length,
      variant: this.variant,
    };
  }
}

/** The 1 player mode: played as a solo game (see server/solo/). */
export const soloBreaker = {
  id: 'brick-duel',
  name: 'Brick Breaker',
  tagline: 'Bounce the ball off your paddle and smash the wall, brick by brick.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Breaker(ctx, ctx.rng),
};
