// Air hockey. The table is landscape on the TV with a goal in each end wall;
// each player keeps their mallet in their own half. The server runs 2D
// physics at 60 Hz and pushes ~30 views a second (same loop as Pong).
//
// Phones send a finger position on a pad that shows *their* half of the
// table turned to face them (their goal at the bottom of the phone, the
// centre line at the top). Controllers send stick direction in TV
// coordinates. Both move the mallet at the same top speed.

export const WIN_SCORE = 7;

export const FIELD = {
  w: 16,
  h: 9,
  goalH: 3.2, // width of the goal mouth in the end walls
  malletR: 0.7,
  puckR: 0.4,
};

export const PHYSICS = {
  tickMs: 1000 / 60,
  sendEvery: 2, // ~30 views a second
  substeps: 2, // per tick, so fast hits never skip through a mallet
  malletSpeed: 20, // units / s, phones and controllers alike
  puckMax: 24,
  friction: 0.35, // fraction of speed lost per second
  wallBounce: 0.92,
  hitBounce: 0.9,
};

export const TIMING = { countdownMs: 3000, goalMs: 1500 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const HALF = FIELD.w / 2;
const START = [
  { x: 2.5, y: FIELD.h / 2 },
  { x: FIELD.w - 2.5, y: FIELD.h / 2 },
];

/** Where a mallet may go: its own half, inside the rails. */
function bounds(slot) {
  const r = FIELD.malletR;
  return slot === 0
    ? { x0: r, x1: HALF - r, y0: r, y1: FIELD.h - r }
    : { x0: HALF + r, x1: FIELD.w - r, y0: r, y1: FIELD.h - r };
}

/**
 * Phone pad -> table position. u = finger across the pad (0 left .. 1 right),
 * v = down the pad (0 top = centre line .. 1 bottom = own goal).
 */
export function padToTable(slot, u, v) {
  const b = bounds(slot);
  const toward = 1 - clamp(v, 0, 1); // 0 at own goal, 1 at the centre line
  const across = clamp(u, 0, 1);
  if (slot === 0) {
    // Facing right: phone-up = +x, phone-right = +y (down the TV).
    return { x: b.x0 + toward * (b.x1 - b.x0), y: b.y0 + across * (b.y1 - b.y0) };
  }
  // Facing left: phone-up = -x, phone-right = -y (up the TV).
  return { x: b.x1 - toward * (b.x1 - b.x0), y: b.y1 - across * (b.y1 - b.y0) };
}

export class AirHockey {
  constructor(ctx) {
    this.ctx = ctx;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.winner = null;
    this.lastScorer = null;
    this.mallets = START.map((s) => ({ x: s.x, y: s.y, vx: 0, vy: 0 }));
    this.controls = [{ mode: 'axis', x: 0, y: 0 }, { mode: 'axis', x: 0, y: 0 }];
    this.puck = { x: HALF, y: FIELD.h / 2, vx: 0, vy: 0 };
    this.frame = 0;
    this.last = this.ctx.now();
    this.enter('countdown', TIMING.countdownMs);
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.loop();
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

    if ((this.phase === 'countdown' || this.phase === 'goal') && now >= this.phaseEnds) {
      this.phase = 'play';
      this.phaseEnds = null;
    }

    const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000))) * PHYSICS.substeps;
    for (let i = 0; i < steps && this.phase !== 'over'; i++) this.step(dt / steps);

    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  step(dt) {
    this.moveMallets(dt);
    if (this.phase !== 'play') return;

    const p = this.puck;
    const r = FIELD.puckR;
    const keep = Math.max(0, 1 - PHYSICS.friction * dt);
    p.vx *= keep;
    p.vy *= keep;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Side rails
    if (p.y < r) {
      p.y = r;
      p.vy = Math.abs(p.vy) * PHYSICS.wallBounce;
    } else if (p.y > FIELD.h - r) {
      p.y = FIELD.h - r;
      p.vy = -Math.abs(p.vy) * PHYSICS.wallBounce;
    }

    // End walls: open where the goal is.
    const inMouth = Math.abs(p.y - FIELD.h / 2) < FIELD.goalH / 2;
    if (p.x < r && !inMouth) {
      p.x = r;
      p.vx = Math.abs(p.vx) * PHYSICS.wallBounce;
    } else if (p.x > FIELD.w - r && !inMouth) {
      p.x = FIELD.w - r;
      p.vx = -Math.abs(p.vx) * PHYSICS.wallBounce;
    }
    if (p.x < -r) return this.goal(1);
    if (p.x > FIELD.w + r) return this.goal(0);

    this.mallets.forEach((m) => this.collide(m));
  }

  /** Puck vs mallet: push the puck out, then bounce it off the (moving) mallet. */
  collide(m) {
    const p = this.puck;
    const min = FIELD.malletR + FIELD.puckR;
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= min) return;
    const nx = dist > 1e-9 ? dx / dist : 1;
    const ny = dist > 1e-9 ? dy / dist : 0;
    p.x = m.x + nx * min;
    p.y = m.y + ny * min;
    const vn = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
    if (vn < 0) {
      p.vx -= (1 + PHYSICS.hitBounce) * vn * nx;
      p.vy -= (1 + PHYSICS.hitBounce) * vn * ny;
    }
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PHYSICS.puckMax) {
      p.vx *= PHYSICS.puckMax / speed;
      p.vy *= PHYSICS.puckMax / speed;
    }
  }

  moveMallets(dt) {
    const maxMove = PHYSICS.malletSpeed * dt;
    this.mallets.forEach((m, slot) => {
      const c = this.controls[slot];
      const b = bounds(slot);
      const px = m.x;
      const py = m.y;
      if (c.mode === 'target') {
        const dx = c.x - m.x;
        const dy = c.y - m.y;
        const d = Math.hypot(dx, dy);
        const k = d > maxMove ? maxMove / d : 1;
        m.x += dx * k;
        m.y += dy * k;
      } else {
        // Diagonals aren't faster than straight moves.
        const len = Math.max(1, Math.hypot(c.x, c.y));
        m.x += (c.x / len) * maxMove;
        m.y += (c.y / len) * maxMove;
      }
      m.x = clamp(m.x, b.x0, b.x1);
      m.y = clamp(m.y, b.y0, b.y1);
      m.vx = dt > 0 ? (m.x - px) / dt : 0;
      m.vy = dt > 0 ? (m.y - py) / dt : 0;
    });
  }

  goal(scorer) {
    this.scores[scorer]++;
    this.lastScorer = scorer;
    // The puck restarts, still, in the half of the player who conceded.
    const conceder = 1 - scorer;
    this.puck = { x: conceder === 0 ? FIELD.w / 4 : (FIELD.w * 3) / 4, y: FIELD.h / 2, vx: 0, vy: 0 };
    if (this.scores[scorer] >= WIN_SCORE) {
      this.winner = scorer;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('goal', TIMING.goalMs);
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'move' && Number.isFinite(input.u) && Number.isFinite(input.v)) {
      const t = padToTable(slot, input.u, input.v);
      this.controls[slot] = { mode: 'target', x: t.x, y: t.y };
    } else if (input.type === 'axis' && Number.isFinite(input.x) && Number.isFinite(input.y)) {
      this.controls[slot] = { mode: 'axis', x: clamp(input.x, -1, 1), y: clamp(input.y, -1, 1) };
    }
  }

  countdown() {
    return this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  hostView() {
    const p = this.puck;
    return {
      phase: this.phase,
      scores: this.scores,
      winScore: WIN_SCORE,
      players: this.ctx.players,
      countdown: this.countdown(),
      puck: { x: p.x, y: p.y, vx: p.vx, vy: p.vy },
      mallets: this.mallets.map((m) => ({ x: m.x, y: m.y })),
      field: FIELD,
      lastScorer: this.lastScorer,
      winner: this.winner,
    };
  }

  playerView(slot) {
    return {
      phase: this.phase,
      you: slot,
      scores: this.scores,
      winScore: WIN_SCORE,
      countdown: this.countdown(),
      lastScorer: this.lastScorer,
      winner: this.winner,
    };
  }
}

export default {
  id: 'air-hockey',
  name: 'Air Hockey',
  tagline: 'Your phone is your half of the table: slide your mallet and smash the puck into their goal. First to 7.',
  create: (ctx) => new AirHockey(ctx),
};
