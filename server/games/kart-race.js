// Kart Race. A top-down race on the TV: steer with ◀ ▶ on your phone (or a
// controller's stick), the karts accelerate on their own, brake for the tight
// bends. Grass slows you right down, boost pads speed you up, and the karts
// bump off each other. First across the line after the last lap wins the
// race. Six tracks; players pick the track (or a mix), laps and one race or
// best of 3.
//
// A track is a closed loop of control points (a smooth curve through them)
// with a fixed width, on a 32 x 18 field (16:9 like the TV). The server runs
// the physics at 60 Hz and pushes ~30 views a second.

import { loadSettings, applySetting } from './options.js';

export const FIELD = { w: 32, h: 18 };
export const TRACK_WIDTH = 3.4;
export const KART = { r: 0.42, accel: 7, maxSpeed: 8.5, grassSpeed: 3, brake: 16, drag: 1.2, turnRate: 2.6, boostSpeed: 12.5, boostMs: 1100 };
export const PHYSICS = { tickMs: 1000 / 60, sendEvery: 2 };
export const TIMING = { countdownMs: 3500, finishMs: 3500 };
export const SAMPLES = 240; // points on each track's centre line
export const CUT_JUMP = 0.05; // progress (fraction of a lap) gained in one tick that can only be a shortcut

/**
 * The tracks: control points (clockwise on screen), boost pads as
 * [where along the lap 0..1, offset from the centre line].
 */
export const TRACKS = [
  {
    name: 'Speedway',
    points: [[5, 9], [7, 4], [16, 3], [25, 4], [27, 9], [25, 14], [16, 15], [7, 14]],
    boosts: [[0.24, 0], [0.74, 0]],
  },
  {
    name: 'Kidney',
    points: [[5, 8], [8, 3.5], [15, 3], [22, 3.5], [27, 6], [27, 11], [23, 15], [18, 14.5], [16, 11], [14, 14.5], [9, 15], [5, 12.5]],
    boosts: [[0.18, 0.6], [0.5, -0.6]],
  },
  {
    name: 'Serpent',
    points: [[4, 5], [9, 3], [14, 5], [18, 3], [24, 3], [28, 6], [27, 12], [22, 15], [17, 13], [12, 15], [6, 14], [3, 10]],
    boosts: [[0.33, 0], [0.83, 0]],
  },
  {
    name: 'Grand Prix',
    // A long back straight, a chicane on the right and a wiggle along the bottom.
    points: [[3.5, 4], [10, 3], [17, 4.5], [22, 3], [28, 4], [28.5, 9], [25, 10.2], [28, 14.5], [20, 15], [14, 13], [8, 15], [3.5, 13], [4.5, 8.5]],
    boosts: [[0.12, 0], [0.62, 0]],
  },
  {
    name: 'Hairpins',
    // Four long straights joined by tight hairpins: brake hard!
    points: [[4, 3], [26, 3], [28.5, 5.2], [26, 7.3], [13, 7.3], [11.2, 9.4], [13, 11.5], [26, 11.5], [28.5, 13.6], [26, 15.7], [4, 15.7], [2.6, 9.4]],
    boosts: [[0.08, 0], [0.45, 0], [0.82, 0]],
  },
  {
    name: 'Zigzag',
    // Saw teeth along the top, a dip along the bottom.
    points: [[3.5, 3.5], [9, 3], [12, 8.6], [15, 3.5], [19, 3.5], [22, 8.6], [25, 3.5], [28.5, 4], [28.5, 14.5], [22, 15], [16, 12.6], [10, 15], [3.5, 14.5]],
    boosts: [[0.6, 0], [0.92, 0]],
  },
];

export const OPTIONS = {
  track: [0, 1, 2, 3, 4, 5, 6], // 0: a different track each race
  laps: [5, 3, 8],
  races: [1, 3], // one race, or best of 3
};

// ---- tracks ----------------------------------------------------------------------

/** A smooth closed curve through the points (Catmull-Rom), as SAMPLES points. */
export function centreLine(points, n = SAMPLES) {
  const out = [];
  const m = points.length;
  for (let i = 0; i < n; i++) {
    const u = (i / n) * m;
    const k = Math.floor(u);
    const t = u - k;
    const p0 = points[(k - 1 + m) % m];
    const p1 = points[k % m];
    const p2 = points[(k + 1) % m];
    const p3 = points[(k + 2) % m];
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

/** Everything the game and the screens need about a track. */
export function buildTrack(index) {
  const def = TRACKS[index];
  const line = centreLine(def.points);
  // Cumulative length, so "progress" is distance along the lap.
  const cum = [0];
  for (let i = 1; i <= line.length; i++) {
    const a = line[i - 1];
    const b = line[i % line.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { index, name: def.name, line, cum, length: cum[line.length], boosts: def.boosts };
}

/** Where a point is relative to the track: progress 0..1 along the lap, and distance from the centre line. */
export function locate(track, x, y) {
  const { line, cum, length } = track;
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i < line.length; i++) {
    const a = line[i];
    const b = line[(i + 1) % line.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
    const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
    if (d < best.d) best = { d, s: (cum[i] + t * Math.sqrt(len2)) / length, i };
  }
  return best;
}

/** A point on the centre line at progress p (0..1), with the direction of travel there, shifted sideways by `offset`. */
export function pointAt(track, p, offset = 0) {
  const { line, cum, length } = track;
  const s = (((p % 1) + 1) % 1) * length;
  let i = 0;
  while (i < line.length - 1 && cum[i + 1] < s) i++;
  const a = line[i];
  const b = line[(i + 1) % line.length];
  const seg = cum[i + 1] - cum[i] || 1;
  const t = (s - cum[i]) / seg;
  const dx = (b[0] - a[0]) / seg;
  const dy = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t - dy * offset, y: a[1] + (b[1] - a[1]) * t + dx * offset, angle: Math.atan2(dy, dx) };
}

// ---- game ---------------------------------------------------------------------------

export class KartRace {
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
    this.scores = [0, 0];
    this.race = 0;
    this.winner = null;
    this.result = null;
    this.karts = null;
    this.track = null;
    this.ctx.update();
  }

  begin() {
    this.scores = [0, 0];
    this.race = 0;
    this.winner = null;
    this.events = { bumps: 0, boosts: 0, laps: 0, cuts: 0 };
    this.lastTrack = -1;
    this.newRace();
    this.loop();
  }

  get winScore() {
    return Math.ceil(this.settings.races / 2);
  }

  newRace() {
    this.race++;
    let index = this.settings.track - 1;
    if (index < 0) {
      // Mixed: a random track, not the last one.
      const others = TRACKS.map((_, i) => i).filter((i) => i !== this.lastTrack);
      index = others[Math.floor(this.rng() * others.length)];
    }
    this.lastTrack = index;
    this.track = buildTrack(index);
    this.result = null;
    // Side by side just past the start line, facing along the track.
    this.karts = [0, 1].map((slot) => {
      const p = pointAt(this.track, 0.012, slot === 0 ? -0.75 : 0.75);
      return {
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: 0,
        steer: 0,
        brake: false,
        laps: 0,
        progress: 0.012,
        halfway: false,
        boostUntil: 0,
        offTrack: false,
        cutAt: -Infinity,
        finishedAt: null,
      };
    });
    this.raceStart = null;
    this.enter('countdown', TIMING.countdownMs);
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  loop() {
    this.stopLoop();
    this.last = this.ctx.now();
    this.frame = 0;
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
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const before = this.phase;
    if (this.phase === 'countdown' && now >= this.phaseEnds) {
      this.raceStart = now;
      this.enter('race', 0);
    }
    if (this.phase === 'race' || this.phase === 'finish') {
      this.karts.forEach((k) => this.drive(k, dt, now));
      this.bump();
      this.karts.forEach((k, slot) => this.lapCheck(k, slot, now));
      if (this.phase === 'finish' && now >= this.phaseEnds) this.endRace();
    }
    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  drive(k, dt, now) {
    const where = locate(this.track, k.x, k.y);
    k.offTrack = where.d > TRACK_WIDTH / 2;
    const boosting = now < k.boostUntil;
    const top = boosting ? KART.boostSpeed : k.offTrack ? KART.grassSpeed : KART.maxSpeed;
    if (k.finishedAt !== null) {
      k.speed = Math.max(0, k.speed - KART.brake * 0.4 * dt); // coast to a stop after the line
    } else if (k.brake) {
      k.speed = Math.max(0, k.speed - KART.brake * dt);
    } else if (k.speed < top) {
      k.speed = Math.min(top, k.speed + KART.accel * dt);
    } else {
      // Over the limit (on grass, or a boost ran out): slow down, quickly on grass.
      k.speed = Math.max(top, k.speed - (k.offTrack ? 14 : KART.drag * 4) * dt);
    }
    // Turning needs a bit of speed.
    k.angle += k.steer * KART.turnRate * Math.min(1, k.speed / 3) * dt;
    k.x += Math.cos(k.angle) * k.speed * dt;
    k.y += Math.sin(k.angle) * k.speed * dt;
    // The edge of the field is a wall.
    const r = KART.r;
    if (k.x < r || k.x > FIELD.w - r || k.y < r || k.y > FIELD.h - r) {
      k.x = Math.min(FIELD.w - r, Math.max(r, k.x));
      k.y = Math.min(FIELD.h - r, Math.max(r, k.y));
      k.speed *= 0.5;
    }
    // Boost pads.
    if (!k.offTrack && k.finishedAt === null) {
      for (const [p, off] of this.track.boosts) {
        const pad = pointAt(this.track, p, off);
        if (Math.hypot(k.x - pad.x, k.y - pad.y) < 0.9 && now >= k.boostUntil - KART.boostMs + 300) {
          if (now >= k.boostUntil) this.events.boosts++;
          k.boostUntil = now + KART.boostMs;
          k.speed = Math.max(k.speed, KART.boostSpeed);
        }
      }
    }
  }

  /** The karts bump off each other. */
  bump() {
    const [a, b] = this.karts;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const min = KART.r * 2;
    if (d >= min || d === 0) return;
    const nx = dx / d;
    const ny = dy / d;
    const push = (min - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    a.speed *= 0.85;
    b.speed *= 0.85;
    this.events.bumps++;
  }

  /**
   * Count laps: crossing the line forwards after the halfway point is a lap;
   * backwards takes it away. And no shortcuts: progress along the lap only
   * creeps forward a little each tick, so rejoining the road much further on
   * means the kart cut across the grass. It goes back to where it left the
   * road, stopped.
   */
  lapCheck(k, slot, now) {
    const where = locate(this.track, k.x, k.y);
    const p = where.s;
    const was = k.progress;
    const jump = ((p - was + 1.5) % 1) - 0.5; // forwards, across the line or not
    if (jump > CUT_JUMP) {
      // Out on the grass the nearest bit of road can be a later stretch: hold
      // the progress until the kart is back on the tarmac, and only if it
      // rejoins further on is it a shortcut.
      if (where.d > TRACK_WIDTH / 2) return;
      const back = pointAt(this.track, was);
      Object.assign(k, { x: back.x, y: back.y, angle: back.angle, speed: 0, cutAt: now });
      this.events.cuts++;
      return;
    }
    k.progress = p;
    if (p > 0.4 && p < 0.6) k.halfway = true;
    if (k.finishedAt !== null) return;
    if (was > 0.75 && p < 0.25) {
      if (k.halfway) {
        k.laps++;
        k.halfway = false;
        this.events.laps++;
        if (k.laps >= this.settings.laps) this.finishLine(slot, now);
      }
    } else if (was < 0.25 && p > 0.75 && k.laps > 0) {
      k.laps--;
      k.halfway = true;
    }
  }

  finishLine(slot, now) {
    const k = this.karts[slot];
    k.finishedAt = now;
    if (this.phase === 'race') {
      // First across the line wins the race; the other gets a moment to finish too.
      this.result = { winner: slot, time: now - this.raceStart };
      this.scores[slot]++;
      this.enter('finish', TIMING.finishMs);
    }
  }

  endRace() {
    if (this.scores[this.result.winner] >= this.winScore) {
      this.winner = this.result.winner;
      this.stopLoop();
      this.phase = 'over';
      this.phaseEnds = null;
      this.ctx.update();
      return;
    }
    this.newRace();
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
    if (!this.karts) return;
    if (input.type === 'drive') {
      const k = this.karts[slot];
      const steer = Number(input.steer);
      k.steer = Number.isFinite(steer) ? Math.max(-1, Math.min(1, steer)) : 0;
      k.brake = Boolean(input.brake);
    }
  }

  // ---- views ----

  /** Who's ahead: more laps, then further along this lap; a finished kart beats an unfinished one. */
  positions() {
    const score = (k) => (k.finishedAt !== null ? 1e9 - k.finishedAt : k.laps + k.progress);
    const [a, b] = this.karts.map(score);
    return a >= b ? [1, 2] : [2, 1];
  }

  common() {
    const now = this.ctx.now();
    const racing = Boolean(this.karts);
    return {
      phase: this.phase,
      settings: this.settings,
      options: OPTIONS,
      field: FIELD,
      trackWidth: TRACK_WIDTH,
      trackNames: TRACKS.map((t) => t.name),
      kartR: KART.r,
      race: this.race,
      races: this.settings.races,
      laps: this.settings.laps,
      scores: this.scores,
      winScore: this.winScore,
      winner: this.winner,
      result: this.result,
      track: this.track ? { index: this.track.index, name: this.track.name, points: TRACKS[this.track.index].points, boosts: this.track.boosts.map(([p, off]) => pointAt(this.track, p, off)), start: pointAt(this.track, 0) } : null,
      karts: racing
        ? this.karts.map((k) => ({
            x: Math.round(k.x * 100) / 100,
            y: Math.round(k.y * 100) / 100,
            angle: Math.round(k.angle * 1000) / 1000,
            speed: Math.round(k.speed * 100) / 100,
            laps: k.laps,
            boosting: now < k.boostUntil,
            offTrack: k.offTrack,
            cut: now - k.cutAt < 1500, // "Shortcut!" for a moment
            finished: k.finishedAt !== null,
          }))
        : null,
      positions: racing ? this.positions() : null,
      raceMs: this.raceStart ? (this.result ? this.result.time : now - this.raceStart) : 0,
      events: this.events || null,
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - now) / 1000) : 0,
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
  id: 'kart-race',
  name: 'Kart Race',
  tagline: 'Top-down racing: steer with ◀ ▶, brake for the bends, hit the boost pads and bump your rival off the line. Three tracks.',
  create: (ctx) => new KartRace(ctx),
};
