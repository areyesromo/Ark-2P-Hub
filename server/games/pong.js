// Real-time Pong. The server runs the physics at 60 Hz and pushes ~30 views a
// second; the TV draws (and extrapolates) them on a canvas. Phones send an
// absolute paddle position from a touch strip, controllers send stick/D-pad
// direction; both move the paddle at the same top speed, so neither is faster.

import { settingOf } from './options.js';

export const WIN_SCORE = 5;

// Field in arbitrary units, 16:9 like the TV.
export const FIELD = {
  w: 16,
  h: 9,
  paddleH: 2.2,
  paddleW: 0.35,
  paddleX: 0.6, // gap between the wall behind a player and their paddle
  ballR: 0.22,
};
const LEFT_FACE = FIELD.paddleX + FIELD.paddleW;
const RIGHT_FACE = FIELD.w - LEFT_FACE;

export const PHYSICS = {
  tickMs: 1000 / 60,
  sendEvery: 2, // push a view every 2nd tick (~30 Hz)
  paddleSpeed: 13, // units / s
  ballStart: 8,
  ballMax: 20,
  speedUp: 1.06, // per paddle hit
  maxBounce: Math.PI * 0.3, // angle when the ball hits the very edge of a paddle
  serveSpread: 0.35, // radians of random serve angle
};

export const TIMING = { countdownMs: 3000, pointMs: 1200 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const PADDLE_MIN = FIELD.paddleH / 2;
const PADDLE_MAX = FIELD.h - FIELD.paddleH / 2;

export class Pong {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.winner = null;
    this.lastScorer = null;
    this.paddles = [FIELD.h / 2, FIELD.h / 2];
    // Per player: { mode: 'target', y } from phones, or { mode: 'axis', v } from controllers.
    this.controls = [{ mode: 'axis', v: 0 }, { mode: 'axis', v: 0 }];
    this.frame = 0;
    this.last = this.ctx.now();
    this.resetBall(this.rng() < 0.5 ? 0 : 1);
    this.enter('countdown', TIMING.countdownMs);
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.loop();
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  /** Ball in the middle, waiting to be served towards `towards` (the player who conceded). */
  resetBall(towards) {
    this.serveTo = towards;
    this.rally = 0;
    this.ball = { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0, speed: PHYSICS.ballStart };
  }

  serve() {
    const angle = (this.rng() * 2 - 1) * PHYSICS.serveSpread;
    const dir = this.serveTo === 0 ? -1 : 1;
    this.ball.vx = dir * Math.cos(angle) * this.ball.speed;
    this.ball.vy = Math.sin(angle) * this.ball.speed;
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

    if ((this.phase === 'countdown' || this.phase === 'point') && now >= this.phaseEnds) {
      this.phase = 'play';
      this.phaseEnds = null;
      this.serve();
    }

    // Fixed small sub-steps keep collisions exact even if a tick runs late.
    const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000)));
    for (let i = 0; i < steps && this.phase !== 'over'; i++) this.step(dt / steps);

    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  step(dt) {
    this.movePaddles(dt);
    if (this.phase !== 'play') return;

    const b = this.ball;
    const px = b.x;
    const py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Top / bottom walls.
    if (b.y < FIELD.ballR) {
      b.y = 2 * FIELD.ballR - b.y;
      b.vy = Math.abs(b.vy);
    } else if (b.y > FIELD.h - FIELD.ballR) {
      b.y = 2 * (FIELD.h - FIELD.ballR) - b.y;
      b.vy = -Math.abs(b.vy);
    }

    // Paddles: check whether the ball's leading edge crossed a paddle face this step.
    if (b.vx < 0 && px - FIELD.ballR >= LEFT_FACE && b.x - FIELD.ballR < LEFT_FACE) {
      this.tryBounce(0, px, py, LEFT_FACE + FIELD.ballR);
    } else if (b.vx > 0 && px + FIELD.ballR <= RIGHT_FACE && b.x + FIELD.ballR > RIGHT_FACE) {
      this.tryBounce(1, px, py, RIGHT_FACE - FIELD.ballR);
    }

    // Past a paddle and out: point to the other player.
    if (b.x < -FIELD.ballR) this.point(1);
    else if (b.x > FIELD.w + FIELD.ballR) this.point(0);
  }

  tryBounce(slot, px, py, contactX) {
    const b = this.ball;
    const t = (px - contactX) / (px - b.x || 1e-9);
    const y = py + (b.y - py) * clamp(t, 0, 1);
    const offset = y - this.paddles[slot];
    if (Math.abs(offset) > FIELD.paddleH / 2 + FIELD.ballR) return; // missed

    // Where it hits the paddle sets the angle; every hit is a bit faster.
    const rel = clamp(offset / (FIELD.paddleH / 2), -1, 1);
    const angle = rel * PHYSICS.maxBounce;
    b.speed = Math.min(b.speed * PHYSICS.speedUp, PHYSICS.ballMax);
    const dir = slot === 0 ? 1 : -1;
    b.vx = dir * Math.cos(angle) * b.speed;
    b.vy = Math.sin(angle) * b.speed;
    b.x = contactX;
    b.y = clamp(y, FIELD.ballR, FIELD.h - FIELD.ballR);
    this.rally++;
  }

  point(scorer) {
    this.scores[scorer]++;
    this.lastScorer = scorer;
    this.resetBall(1 - scorer);
    if (this.scores[scorer] >= this.winScore) {
      this.winner = scorer;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('point', TIMING.pointMs);
  }

  movePaddles(dt) {
    const maxMove = PHYSICS.paddleSpeed * dt;
    this.controls.forEach((c, slot) => {
      let y = this.paddles[slot];
      if (c.mode === 'target') y += clamp(c.y - y, -maxMove, maxMove);
      else y += c.v * maxMove;
      this.paddles[slot] = clamp(y, PADDLE_MIN, PADDLE_MAX);
    });
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'move' && Number.isFinite(input.y)) {
      // Phone touch strip: 0 = top, 1 = bottom.
      this.controls[slot] = { mode: 'target', y: clamp(input.y, 0, 1) * FIELD.h };
    } else if (input.type === 'axis' && Number.isFinite(input.v)) {
      // Controller: -1 = up, 1 = down.
      this.controls[slot] = { mode: 'axis', v: clamp(input.v, -1, 1) };
    }
  }

  hostView() {
    const b = this.ball;
    return {
      phase: this.phase,
      scores: this.scores,
      winScore: this.winScore,
      players: this.ctx.players,
      countdown: this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0,
      ball: { x: b.x, y: b.y, vx: b.vx, vy: b.vy },
      paddles: this.paddles,
      field: FIELD,
      rally: this.rally,
      lastScorer: this.lastScorer,
      winner: this.winner,
    };
  }

  playerView(slot) {
    return {
      phase: this.phase,
      you: slot,
      scores: this.scores,
      winScore: this.winScore,
      countdown: this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0,
      lastScorer: this.lastScorer,
      winner: this.winner,
    };
  }
}

export default {
  id: 'pong',
  name: 'Pong',
  tagline: 'The classic. Drag on your phone or use the stick to move your paddle. First to 5.',
  create: (ctx) => new Pong(ctx),
};
