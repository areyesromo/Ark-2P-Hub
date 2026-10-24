// Volley Blobs: beach volleyball between two bouncy blobs. Slide and jump on your side of the net
// and bounce the ball over: where it hits your dome sets where it goes (the front of the dome
// sends it forward, the top straight up). The ball landing on your side is a point to your
// rival, and so is a fourth touch in a row on one side. The one who lost the point serves:
// the ball drops over their blob. The server runs the physics at 60 Hz and pushes ~30 views a
// second; the TV smooths between them (as in Pong).

import { settingOf } from './options.js';

export const WIN_SCORE = 7;
export const MAX_TOUCHES = 3;

// Field in arbitrary units, 16:9 like the TV; y is up, the sand is y = 0.
export const FIELD = { w: 16, h: 9, netW: 0.2, netH: 2.4, blobR: 1, ballR: 0.32 };
export const START_X = [4, 12];

export const PHYSICS = {
  tickMs: 1000 / 60,
  sendEvery: 2, // push a view every 2nd tick (~30 Hz)
  moveSpeed: 7, // units / s
  jumpV: 11,
  blobGravity: 30,
  ballGravity: 12,
  ballMax: 15,
  netBounce: 0.8,
  serveY: 5,
  jumpBufferMs: 120, // a jump pressed just before landing still happens
};

export const TIMING = { countdownMs: 3000, pointMs: 1200 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const NET_L = FIELD.w / 2 - FIELD.netW / 2;
const NET_R = FIELD.w / 2 + FIELD.netW / 2;
// Where each blob's centre may go: its own half, wall to net.
const RANGE = [[FIELD.blobR, NET_L - FIELD.blobR], [NET_R + FIELD.blobR, FIELD.w - FIELD.blobR]];

export class VolleyBlobs {
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
    this.fault = null;
    this.frame = 0;
    this.last = this.ctx.now();
    this.resetRally(this.rng() < 0.5 ? 0 : 1);
    this.enter('countdown', TIMING.countdownMs);
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.loop();
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  /** Blobs back at their marks, the ball waiting over the server's blob. */
  resetRally(server) {
    this.serveTo = server;
    this.blobs = START_X.map((x) => ({ x, y: 0, vy: 0, move: 0, jumpUntil: -Infinity }));
    this.ball = { x: START_X[server], y: PHYSICS.serveY, vx: 0, vy: 0 };
    this.touches = [0, 0];
    this.contact = [false, false];
    this.side = server;
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

    if (this.phase === 'countdown' && now >= this.phaseEnds) this.enter('play');
    if (this.phase === 'point' && now >= this.phaseEnds) {
      this.fault = null;
      this.enter('play');
    }

    // Fixed small sub-steps keep collisions exact even if a tick runs late.
    const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000)));
    // The blobs can move (and jump) in the countdown and between points too; the ball waits.
    for (let i = 0; i < steps && this.phase !== 'over'; i++) {
      this.moveBlobs(dt / steps, now);
      if (this.phase === 'play') this.step(dt / steps);
    }

    this.frame++;
    if (this.phase === before && this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  moveBlobs(dt, now) {
    this.blobs.forEach((b, slot) => {
      b.x = clamp(b.x + b.move * PHYSICS.moveSpeed * dt, RANGE[slot][0], RANGE[slot][1]);
      if (b.y > 0 || b.vy > 0) {
        b.vy -= PHYSICS.blobGravity * dt;
        b.y += b.vy * dt;
        if (b.y <= 0) {
          b.y = 0;
          b.vy = 0;
          if (now < b.jumpUntil) this.jump(slot);
        }
      }
    });
  }

  step(dt) {

    const ball = this.ball;
    ball.vy -= PHYSICS.ballGravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const r = FIELD.ballR;
    if (ball.x < r) {
      ball.x = r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > FIELD.w - r) {
      ball.x = FIELD.w - r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y > FIELD.h - r) {
      ball.y = FIELD.h - r;
      ball.vy = -Math.abs(ball.vy);
    }
    this.bounceOffNet();

    // Over the net: a fresh set of touches.
    const side = ball.x < FIELD.w / 2 ? 0 : 1;
    if (side !== this.side) {
      this.side = side;
      this.touches = [0, 0];
    }

    for (let slot = 0; slot < 2 && this.phase === 'play'; slot++) this.hitBlob(slot);
    if (this.phase === 'play' && ball.y - r <= 0) this.point(ball.x < FIELD.w / 2 ? 1 : 0, null);
  }

  bounceOffNet() {
    const ball = this.ball;
    const cx = clamp(ball.x, NET_L, NET_R);
    const cy = clamp(ball.y, 0, FIELD.netH);
    let dx = ball.x - cx;
    let dy = ball.y - cy;
    let d = Math.hypot(dx, dy);
    if (d >= FIELD.ballR) return;
    if (d === 0) {
      // Centre inside the post: push it out the side it's on.
      dx = ball.x < FIELD.w / 2 ? -1 : 1;
      dy = 0;
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    ball.x = cx + nx * FIELD.ballR;
    ball.y = cy + ny * FIELD.ballR;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + PHYSICS.netBounce) * vn * nx;
      ball.vy -= (1 + PHYSICS.netBounce) * vn * ny;
    }
    // On top of the net and barely moving sideways: it rolls off the way it leans (dead centre:
    // over, away from the side it came from), so it never sits there.
    if (ny > 0.7 && Math.abs(ball.vx) < 1) {
      const dir = ball.x < FIELD.w / 2 ? -1 : ball.x > FIELD.w / 2 ? 1 : this.side === 0 ? 1 : -1;
      ball.vx = dir;
    }
  }

  /** The ball against a blob's dome: bounced off it the way the dome faces there. */
  hitBlob(slot) {
    const ball = this.ball;
    const b = this.blobs[slot];
    const dx = ball.x - b.x;
    const dy = ball.y - b.y;
    const d = Math.hypot(dx, dy);
    const reach = FIELD.blobR + FIELD.ballR;
    if (d >= reach || d === 0) {
      this.contact[slot] = false;
      return;
    }
    const nx = dx / d;
    const ny = dy / d;
    ball.x = b.x + nx * reach;
    ball.y = b.y + ny * reach;
    // Bounce relative to the blob, then add the blob's own movement (a jump hits harder).
    const bvx = b.move * PHYSICS.moveSpeed;
    const bvy = b.vy;
    let rx = ball.vx - bvx;
    let ry = ball.vy - bvy;
    const vn = rx * nx + ry * ny;
    if (vn < 0) {
      rx -= 2 * vn * nx;
      ry -= 2 * vn * ny;
    }
    ball.vx = rx + bvx;
    ball.vy = ry + bvy;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > PHYSICS.ballMax) {
      ball.vx *= PHYSICS.ballMax / speed;
      ball.vy *= PHYSICS.ballMax / speed;
    }
    if (this.contact[slot]) return; // still the same touch
    this.contact[slot] = true;
    this.touches[slot]++;
    this.touches[1 - slot] = 0;
    if (this.touches[slot] > MAX_TOUCHES) this.point(1 - slot, 'touches');
  }

  jump(slot) {
    const b = this.blobs[slot];
    b.vy = PHYSICS.jumpV;
    b.y = 1e-6;
    b.jumpUntil = -Infinity;
  }

  point(scorer, fault) {
    this.scores[scorer]++;
    this.lastScorer = scorer;
    this.fault = fault;
    this.resetRally(1 - scorer);
    if (this.scores[scorer] >= this.winScore) {
      this.winner = scorer;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('point', TIMING.pointMs);
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase === 'over') return;
    const b = this.blobs[slot];
    if (input.type === 'move' && typeof input.x === 'number' && Number.isFinite(input.x)) {
      b.move = clamp(input.x, -1, 1);
    } else if (input.type === 'jump') {
      if (b.y === 0) this.jump(slot);
      else b.jumpUntil = this.ctx.now() + PHYSICS.jumpBufferMs;
    }
  }

  countdown() {
    return this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  hostView() {
    const b = this.ball;
    return {
      phase: this.phase,
      scores: this.scores,
      winScore: this.winScore,
      players: this.ctx.players,
      countdown: this.countdown(),
      ball: { x: b.x, y: b.y, vx: b.vx, vy: b.vy },
      blobs: this.blobs.map((p) => ({ x: p.x, y: p.y, move: p.move })),
      field: FIELD,
      gravity: PHYSICS.ballGravity,
      touches: this.touches,
      maxTouches: MAX_TOUCHES,
      serveTo: this.serveTo,
      lastScorer: this.lastScorer,
      fault: this.fault,
      winner: this.winner,
    };
  }

  playerView(slot) {
    return {
      phase: this.phase,
      you: slot,
      scores: this.scores,
      winScore: this.winScore,
      countdown: this.countdown(),
      serving: this.serveTo === slot,
      lastScorer: this.lastScorer,
      fault: this.fault,
      winner: this.winner,
    };
  }
}

export default {
  id: 'volley-blobs',
  name: 'Volley Blobs',
  tagline: 'Beach volleyball for two bouncy blobs. Slide, jump and bounce the ball over the net. First to 7.',
  create: (ctx) => new VolleyBlobs(ctx),
};
