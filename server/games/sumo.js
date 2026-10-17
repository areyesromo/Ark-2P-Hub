// Sumo (Bumper Arena). Two discs on a round platform: steer with the stick,
// build momentum, and shove your rival off the edge. DASH gives a burst of
// speed (with a cooldown), and a dashing hit knocks the other disc back extra
// hard. After a while the ring starts shrinking, so every round ends.
// Leave the ring and you lose the round (both at once: a draw). First to
// WIN_SCORE rounds.
//
// Same loop as Pong/Air Hockey/Tank Duel: physics at 60 Hz, ~30 views a second.

import { settingOf } from './options.js';

export const WIN_SCORE = 3;
export const FIELD = { w: 12, h: 12 }; // the ring sits in the middle
export const RING = { r: 5, minR: 1.6, shrinkAfterMs: 15000, shrinkMs: 30000 };
export const PLAYER = { r: 0.6, accel: 16, drag: 2.2, maxSpeed: 7 };
export const DASH = { speed: 9, cooldownMs: 1500, activeMs: 250, knockback: 1.6 };
export const BOUNCE = 0.9; // restitution between the two discs
export const PHYSICS = { tickMs: 1000 / 60, sendEvery: 2, substeps: 2 };
export const TIMING = { countdownMs: 3000, roundEndMs: 2500, roundMs: 60000 };

const CX = FIELD.w / 2;
const CY = FIELD.h / 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Sumo {
  constructor(ctx) {
    this.ctx = ctx;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.nextRound();
    this.last = this.ctx.now();
    this.frame = 0;
    this.loop();
  }

  nextRound() {
    this.round++;
    const d = RING.r * 0.55;
    this.players = [
      { x: CX - d, y: CY, vx: 0, vy: 0, dashReadyAt: 0, dashUntil: 0, out: false },
      { x: CX + d, y: CY, vx: 0, vy: 0, dashReadyAt: 0, dashUntil: 0, out: false },
    ];
    this.controls = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.ringR = RING.r;
    this.bumps = 0; // collisions so far this round (the TV plays a sound per bump)
    this.lastBump = 0; // how hard the last one was, 0..1
    this.dashes = [0, 0];
    this.result = null;
    this.enter('countdown', TIMING.countdownMs);
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
      this.playStarted = now;
      this.phase = 'play';
      this.phaseEnds = null;
    } else if (this.phase === 'roundEnd' && now >= this.phaseEnds) {
      this.nextRound();
    }

    if (this.phase === 'play') {
      this.ringR = this.ringAt(now);
      const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000))) * PHYSICS.substeps;
      for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps, now);
      if (this.phase === 'play' && now - this.playStarted >= TIMING.roundMs) this.endRound(null, 'time');
    }

    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  /** The ring holds its size for a while, then shrinks steadily to its minimum. */
  ringAt(now) {
    const t = now - this.playStarted - RING.shrinkAfterMs;
    if (t <= 0) return RING.r;
    return Math.max(RING.minR, RING.r - (RING.r - RING.minR) * (t / RING.shrinkMs));
  }

  step(dt, now) {
    this.players.forEach((p, i) => {
      const c = this.controls[i];
      p.vx += c.x * PLAYER.accel * dt;
      p.vy += c.y * PLAYER.accel * dt;
      const keep = Math.max(0, 1 - PLAYER.drag * dt);
      p.vx *= keep;
      p.vy *= keep;
      const speed = Math.hypot(p.vx, p.vy);
      const cap = now < p.dashUntil ? DASH.speed * 1.2 : PLAYER.maxSpeed;
      if (speed > cap) {
        p.vx *= cap / speed;
        p.vy *= cap / speed;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    this.collide(now);
    const out = this.players.map((p) => Math.hypot(p.x - CX, p.y - CY) > this.ringR);
    if (out[0] || out[1]) {
      out.forEach((o, i) => (this.players[i].out = o));
      this.endRound(out[0] && out[1] ? null : out[0] ? 1 : 0, 'out');
    }
  }

  collide(now) {
    const [a, b] = this.players;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const min = 2 * PLAYER.r;
    if (dist >= min || dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    // Separate them, half each.
    const push = (min - dist) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    // Closing speed along the line between them.
    const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (closing <= 0) return;
    const j = ((1 + BOUNCE) * closing) / 2;
    // A dashing disc hits harder: the other one takes extra knockback.
    const ka = now < b.dashUntil ? DASH.knockback : 1; // a gets pushed by b
    const kb = now < a.dashUntil ? DASH.knockback : 1;
    a.vx -= j * nx * ka;
    a.vy -= j * ny * ka;
    b.vx += j * nx * kb;
    b.vy += j * ny * kb;
    this.bumps++;
    this.lastBump = Math.min(1, closing / (DASH.speed * 1.5));
  }

  dash(slot) {
    const p = this.players[slot];
    const now = this.ctx.now();
    if (this.phase !== 'play' || now < p.dashReadyAt) return;
    // Dash where the stick points, or straight on if it's centred.
    let dx = this.controls[slot].x;
    let dy = this.controls[slot].y;
    if (Math.hypot(dx, dy) < 0.2) {
      dx = p.vx;
      dy = p.vy;
    }
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      // Standing still with no direction: dash at the rival.
      const o = this.players[1 - slot];
      dx = o.x - p.x;
      dy = o.y - p.y;
    }
    const l = Math.hypot(dx, dy) || 1;
    p.vx = (dx / l) * DASH.speed;
    p.vy = (dy / l) * DASH.speed;
    p.dashUntil = now + DASH.activeMs;
    p.dashReadyAt = now + DASH.cooldownMs;
    this.dashes[slot]++;
  }

  endRound(winner, reason) {
    this.result = { winner, draw: winner === null, reason };
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      this.phaseEnds = null;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.ctx.update();
      return;
    }
    this.enter('roundEnd', TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'move') {
      let x = Number(input.x);
      let y = Number(input.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      this.controls[slot] = { x, y };
    } else if (input.type === 'dash') {
      this.dash(slot);
    }
  }

  // ---- views ------------------------------------------------------------------

  view() {
    const now = this.ctx.now();
    return {
      phase: this.phase,
      round: this.round,
      field: FIELD,
      ring: { x: CX, y: CY, r: this.ringR, full: RING.r, min: RING.minR, shrinking: this.ringR < RING.r },
      playerR: PLAYER.r,
      discs: this.players.map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        out: p.out,
        dashing: now < p.dashUntil,
        dashIn: Math.max(0, p.dashReadyAt - now), // ms until DASH is ready again
      })),
      dashCooldownMs: DASH.cooldownMs,
      bumps: this.bumps,
      lastBump: this.lastBump,
      dashes: this.dashes,
      countdown: this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - now) / 1000)) : 0,
      timeLeft: this.phase === 'play' ? Math.max(0, Math.ceil((TIMING.roundMs - (now - this.playStarted)) / 1000)) : 0,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
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
  id: 'sumo',
  name: 'Sumo',
  tagline: 'Shove your rival off a shrinking ring. Steer with the stick, DASH to hit hard. First to 3.',
  create: (ctx) => new Sumo(ctx),
};
