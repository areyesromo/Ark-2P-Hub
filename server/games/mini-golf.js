// Mini Golf. Both players play the same hole at the same time; the balls
// are "ghosts" that roll through each other. Phones pull back and release to
// putt (the phone shows the hole too); controllers aim with the stick and
// hold A to charge the shot. Water costs a stroke and puts you back where
// you shot from; after MAX_STROKES you pick up. Fewest strokes over the
// round wins. Players pick 3, 6 or 9 holes on the setup screen.
//
// The course is 20 x 12 units, landscape (as the TV shows it). The server
// runs the physics at 30 Hz with substeps, so fast balls never skip through
// a wall.

import { loadSettings, applySetting } from './options.js';

export const FIELD = { w: 20, h: 12 };
export const BALL_R = 0.22;
export const CUP_R = 0.38;
export const MAX_STROKES = 8; // not in after this many: pick up and score MAX_STROKES + 1
export const OPTIONS = { holes: [6, 3, 9] };
export const TIMING = { introMs: 3000, playMs: 90000, holeEndMs: 4500 };
export const PHYSICS = {
  tickMs: 1000 / 30,
  substeps: 8,
  maxSpeed: 12, // a full-power putt, units / s (rolls ~20 units on the green)
  rollDecel: 2.4, // units / s^2 on the green
  sandDecel: 13,
  drag: 0.15, // fraction of speed lost per second, on top of rolling
  wallBounce: 0.65,
  bumperBounce: 1.2,
  stopSpeed: 0.12,
  captureSpeed: 3, // slower than this over the cup and it drops
  chargeMs: 1800, // a controller's power meter goes 0 -> 1 -> 0 in this time
  turnSpeed: 1.8, // rad / s, aiming with the D-pad
};

// ---- the course -------------------------------------------------------------------

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/**
 * Nine holes. bounds: the outer wall (the ball stays inside); blocks: walls
 * inside it; sand and water: areas; bumpers: [x, y, r]; windmill: a blade
 * spinning about (x, y), `len` from the middle to each tip.
 */
export const COURSE = [
  {
    name: 'Warm-up',
    par: 2,
    tee: [3, 6],
    cup: [17, 6],
    bounds: rect(1, 3, 19, 9),
  },
  {
    name: 'Dogleg',
    par: 3,
    tee: [4, 3],
    cup: [16.5, 9],
    bounds: [[1, 1], [7, 1], [7, 7], [19, 7], [19, 11], [1, 11]],
  },
  {
    name: 'The Block',
    par: 3,
    tee: [3, 6],
    cup: [17, 6],
    bounds: rect(1, 1.5, 19, 10.5),
    blocks: [rect(8.5, 3.5, 11.5, 8.5)],
  },
  {
    name: 'Bumper Alley',
    par: 3,
    tee: [3, 6],
    cup: [17, 6],
    bounds: rect(1, 2, 19, 10),
    bumpers: [[7, 4.2, 0.6], [7, 7.8, 0.6], [10, 6, 0.75], [13, 4.2, 0.6], [13, 7.8, 0.6]],
  },
  {
    name: 'Sand Trap',
    par: 3,
    tee: [3, 8.5],
    cup: [17, 6],
    bounds: rect(1, 2, 19, 10),
    blocks: [rect(9.7, 5, 10.3, 10)],
    sand: [rect(13.5, 3.8, 15.5, 8.2)],
  },
  {
    name: 'Water Hazard',
    par: 3,
    tee: [3, 6],
    cup: [17, 6],
    bounds: rect(1, 1, 19, 11),
    water: [rect(6.5, 3.2, 13.5, 8.8)],
  },
  {
    name: 'Windmill',
    par: 3,
    tee: [3, 6],
    cup: [17, 6],
    bounds: rect(1, 2, 19, 10),
    blocks: [rect(9.5, 2, 10.5, 4.8), rect(9.5, 7.2, 10.5, 10)],
    windmill: { x: 10, y: 6, len: 2, speed: 1.6 },
  },
  {
    name: 'Zigzag',
    par: 4,
    tee: [3, 9],
    cup: [17, 3],
    bounds: rect(1, 1, 19, 11),
    blocks: [rect(5.8, 1, 6.4, 8), rect(9.7, 4, 10.3, 11), rect(13.6, 1, 14.2, 8)],
  },
  {
    name: 'Island Green',
    par: 3,
    tee: [3, 6],
    cup: [16, 6],
    bounds: rect(1, 1, 19, 11),
    water: [rect(10, 1, 19, 4.6), rect(10, 7.4, 19, 11), rect(10, 4.6, 11.2, 5.3), rect(10, 6.7, 11.2, 7.4)],
    sand: [rect(17.2, 4.6, 19, 7.4)],
    bumpers: [[6, 3.5, 0.5], [6, 8.5, 0.5]],
  },
];

// ---- geometry -------------------------------------------------------------------------

/** Is (x, y) inside the polygon? (even-odd rule) */
export function inPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Every wall of a hole as segments [ax, ay, bx, by]. */
export function wallsOf(hole) {
  const out = [];
  for (const poly of [hole.bounds].concat(hole.blocks || [])) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      out.push([a[0], a[1], b[0], b[1]]);
    }
  }
  return out;
}

/** The closest point to (px, py) on segment ab. */
function closest(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return [ax + t * dx, ay + t * dy];
}

/**
 * Push a ball out of a contact point (qx, qy) moving at (ux, uy) and bounce
 * it. Returns the impact speed (0 if there was no contact).
 */
function bounceOff(ball, qx, qy, r, bounce, ux = 0, uy = 0) {
  let nx = ball.x - qx;
  let ny = ball.y - qy;
  const d = Math.hypot(nx, ny);
  if (d >= r) return 0;
  if (d < 1e-9) {
    nx = -ball.vx;
    ny = -ball.vy;
  }
  const n = Math.hypot(nx, ny) || 1;
  nx /= n;
  ny /= n;
  ball.x = qx + nx * r;
  ball.y = qy + ny * r;
  const vn = (ball.vx - ux) * nx + (ball.vy - uy) * ny;
  if (vn >= 0) return 0;
  ball.vx -= (1 + bounce) * vn * nx;
  ball.vy -= (1 + bounce) * vn * ny;
  return -vn;
}

/** The windmill blade's two tips at a given angle. */
export function bladeOf(mill, angle) {
  const c = Math.cos(angle) * mill.len;
  const s = Math.sin(angle) * mill.len;
  return [mill.x - c, mill.y - s, mill.x + c, mill.y + s];
}

const triangle = (t) => (t < 0.5 ? 2 * t : 2 - 2 * t);
const round2 = (v) => Math.round(v * 100) / 100;

/** Pick `n` of the course's holes at random, played in course order. */
export function pickHoles(n, rng = Math.random) {
  const all = COURSE.map((_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n).sort((a, b) => a - b);
}

// ---- game ---------------------------------------------------------------------------------

export class MiniGolf {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.settings = loadSettings(ctx, OPTIONS);
  }

  /** The setup screen. */
  start() {
    this.stopLoop();
    this.phase = 'setup';
    this.phaseEnds = null;
    this.holes = [];
    this.index = -1;
    this.card = [[], []]; // strokes per hole played
    this.winner = null;
    this.draw = false;
    this.balls = null;
    this.ctx.update();
  }

  begin() {
    this.holes = pickHoles(this.settings.holes, this.rng);
    this.index = -1;
    this.card = [[], []];
    this.winner = null;
    this.draw = false;
    this.events = { putts: 0, walls: 0, bumpers: 0, splashes: 0, sunk: 0 };
    this.nextHole();
    this.loop();
  }

  get hole() {
    return COURSE[this.holes[this.index]];
  }

  nextHole() {
    this.index++;
    const hole = this.hole;
    this.walls = wallsOf(hole);
    const aim = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    this.balls = [0, 1].map(() => ({
      x: hole.tee[0],
      y: hole.tee[1],
      vx: 0,
      vy: 0,
      from: [hole.tee[0], hole.tee[1]], // where the last shot was taken (for water)
      strokes: 0,
      holed: false,
      done: false,
      aim: { angle: aim, power: 0 },
      pad: { x: 0, y: 0, turn: 0, charging: false, chargeAt: 0 },
    }));
    this.holeStart = this.ctx.now();
    this.enter('intro', TIMING.introMs);
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  // ---- loop ----

  loop() {
    this.stopLoop();
    this.last = this.ctx.now();
    const step = () => {
      this.timer = this.ctx.setTimeout(() => {
        this.timer = null;
        this.tick();
        if (this.phase !== 'over' && this.phase !== 'setup') step();
      }, PHYSICS.tickMs);
    };
    step();
  }

  stopLoop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  tick() {
    const now = this.ctx.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.phase === 'intro' && now >= this.phaseEnds) this.enter('play', TIMING.playMs);
    else if (this.phase === 'holeEnd' && now >= this.phaseEnds) {
      if (this.index + 1 < this.holes.length) this.nextHole();
      else return this.finish();
    }
    if (this.phase === 'play') {
      this.steer(dt);
      const sub = dt / PHYSICS.substeps;
      for (let s = 0; s < PHYSICS.substeps; s++) this.physics(sub, now - dt * 1000 + (s + 1) * sub * 1000);
      this.balls.forEach((b, slot) => this.checkDone(slot));
      if (this.balls.every((b) => b.done)) this.endHole();
      else if (now >= this.phaseEnds) this.endHole();
    }
    this.ctx.update();
  }

  /** Controllers: turn the aim, run the power meter. */
  steer(dt) {
    this.balls.forEach((b) => {
      const p = b.pad;
      if (Math.hypot(p.x, p.y) > 0.4) b.aim.angle = Math.atan2(p.y, p.x);
      else if (p.turn) b.aim.angle += p.turn * PHYSICS.turnSpeed * dt;
      if (p.charging) b.aim.power = round2(Math.max(0.04, triangle(((this.ctx.now() - p.chargeAt) % PHYSICS.chargeMs) / PHYSICS.chargeMs)));
    });
  }

  millAngle(at = this.ctx.now()) {
    const mill = this.hole.windmill;
    return mill ? (mill.speed * (at - this.holeStart)) / 1000 : 0;
  }

  physics(dt, at) {
    const hole = this.hole;
    const mill = hole.windmill;
    const blade = mill ? bladeOf(mill, this.millAngle(at)) : null;
    this.balls.forEach((b) => {
      if (b.holed || !(b.vx || b.vy)) return;
      // Roll.
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Walls, bumpers, the windmill.
      for (const w of this.walls) {
        const [qx, qy] = closest(w[0], w[1], w[2], w[3], b.x, b.y);
        if (bounceOff(b, qx, qy, BALL_R, PHYSICS.wallBounce) > 0.6) this.events.walls++;
      }
      for (const [x, y, r] of hole.bumpers || []) {
        const d = Math.hypot(b.x - x, b.y - y) || 1;
        const q = [x + ((b.x - x) / d) * r, y + ((b.y - y) / d) * r];
        if (d < r + BALL_R && bounceOff(b, q[0], q[1], BALL_R, PHYSICS.bumperBounce) > 0) this.events.bumpers++;
      }
      if (blade) {
        const [qx, qy] = closest(blade[0], blade[1], blade[2], blade[3], b.x, b.y);
        // The blade moves: its speed at the contact point is w x r.
        const ux = -mill.speed * (qy - mill.y);
        const uy = mill.speed * (qx - mill.x);
        if (bounceOff(b, qx, qy, BALL_R + 0.08, PHYSICS.wallBounce, ux, uy) > 0) this.events.walls++;
      }
      // Safety net: never let a ball leave the course.
      if (!inPolygon(hole.bounds, b.x, b.y)) {
        b.x = b.from[0];
        b.y = b.from[1];
        b.vx = b.vy = 0;
        return;
      }
      let speed = Math.hypot(b.vx, b.vy);
      if (speed > PHYSICS.maxSpeed * 1.3) {
        b.vx *= (PHYSICS.maxSpeed * 1.3) / speed;
        b.vy *= (PHYSICS.maxSpeed * 1.3) / speed;
        speed = PHYSICS.maxSpeed * 1.3;
      }
      // The cup: drop in if slow enough, otherwise it pulls the ball a little (lip-outs).
      const cx = hole.cup[0] - b.x;
      const cy = hole.cup[1] - b.y;
      const cd = Math.hypot(cx, cy);
      if (cd < CUP_R) {
        if (speed < PHYSICS.captureSpeed) {
          b.holed = true;
          b.x = hole.cup[0];
          b.y = hole.cup[1];
          b.vx = b.vy = 0;
          this.events.sunk++;
          return;
        }
        b.vx += (cx / (cd || 1)) * 9 * dt;
        b.vy += (cy / (cd || 1)) * 9 * dt;
      }
      // Water: back to where you shot from, one stroke penalty.
      if ((hole.water || []).some((p) => inPolygon(p, b.x, b.y))) {
        b.x = b.from[0];
        b.y = b.from[1];
        b.vx = b.vy = 0;
        b.strokes++;
        this.events.splashes++;
        return;
      }
      // Friction (much more in sand).
      const sandy = (hole.sand || []).some((p) => inPolygon(p, b.x, b.y));
      const slow = (sandy ? PHYSICS.sandDecel : PHYSICS.rollDecel) * dt + speed * PHYSICS.drag * dt;
      if (speed <= slow || speed < PHYSICS.stopSpeed) {
        b.vx = b.vy = 0;
      } else {
        b.vx *= (speed - slow) / speed;
        b.vy *= (speed - slow) / speed;
      }
    });
  }

  checkDone(slot) {
    const b = this.balls[slot];
    if (b.done) return;
    const resting = !(b.vx || b.vy);
    if (b.holed) b.done = true;
    else if (resting && b.strokes >= MAX_STROKES) b.done = true; // picks up
  }

  /** Strokes a ball scores on the hole: as played if it went in, else MAX_STROKES + 1. */
  scoreOf(b) {
    return b.holed ? b.strokes : MAX_STROKES + 1;
  }

  endHole() {
    this.balls.forEach((b, slot) => {
      b.done = true;
      b.vx = b.vy = 0;
      this.card[slot].push(this.scoreOf(b));
    });
    this.enter('holeEnd', TIMING.holeEndMs);
  }

  totals() {
    return this.card.map((c) => c.reduce((s, x) => s + x, 0));
  }

  finish() {
    this.stopLoop();
    const [a, b] = this.totals();
    this.winner = a === b ? null : a < b ? 0 : 1;
    this.draw = this.winner === null;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  shoot(slot, angle, power) {
    const b = this.balls[slot];
    if (this.phase !== 'play' || b.done || b.vx || b.vy) return;
    if (!Number.isFinite(angle) || !Number.isFinite(power)) return;
    power = Math.max(0, Math.min(1, power));
    if (power < 0.03) return;
    b.from = [b.x, b.y];
    b.vx = Math.cos(angle) * power * PHYSICS.maxSpeed;
    b.vy = Math.sin(angle) * power * PHYSICS.maxSpeed;
    b.strokes++;
    b.aim = { angle, power: 0 };
    this.events.putts++;
  }

  onInput(slot, input) {
    if (this.phase === 'setup') {
      if (input.type === 'setting' && applySetting(this.ctx, OPTIONS, this.settings, input.key, input.value)) this.ctx.update();
      if (input.type === 'go') this.begin();
      return;
    }
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.begin();
      if (input.type === 'setup') this.start();
      return;
    }
    if (!this.balls) return;
    const b = this.balls[slot];
    const num = (v) => (Number.isFinite(v) ? v : 0);
    if (input.type === 'aim') {
      // A phone showing where it's aiming (so the TV can draw it).
      if (Number.isFinite(input.angle)) b.aim = { angle: input.angle, power: Math.max(0, Math.min(1, num(input.power))) };
    } else if (input.type === 'shoot') {
      this.shoot(slot, input.angle, input.power);
    } else if (input.type === 'pad') {
      // A controller: stick direction, D-pad turning, and A held = charging.
      const p = b.pad;
      p.x = Math.max(-1, Math.min(1, num(input.x)));
      p.y = Math.max(-1, Math.min(1, num(input.y)));
      p.turn = Math.sign(num(input.turn));
      const charging = Boolean(input.charge) && this.phase === 'play' && !b.done && !(b.vx || b.vy);
      if (charging && !p.charging) p.chargeAt = this.ctx.now();
      if (!input.charge && p.charging) this.shoot(slot, b.aim.angle, b.aim.power);
      p.charging = charging;
      if (!charging && !(b.vx || b.vy)) b.aim.power = 0;
    }
  }

  // ---- views ----

  common() {
    const playing = this.balls && this.index >= 0;
    const hole = playing ? this.hole : null;
    return {
      phase: this.phase,
      settings: this.settings,
      options: OPTIONS,
      field: FIELD,
      ballR: BALL_R,
      cupR: CUP_R,
      maxStrokes: MAX_STROKES,
      holeNo: this.index + 1,
      holeCount: this.holes.length || this.settings.holes,
      hole: hole && {
        name: hole.name,
        par: hole.par,
        tee: hole.tee,
        cup: hole.cup,
        bounds: hole.bounds,
        blocks: hole.blocks || [],
        sand: hole.sand || [],
        water: hole.water || [],
        bumpers: hole.bumpers || [],
        windmill: hole.windmill || null,
      },
      millAngle: hole && hole.windmill ? round2(this.millAngle()) : 0,
      balls: playing
        ? this.balls.map((b) => ({
            x: round2(b.x),
            y: round2(b.y),
            vx: round2(b.vx),
            vy: round2(b.vy),
            strokes: b.strokes,
            holed: b.holed,
            done: b.done,
            aim: { angle: round2(b.aim.angle), power: b.aim.power },
          }))
        : null,
      pars: this.holes.map((i) => COURSE[i].par),
      holeNames: this.holes.map((i) => COURSE[i].name),
      card: this.card,
      // For the history: total strokes (lower is better) and the winner.
      scores: this.totals(),
      winner: this.winner,
      draw: this.draw,
      events: this.events || null,
      timeLeftMs: this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0,
      countdown: this.phase === 'intro' ? Math.ceil(Math.max(0, this.phaseEnds - this.ctx.now()) / 1000) : 0,
    };
  }

  hostView() {
    return Object.assign(this.common(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.common(), { you: slot });
  }
}

export default {
  id: 'mini-golf',
  name: 'Mini Golf',
  tagline: 'Same hole, same time: pull back and putt on your phone. Walls, bumpers, sand, water and a windmill. Fewest strokes wins.',
  create: (ctx) => new MiniGolf(ctx),
};
