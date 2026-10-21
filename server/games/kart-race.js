// Kart Race. A top-down race on the TV: hold GAS to drive (let go and you coast), steer with
// your phone (or a controller's stick), BRAKE for the bends, and keep holding BRAKE once
// stopped to reverse. Hold DRIFT through a bend to turn tighter; let go after a good drift for a
// mini-boost. Walls line the track: a glancing hit slides you along, a head-on one bounces you
// back. Grass slows you right down, boost pads speed you up, and the karts bump off each other. First across the line after the last lap wins the
// race. ? boxes on the road hand out items: a banana to drop behind you (hit
// one and you spin out), a turbo, or a shield against bananas. Six tracks;
// players pick the track (or a mix), laps, one race or best of 3, and items
// on or off.
//
// A track is a closed loop of control points (a smooth curve through them, built by the shared
// public/games/kart-race/track.js so every screen draws the same road) with a fixed width, on a
// 32 x 18 field (16:9 like the TV). The server runs the physics at 60 Hz and pushes ~30 views a
// second.

import { loadSettings, applySetting } from './options.js';
import '../../public/games/kart-race/track.js';
import '../../public/games/kart-race/racers.js';
import { ITEMS, rollItem, useItem, effects, hazardCheck, stepShots } from './kart-items.js';

export { ITEMS };

const Road = globalThis.ArkKartTrack;
const Racers = globalThis.ArkKartRacers;

export const FIELD = { w: 32, h: 18 };
export const TRACK_WIDTH = 3.4;
// A kart is a capsule as big as its picture on the TV (1.75 long, 1 wide): a circle of radius r
// swept along a spine `reach` either side of its middle, the way it faces.
export const KART = {
  r: 0.5,
  reach: 0.375,
  accel: 9, // holding GAS
  maxSpeed: 8.5,
  coast: 2.4, // slowing down with no pedal held
  brake: 18,
  reverseAccel: 7, // holding BRAKE once stopped
  reverseSpeed: 3.2,
  grassSpeed: 3.2,
  turnRate: 2.8, // radians a second at full lock…
  grip: 1.2, // …from this speed up (slower, it turns less; it never stops turning)
  boostSpeed: 12.5,
  boostMs: 1100,
  driftTurn: 1.5, // drifting turns this much tighter
  driftMinSpeed: 4.5,
  driftDrag: 1.6, // a drift scrubs a little speed
  driftChargeMs: 700, // drift this long, then let go: a mini-boost
  miniBoostMs: 600,
};
/** Walls run this far outside the road's edge (past a strip of grass). */
export const WALL = { out: 1.25, headOn: 0.72, bounce: 0.35 };
export const PHYSICS = { tickMs: 1000 / 60, sendEvery: 2 };
export const TIMING = { countdownMs: 3500, finishMs: 3500 };
export const SAMPLES = Road.SAMPLES; // points on each track's centre line
const NEAR_SPAN = 8; // how far along the road (in samples) a kart can get in one tick, with room to spare
export const CUT_JUMP = 0.05; // progress (fraction of a lap) gained in one tick that can only be a shortcut

/**
 * The tracks: control points (clockwise on screen), boost pads as
 * [where along the lap 0..1, offset from the centre line]. (Coins are placed round the lap
 * by coinSpots.)
 */
export const TRACKS = [
  {
    name: 'Speedway',
    points: [[5, 9], [7, 4], [16, 3], [25, 4], [27, 9], [25, 14], [16, 15], [7, 14]],
    boosts: [[0.24, 0], [0.74, 0]],
  },
  {
    name: 'Kidney',
    // The dip at the bottom used to be a spike no kart could turn: now a bend you can drive.
    points: [[5, 8], [8, 3.5], [15, 3], [22, 3.5], [27, 6], [27, 11], [23, 15], [18.5, 14.8], [16, 12.4], [13.5, 14.8], [9, 15], [5, 12.5]],
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
    // Starts on the top straight (the grid used to sit on a bend: you'd launch into the grass).
    points: [[13.5, 3.7], [17, 4.5], [22, 3], [28, 4], [28.5, 9], [25, 10.2], [28, 14.5], [20, 15], [14, 13], [8, 15], [3.5, 13], [4.5, 8.5], [3.5, 4], [10, 3]],
    boosts: [[0.95, 0], [0.48, 0]],
  },
  {
    name: 'Hairpins',
    // Four long straights joined by tight hairpins: brake hard!
    points: [[9.5, 2.9], [15, 2.9], [25.5, 2.9], [27.9, 3.4], [28.9, 4.98], [27.9, 6.55], [25.5, 7.05], [19.5, 7.05], [13.5, 7.05], [11.5, 7.55], [10.5, 9.2], [11.5, 10.85], [13.5, 11.35], [19.5, 11.35], [25.5, 11.35], [27.9, 11.85], [28.9, 13.43], [27.9, 15.0], [25.5, 15.5], [15, 15.5], [4, 15.5], [2.6, 9.2], [4, 2.9]],
    boosts: [[0.03, 0], [0.4, 0], [0.77, 0]],
  },
  {
    name: 'Zigzag',
    // Saw teeth along the top, a dip along the bottom.
    points: [[3.5, 9], [3.5, 3.5], [9, 3], [12, 8], [15, 3.5], [19, 3.5], [22, 8], [25, 3.5], [28.5, 4], [28.5, 14.5], [22, 15], [16, 12.6], [10, 15], [3.5, 14.5]],
    boosts: [[0.67, 0], [0.95, 0]],
  },
];

/**
 * Coins: each one you hold (up to `max`) adds `perCoin` to your top speed. A spin-out costs
 * `spinLoss` of them, a hard head-on hit on a wall (at `wallHitSpeed` or more) `wallLoss`, at most
 * once every `wallLossMs` (nudging along a wall costs nothing). A collected coin comes back later.
 */
export const COINS = { max: 15, perCoin: 0.05, r: 0.35, respawnMs: 8000, spinLoss: 3, wallLoss: 1, wallHitSpeed: 3, wallLossMs: 1500, perLap: 24, side: 1.0, clear: 0.035 };

/**
 * Where the coins go: single coins spread evenly round the lap (none on a boost pad, a row of ?
 * boxes or the start line), alternately left and right of the centre, so each one is its own
 * grab and you weave to collect a run of them. [[progress, offset], ...]
 */
export function coinSpots(def) {
  const near = (a, b) => Math.abs(((a - b + 1.5) % 1) - 0.5) < COINS.clear + 0.005;
  const spots = [];
  for (let i = 0; i < COINS.perLap; i++) {
    const p = (i + 0.5) / COINS.perLap;
    if (near(p, 0) || def.boosts.some(([b]) => near(p, b)) || ITEMS.rows.some((r) => near(p, r))) continue;
    spots.push([p, spots.length % 2 ? -COINS.side : COINS.side]);
  }
  return spots;
}


export const OPTIONS = {
  track: [0, 1, 2, 3, 4, 5, 6], // 0: a different track each race
  laps: [5, 3, 8],
  races: [1, 3], // one race, or best of 3
  items: [1, 0], // ? boxes on the track: on / off
};

// ---- tracks ----------------------------------------------------------------------

/** The centre line of a track (see public/games/kart-race/track.js). */
export function centreLine(points, n = SAMPLES) {
  return Road.centreLine(points, n);
}

/** Everything the game and the screens need about a track. */
export function buildTrack(index) {
  const def = TRACKS[index];
  const road = Road.build(def.points);
  // The barriers either side of the road (shared down the middle where two stretches run close).
  return { index, name: def.name, boosts: def.boosts, coins: coinSpots(def), ...road, edge: Road.barriers(road, TRACK_WIDTH / 2, WALL.out) };
}

/** Where a point is relative to the track: progress 0..1 along the lap, distance from the centre line, the nearest point on it. */
export function locate(track, x, y) {
  return Road.locate(track, x, y);
}

/** A point on the centre line at progress p (0..1), with the direction of travel there, shifted sideways by `offset`. */
export function pointAt(track, p, offset = 0) {
  return Road.pointAt(track, p, offset);
}

/** The ends of a kart's spine (see KART). */
function spine(k) {
  const dx = Math.cos(k.angle) * KART.reach;
  const dy = Math.sin(k.angle) * KART.reach;
  return [k.x - dx, k.y - dy, k.x + dx, k.y + dy];
}

/** The closest point to (x, y) on the segment (ax, ay)-(bx, by). */
function closest(ax, ay, bx, by, x, y) {
  const vx = bx - ax;
  const vy = by - ay;
  const len = vx * vx + vy * vy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len)) : 0;
  return [ax + vx * t, ay + vy * t];
}

/** How far (x, y) is from a kart's spine: it touches anything within its radius plus KART.r. */
export function touch(k, x, y) {
  const [ax, ay, bx, by] = spine(k);
  const [cx, cy] = closest(ax, ay, bx, by, x, y);
  return Math.hypot(x - cx, y - cy);
}

/** The closest points of two karts' spines: [ax, ay, bx, by]. */
function spinesClosest(a, b) {
  const sa = spine(a);
  const sb = spine(b);
  // Crossing spines (after a reset onto the rival, say): distance 0, apart along their middles.
  const turn = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  if (turn(sa[0], sa[1], sa[2], sa[3], sb[0], sb[1]) * turn(sa[0], sa[1], sa[2], sa[3], sb[2], sb[3]) < 0 &&
      turn(sb[0], sb[1], sb[2], sb[3], sa[0], sa[1]) * turn(sb[0], sb[1], sb[2], sb[3], sa[2], sa[3]) < 0) {
    return [a.x, a.y, b.x, b.y, 0];
  }
  // Otherwise the nearest pair is an end of one spine against the other spine.
  let best = null;
  const tryPair = (px, py, qx, qy) => {
    const d = Math.hypot(px - qx, py - qy);
    if (!best || d < best[4]) best = [px, py, qx, qy, d];
  };
  for (const [x, y] of [[sa[0], sa[1]], [sa[2], sa[3]]]) tryPair(x, y, ...closest(sb[0], sb[1], sb[2], sb[3], x, y));
  for (const [x, y] of [[sb[0], sb[1]], [sb[2], sb[3]]]) {
    const [cx, cy] = closest(sa[0], sa[1], sa[2], sa[3], x, y);
    tryPair(cx, cy, x, y);
  }
  return best;
}

// ---- game ---------------------------------------------------------------------------

export class KartRace {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.settings = loadSettings(ctx, OPTIONS);
    // Each player's racer and tyres (kept from match to match; changed on the setup and end screens).
    this.picks = Racers.DEFAULT_RACERS.map((racer) => ({ racer, tyre: Racers.DEFAULT_TYRE }));
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
    this.events = { bumps: 0, boosts: 0, laps: 0, cuts: 0, items: 0, used: 0, spins: 0, blocked: 0, walls: 0, miniBoosts: 0, coins: 0, coinsLost: 0, zapped: 0, frozen: 0, swapped: 0, starHits: 0, fired: 0, exploded: 0, snagged: 0 };
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
    // Item boxes (none if items are off) and the bananas lying on the road.
    this.boxes = [];
    if (this.settings.items) {
      // The middle box of each row is a gold double box (two items).
      for (const p of ITEMS.rows) for (const off of ITEMS.offsets) this.boxes.push({ ...pointAt(this.track, p, off), backAt: 0, double: off === 0 });
    }
    this.bananas = [];
    this.webs = [];
    this.oils = [];
    this.shots = []; // Bouncers, Seekers and Bombs (see kart-items.js)
    this.blasts = []; // bombs that just went off (for the screens)
    // Coins, one at a time round the lap.
    this.coins = this.track.coins.map(([p, off]) => ({ ...pointAt(this.track, p, off), backAt: 0 }));
    // Side by side just past the start line, facing along the track. The controls carry over
    // (phones and controllers only send changes: GAS held through to the next race stays held).
    const before = this.karts;
    this.karts = [0, 1].map((slot) => {
      const p = pointAt(this.track, 0.012, slot === 0 ? -0.75 : 0.75);
      const was = before ? before[slot] : null;
      const pick = this.picks[slot];
      return {
        racer: pick.racer,
        tyre: pick.tyre,
        car: Racers.physics(pick.racer, pick.tyre), // this racer's driving numbers
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: 0, // negative: reversing
        steer: was ? was.steer : 0,
        gas: was ? was.gas : false,
        brake: was ? was.brake : false,
        drift: was ? was.drift : false, // holding the drift button
        drifting: false,
        driftMs: 0,
        coins: 0,
        lapStart: 0, // when this lap began (race time)
        prevLapStart: 0, // …and the one before (reversing back over the line goes back to it)
        lastLap: null,
        bestLap: null,
        laps: 0,
        progress: 0.012,
        seg: Math.round(0.012 * SAMPLES), // the centre-line sample it is nearest (see near())
        halfway: false,
        boostUntil: 0,
        offTrack: false,
        cutAt: -Infinity,
        items: [], // held items, oldest (used next) first; see kart-items.js
        shieldUntil: 0,
        goldUntil: 0,
        starUntil: 0,
        magnetUntil: 0,
        hoverUntil: 0,
        shrinkUntil: 0,
        freezeUntil: 0,
        webUntil: 0,
        oilUntil: 0,
        spinUntil: 0,
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
      this.karts.forEach((k) => this.coinCheck(k, now));
      stepShots(this, dt, now);
      this.karts.forEach((k, slot) => this.itemCheck(k, slot, now));
      this.karts.forEach((k, slot) => hazardCheck(this, k, slot, now));
      this.karts.forEach((k, slot) => this.lapCheck(k, slot, now));
      if (this.phase === 'finish' && now >= this.phaseEnds) this.endRace();
    }
    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  drive(k, dt, now) {
    const where = this.near(k);
    k.offTrack = where.d > TRACK_WIDTH / 2;
    const boosting = now < k.boostUntil;
    const car = k.car;
    const fx = effects(k, now);
    const bonus = this.coinBonus(k) + fx.topBonus + this.slipstream(k, now);
    const top = (boosting ? car.boostSpeed + bonus : k.offTrack && !fx.noGrass ? car.grassSpeed : car.maxSpeed + bonus) * (now < k.webUntil ? ITEMS.webSlow : 1);
    // Oil: no steering and no brakes for a moment.
    const oiled = now < k.oilUntil;
    const steer = oiled ? 0 : k.steer;
    const brake = !oiled && k.brake;
    const toward = (v, target, rate) => (v > target ? Math.max(target, v - rate * dt) : Math.min(target, v + rate * dt));
    if (k.finishedAt !== null) {
      k.speed = toward(k.speed, 0, KART.brake * 0.4); // coast to a stop after the line
    } else if (now < k.spinUntil) {
      k.speed = toward(k.speed, 0, KART.brake * 1.5); // spinning out: no grip
    } else if (brake && k.speed > 0.05) {
      k.speed = Math.max(0, k.speed - KART.brake * dt);
    } else if (brake) {
      // Stopped and still braking: back up.
      k.speed = Math.max(-KART.reverseSpeed, k.speed - KART.reverseAccel * dt);
    } else if (k.gas) {
      if (k.speed < 0) k.speed = Math.min(0, k.speed + KART.brake * dt); // stop reversing first
      else if (k.speed < top) k.speed = Math.min(top, k.speed + car.accel * dt);
    } else {
      k.speed = toward(k.speed, 0, KART.coast);
    }
    // Over the limit (on grass, or a boost ran out): slow down, quickly on grass.
    if (k.speed > top) k.speed = Math.max(top, k.speed - (k.offTrack ? 12 : KART.coast * 2) * dt);
    this.driftCheck(k, now, dt);
    // Steering: full lock from walking pace up, less when crawling; with a pedal held it always
    // turns some (so a kart nose-first against a wall can turn away). Backwards it turns the
    // other way, like a car.
    if (now >= k.spinUntil) {
      const pedal = k.gas || brake;
      const grip = Math.min(1, Math.max(Math.abs(k.speed) / car.grip, pedal ? 0.45 : 0));
      const dir = k.speed < -0.01 || (Math.abs(k.speed) <= 0.01 && brake) ? -1 : 1;
      const rate = car.turnRate * (k.drifting ? KART.driftTurn : 1) * fx.turnScale;
      k.angle += steer * rate * grip * dir * dt;
    }
    k.x += Math.cos(k.angle) * k.speed * dt;
    k.y += Math.sin(k.angle) * k.speed * dt;
    this.walls(k);
    // Boost pads.
    if (!k.offTrack && k.finishedAt === null) {
      for (const [p, off] of this.track.boosts) {
        const pad = pointAt(this.track, p, off);
        // Forwards only: reversing over a pad doesn't fling you the other way.
        if (k.speed >= 0 && Math.hypot(k.x - pad.x, k.y - pad.y) < 0.9 && now >= k.boostUntil - KART.boostMs + 300) {
          if (now >= k.boostUntil) this.events.boosts++;
          k.boostUntil = now + KART.boostMs;
          k.speed = Math.max(k.speed, k.car.boostSpeed + this.coinBonus(k));
        }
      }
    }
  }

  /**
   * Drifting: hold DRIFT and steer through a bend at speed to turn tighter, scrubbing a little
   * speed. Let go after a long enough drift for a mini-boost.
   */
  driftCheck(k, now, dt) {
    const can = k.drift && k.steer !== 0 && k.speed > KART.driftMinSpeed && now >= k.spinUntil && now >= k.oilUntil && k.finishedAt === null;
    if (can) {
      k.drifting = true;
      k.driftMs += dt * 1000;
      k.speed = Math.max(0, k.speed - KART.driftDrag * dt);
      return;
    }
    if (k.drifting && k.driftMs >= KART.driftChargeMs && !k.drift && now >= k.spinUntil && k.finishedAt === null) {
      k.boostUntil = Math.max(k.boostUntil, now + KART.miniBoostMs);
      k.speed = Math.max(k.speed, k.car.maxSpeed + this.coinBonus(k) + 1.5);
      this.events.miniBoosts++;
    }
    k.drifting = false;
    k.driftMs = 0;
  }

  /**
   * Where a kart is on the road: along its own stretch only (see Road.locateNear), so a stretch
   * running close by never claims it. Remembers the stretch for next time.
   */
  near(k) {
    const w = Road.locateNear(this.track, k.x, k.y, k.seg, NEAR_SPAN, TRACK_WIDTH / 2 + WALL.out + 1);
    k.seg = w.i;
    return w;
  }

  /**
   * The barriers either side of the road (see Road.barriers) and the edge of the field. A
   * glancing hit turns the kart along the wall and slides it on, a little slower; a head-on hit
   * bounces it back.
   */
  walls(k) {
    this.near(k); // the kart's stretch of road, for its middle and both ends
    // Its middle, then circles at the nose and tail ends of its spine (see KART): whichever is
    // over the barrier pushes the whole kart back in.
    // One hit a tick, however many of them touched (or a slide would slow it twice over).
    let hit = null;
    for (const end of [0, 1, -1]) hit = this.wallAt(k, end * KART.reach) || hit;
    if (hit) this.hit(k, hit[0], hit[1]);
  }

  /**
   * Keep the circle `along` ahead of kart k's middle inside the barrier and the field. Gives the
   * wall's outward normal if it pushed the kart back in.
   */
  wallAt(k, along) {
    const r = KART.r;
    const ox = Math.cos(k.angle) * along;
    const oy = Math.sin(k.angle) * along;
    const x = k.x + ox;
    const y = k.y + oy;
    const w = Road.locateNear(this.track, x, y, k.seg, NEAR_SPAN, TRACK_WIDTH / 2 + WALL.out + 1);
    // Which side of the road it is on, and how far out that side's barrier is here.
    const line = this.track.line;
    const a = line[w.i];
    const b = line[(w.i + 1) % line.length];
    const right = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) > 0;
    const edge = this.track.edge[right ? 'right' : 'left'];
    const limit = Math.min(edge[w.i], edge[(w.i + 1) % line.length]) - r;
    let hit = null;
    if (w.d > limit) {
      const nx = (x - w.px) / w.d;
      const ny = (y - w.py) / w.d;
      k.x = w.px + nx * limit - ox;
      k.y = w.py + ny * limit - oy;
      hit = [nx, ny];
    }
    // The edge of the field, in case a track runs close to it.
    if (k.x + ox < r) { k.x = r - ox; hit = [-1, 0]; }
    if (k.x + ox > FIELD.w - r) { k.x = FIELD.w - r - ox; hit = [1, 0]; }
    if (k.y + oy < r) { k.y = r - oy; hit = [0, -1]; }
    if (k.y + oy > FIELD.h - r) { k.y = FIELD.h - r - oy; hit = [0, 1]; }
    return hit;
  }

  /** A wall with outward normal (nx, ny) was hit. */
  hit(k, nx, ny) {
    const dir = Math.sign(k.speed) || 1;
    const mx = Math.cos(k.angle) * dir; // the way the kart is moving
    const my = Math.sin(k.angle) * dir;
    const into = mx * nx + my * ny; // 1: straight at the wall
    if (into <= 0) return; // already moving away
    this.events.walls++;
    if (into > WALL.headOn) {
      const hard = Math.abs(k.speed) >= COINS.wallHitSpeed;
      k.speed = -k.speed * WALL.bounce; // bounce back off it
      const now = this.ctx.now();
      if (hard && now >= (k.wallLossAt || 0) + COINS.wallLossMs) {
        k.wallLossAt = now;
        this.loseCoins(k, COINS.wallLoss);
      }
      k.drifting = false;
      return;
    }
    // Glancing: turn along the wall (whichever way the kart was going) and lose a bit of speed.
    let tx = -ny;
    let ty = nx;
    if (tx * mx + ty * my < 0) { tx = -tx; ty = -ty; }
    const along = Math.atan2(ty * dir, tx * dir);
    let diff = along - k.angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    k.angle += diff * 0.6;
    k.speed *= 1 - 0.45 * into;
  }

  /** ? boxes (a Magnet reaches further) and bananas. */
  itemCheck(k, slot, now) {
    if (k.finishedAt !== null) return;
    const magnet = now < k.magnetUntil;
    for (const box of this.boxes) {
      const room = ITEMS.maxHeld - k.items.length;
      const far = magnet ? Math.hypot(k.x - box.x, k.y - box.y) > ITEMS.magnetR : touch(k, box.x, box.y) > ITEMS.boxR + KART.r;
      if (now < box.backAt || room <= 0 || far) continue;
      box.backAt = now + ITEMS.respawnMs;
      for (let n = Math.min(box.double ? 2 : 1, room); n > 0; n--) k.items.push(this.rollItem(slot));
      this.events.items++;
    }
    const fx = effects(k, now);
    for (const b of this.bananas.slice()) {
      if (fx.floating) break; // hovering: they pass underneath
      if (touch(k, b.x, b.y) > ITEMS.bananaR + KART.r) continue;
      if (b.owner === slot && now < b.safeUntil) continue; // just dropped it
      this.bananas.splice(this.bananas.indexOf(b), 1);
      this.hitKart(k, now);
    }
  }

  /**
   * Something hit the kart (a banana, a Star's ram): it spins out and drops coins, unless it has
   * a Star (nothing touches it) or a shield (which takes the hit and pops). True if it spun.
   */
  hitKart(k, now) {
    // Already spinning, a Star, or just saved by a shield: nothing more happens (a Star pressed
    // against you would otherwise hit you every tick).
    if (effects(k, now).immune || now < k.spinUntil || now < (k.graceUntil || 0)) return false;
    if (now < k.shieldUntil) {
      k.shieldUntil = 0;
      k.graceUntil = now + ITEMS.graceMs;
      this.events.blocked++;
      return false;
    }
    k.spinUntil = now + ITEMS.spinMs;
    k.boostUntil = 0;
    this.events.spins++;
    this.loseCoins(k, COINS.spinLoss);
    return true;
  }

  /** A random item for this slot, by its place (see kart-items.js). */
  rollItem(slot) {
    return rollItem(this, slot);
  }

  /** With a Magnet, close behind the rival: their slipstream pulls you along. */
  slipstream(k, now) {
    if (now >= k.magnetUntil) return 0;
    const rival = this.karts.find((o) => o !== k);
    const dx = rival.x - k.x;
    const dy = rival.y - k.y;
    const ahead = dx * Math.cos(k.angle) + dy * Math.sin(k.angle) > 0;
    return ahead && Math.hypot(dx, dy) < ITEMS.slipR ? ITEMS.slipSpeed : 0;
  }

  /** Half a kart's length: how far behind it things are dropped, and ahead of it shots start. */
  get kartHalf() {
    return KART.reach + KART.r;
  }

  /** How far (x, y) is from kart k's edge (negative: inside it). */
  gap(k, x, y) {
    return touch(k, x, y) - KART.r;
  }

  get roadHalf() {
    return TRACK_WIDTH / 2;
  }

  get field() {
    return FIELD;
  }

  /** How much faster a kart's coins make it. */
  coinBonus(k) {
    return k.coins * COINS.perCoin;
  }

  /** Pick up any coins the kart is touching (if it has room; a Magnet reaches further). */
  coinCheck(k, now) {
    if (k.finishedAt !== null) return; // over the line: leave them for the kart still racing
    const magnet = now < k.magnetUntil;
    for (const c of this.coins) {
      if (k.coins >= COINS.max) return;
      const far = magnet ? Math.hypot(k.x - c.x, k.y - c.y) > ITEMS.magnetR : touch(k, c.x, c.y) > COINS.r + KART.r;
      if (now < c.backAt || far) continue;
      c.backAt = now + COINS.respawnMs;
      k.coins++;
      this.events.coins++;
    }
  }

  addCoins(k, n) {
    const added = Math.min(COINS.max - k.coins, n);
    k.coins += added;
    this.events.coins += added;
  }

  loseCoins(k, n) {
    const lost = Math.min(k.coins, n);
    if (!lost) return;
    k.coins -= lost;
    this.events.coinsLost += lost;
  }

  useItem(slot) {
    useItem(this, slot, this.ctx.now());
  }

  /** The karts bump off each other. */
  bump() {
    const [a, b] = this.karts;
    // Where the two capsules come closest; they push apart along that line.
    const [ax, ay, bx, by, d] = spinesClosest(a, b);
    const min = KART.r * 2;
    if (d >= min) return;
    // Apart along the closest points; crossing (or on top of each other): along the middles, or
    // sideways if even those meet.
    const mid = Math.hypot(b.x - a.x, b.y - a.y);
    let nx = d ? (bx - ax) / d : mid ? (b.x - a.x) / mid : -Math.sin(a.angle);
    let ny = d ? (by - ay) / d : mid ? (b.y - a.y) / mid : Math.cos(a.angle);
    // The heavier kart gives way less: each moves by the other's share of the total weight.
    const overlap = min - d;
    const now = this.ctx.now();
    const wa = Math.max(0.1, a.car.weight + effects(a, now).weightBonus);
    const wb = Math.max(0.1, b.car.weight + effects(b, now).weightBonus);
    const pushA = (overlap * wb) / (wa + wb);
    const pushB = (overlap * wa) / (wa + wb);
    a.x -= nx * pushA;
    a.y -= ny * pushA;
    b.x += nx * pushB;
    b.y += ny * pushB;
    a.speed *= 0.85;
    b.speed *= 0.85;
    this.events.bumps++;
    // A Star rams the other kart into a spin (two Stars just bounce).
    const starA = effects(a, now).star;
    const starB = effects(b, now).star;
    const rammed = starA ? b : a;
    if (starA !== starB && rammed.finishedAt === null && this.hitKart(rammed, now)) this.events.starHits++;
  }

  /**
   * Count laps: crossing the line forwards after the halfway point is a lap;
   * backwards takes it away. And no shortcuts: progress along the lap only
   * creeps forward a little each tick, so rejoining the road much further on
   * means the kart cut across the grass. It goes back to where it left the
   * road, stopped.
   */
  lapCheck(k, slot, now) {
    const where = this.near(k);
    const p = where.s;
    const was = k.progress;
    const jump = ((p - was + 1.5) % 1) - 0.5; // forwards, across the line or not
    if (jump > CUT_JUMP) {
      // Out on the grass the nearest bit of road can be a later stretch: hold
      // the progress until the kart is back on the tarmac, and only if it
      // rejoins further on is it a shortcut.
      if (where.d > TRACK_WIDTH / 2) return;
      const back = pointAt(this.track, was);
      Object.assign(k, { x: back.x, y: back.y, angle: back.angle, speed: 0, cutAt: now, seg: Math.round(was * SAMPLES) % SAMPLES });
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
        const t = now - this.raceStart;
        k.lastLap = t - k.lapStart;
        k.bestLap = k.bestLap === null ? k.lastLap : Math.min(k.bestLap, k.lastLap);
        k.prevLapStart = k.lapStart;
        k.lapStart = t;
        if (k.laps >= this.settings.laps) this.finishLine(slot, now);
      }
    } else if (was < 0.25 && p > 0.75 && k.laps > 0) {
      k.laps--;
      k.halfway = true;
      k.lapStart = k.prevLapStart; // still on that lap: no 2-second "best lap" when you cross again
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

  /** A player picks their racer or tyres (setup and end screens only); unknown ids are ignored. */
  pick(slot, input) {
    const known = input.type === 'racer' ? Racers.RACERS : Racers.TYRES;
    // A racer's old name (a phone may still remember it) picks them by their new one.
    const renamed = input.type === 'racer' && typeof input.id === 'string' && Object.hasOwn(Racers.RENAMED, input.id);
    const id = renamed ? Racers.RENAMED[input.id] : input.id;
    if (!known.some((x) => x.id === id)) return;
    this.picks[slot] = { ...this.picks[slot], [input.type]: id };
    this.ctx.update();
  }

  onInput(slot, input) {
    if ((this.phase === 'setup' || this.phase === 'over') && (input.type === 'racer' || input.type === 'tyre')) {
      this.pick(slot, input);
      return;
    }
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
      // The whole driving state: steering, and which pedals / buttons are held.
      const k = this.karts[slot];
      const steer = Number(input.steer);
      k.steer = Number.isFinite(steer) ? Math.max(-1, Math.min(1, steer)) : 0;
      k.gas = Boolean(input.gas);
      k.brake = Boolean(input.brake);
      k.drift = Boolean(input.drift);
    }
    if (input.type === 'item') this.useItem(slot);
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
      trackPoints: this.phase === 'setup' ? TRACKS.map((t) => t.points) : null, // for the previews
      kartR: KART.r,
      wallOut: WALL.out,
      maxSpeed: KART.maxSpeed,
      boostSpeed: KART.boostSpeed,
      picks: this.picks,
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
            racer: k.racer,
            tyre: k.tyre,
            coins: k.coins,
            top: k.car.maxSpeed + k.coins * COINS.perCoin, // this kart's top speed (its speedometer's red line)
            drifting: k.drifting,
            driftCharge: k.drifting ? Math.min(1, k.driftMs / KART.driftChargeMs) : 0,
            lapMs: this.raceStart && k.finishedAt === null ? Math.max(0, now - this.raceStart - k.lapStart) : null,
            lastLap: k.lastLap,
            bestLap: k.bestLap,
            boosting: now < k.boostUntil,
            offTrack: k.offTrack,
            cut: now - k.cutAt < 1500, // "Shortcut!" for a moment
            items: k.items,
            shield: now < k.shieldUntil,
            gold: now < k.goldUntil,
            star: now < k.starUntil,
            magnet: now < k.magnetUntil,
            hover: now < k.hoverUntil,
            shrunk: now < k.shrinkUntil,
            frozen: now < k.freezeUntil,
            webbed: now < k.webUntil,
            oiled: now < k.oilUntil,
            spin: now < k.spinUntil,
            finished: k.finishedAt !== null,
          }))
        : null,
      positions: racing ? this.positions() : null,
      boxes: racing ? this.boxes.filter((b) => now >= b.backAt).map((b) => ({ x: b.x, y: b.y, angle: b.angle, double: b.double })) : [],
      coins: racing ? this.coins.filter((c) => now >= c.backAt).map((c) => ({ x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 })) : [],
      webs: racing ? this.webs.map((h) => ({ x: Math.round(h.x * 100) / 100, y: Math.round(h.y * 100) / 100 })) : [],
      oils: racing ? this.oils.map((h) => ({ x: Math.round(h.x * 100) / 100, y: Math.round(h.y * 100) / 100 })) : [],
      shots: racing ? this.shots.map((s) => ({ kind: s.kind, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, angle: Math.round(s.angle * 100) / 100, fuse: s.kind === 'bomb' ? Math.max(0, s.until - now) : undefined })) : [],
      blasts: racing ? this.blasts.map((b) => ({ x: b.x, y: b.y, age: now - b.at })) : [],
      bananas: racing ? this.bananas.map((b) => ({ x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 })) : [],
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
  tagline: 'Top-down racing: pick one of 12 racers and your tyres, hold GAS, steer, brake for the bends (hold it to reverse), drift for a mini-boost, collect coins to go faster, use items (hold up to 3), hit the boost pads and bump your rival off the line. Six tracks.',
  create: (ctx) => new KartRace(ctx),
};
