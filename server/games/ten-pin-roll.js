// Bowling (ten-pin.js): the score card and the roll itself.
//
// The roll is worked out on the server the moment the ball is let go: the ball goes down the
// lane (curving with its spin once it's off the oil), knocks into the pins, and the pins knock
// into each other. The TV plays back the frames it records, so every screen sees the same roll.
//
// Seen from above, in metres: x across the lane (0 in the middle, + to the right as you bowl),
// z down the lane from the foul line. Bodies are circles; a pin that's hit hard enough falls
// and slides, sweeping a wider circle as it tumbles.

export const LANE = {
  hw: 0.53, // half the lane's width (beyond it: the gutter)
  headPin: 18.29, // the head pin's distance from the foul line
  oilEnd: 12, // the oil stops here: past it the spin bites and the ball curves
  pitZ: 19.45, // past the pins: the pit (gone)
  maxStance: 0.42, // where you can stand: the ball's middle at most this far from the middle
};
export const BALL = { r: 0.109, mass: 6.5 };
export const PIN = { r: 0.061, mass: 1.5, fallenR: 0.1 };
export const ROLL = {
  minSpeed: 6, // m/s at no power ...
  maxSpeed: 9.5, // ... and at full power
  maxAngle: 0.045, // radians either side of straight at full aim
  hook: 1.7, // m/s² sideways at full spin, off the oil (a little on it)
  oilHook: 0.15, // the share of the hook on the oil
  decel: 0.35, // the ball slows this much a second
  pinFriction: 5, // a fallen pin slides to a stop
  fallSpeed: 0.6, // a standing pin hit this hard (m/s) goes down; softer, it just wobbles
  scatter: 0.4, // radians of luck in which way a hit pin flies
  restitution: 0.5, // pin on pin
  dt: 1 / 500,
  maxMs: 5500,
  frameMs: 1000 / 30, // the TV gets a picture this often
};

/** The ten pins: rows of 1-4 down the lane, numbered 1-10 as on a score sheet (here 0-9). */
export const PINS = [];
for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) PINS.push({ x: Math.round((k - r / 2) * 0.3048 * 1000) / 1000, z: Math.round((LANE.headPin + r * 0.264) * 1000) / 1000 });

/** A full rack: [{ i, x, z }]. */
export function rackPins() {
  return PINS.map((p, i) => ({ i, x: p.x, z: p.z }));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Roll the ball: throw { stance (-maxStance..maxStance), aim (-1..1), power (0..1), spin (-1..1) }
 * at `pins` ([{ i, x, z }], standing). Options: rng (for the pins' luck), bumpers (no gutters).
 * Gives { down: [i], standing: [{ i, x, z }], gutter, frames: [{ t, b: [x, z], p: [[i, x, z, fall]] }], ms }.
 * In a frame, fall is null for a pin still up, else the way it fell (radians).
 */
export function rollBall(t, pins, { rng = Math.random, bumpers = false } = {}) {
  const speed = ROLL.minSpeed + (ROLL.maxSpeed - ROLL.minSpeed) * clamp(t.power, 0, 1);
  const angle = clamp(t.aim, -1, 1) * ROLL.maxAngle;
  const spin = clamp(t.spin, -1, 1);
  const ball = { x: clamp(t.stance, -LANE.maxStance, LANE.maxStance), z: 0, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, gutter: false, gone: false };
  const ps = pins.map((p) => ({ i: p.i, x: p.x, z: p.z, vx: 0, vz: 0, down: false, fall: null, gone: false }));
  const frames = [];
  let nextFrame = 0;
  let ms = 0;
  const edge = LANE.hw - BALL.r;
  const record = () => {
    frames.push({ t: Math.round(ms), b: [r3(ball.x), r3(ball.z)], p: ps.map((p) => [p.i, r3(p.x), r3(p.z), p.down ? r3(p.fall) : null]) });
  };

  /** Two bodies touching: push apart and swap momentum along the line between them. */
  const collide = (a, ra, ma, b, rb, mb, e) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d >= ra + rb || d === 0) return 0;
    const nx = dx / d;
    const nz = dz / d;
    const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; // closing speed
    // Apart, in proportion to their weights.
    const push = ra + rb - d;
    a.x -= nx * push * (mb / (ma + mb));
    a.z -= nz * push * (mb / (ma + mb));
    b.x += nx * push * (ma / (ma + mb));
    b.z += nz * push * (ma / (ma + mb));
    if (rel <= 0) return 0;
    const j = ((1 + e) * rel) / (1 / ma + 1 / mb);
    a.vx -= (j / ma) * nx;
    a.vz -= (j / ma) * nz;
    b.vx += (j / mb) * nx;
    b.vz += (j / mb) * nz;
    return rel;
  };
  /** A pin set moving by a hit: down if it was hard enough (a little luck in its direction), else it stays. */
  const knock = (p, hit) => {
    if (p.down) return;
    if (hit < ROLL.fallSpeed) {
      p.vx = p.vz = 0;
      return;
    }
    const a = (rng() * 2 - 1) * ROLL.scatter;
    const [vx, vz] = [p.vx * Math.cos(a) - p.vz * Math.sin(a), p.vx * Math.sin(a) + p.vz * Math.cos(a)];
    p.vx = vx;
    p.vz = vz;
    p.down = true;
    p.fall = Math.atan2(vx, vz);
  };

  record();
  while (ms < ROLL.maxMs) {
    const dt = ROLL.dt;
    // The ball: it curves with its spin (mostly once off the oil) and slows a little.
    if (!ball.gone) {
      if (!ball.gutter) {
        const hook = spin * ROLL.hook * (ball.z < LANE.oilEnd ? ROLL.oilHook : 1);
        ball.vx += hook * dt;
      }
      const v = Math.hypot(ball.vx, ball.vz);
      const k = v > 0 ? Math.max(0, v - ROLL.decel * dt) / v : 0;
      ball.vx *= k;
      ball.vz *= k;
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      if (!ball.gutter && Math.abs(ball.x) > edge) {
        if (bumpers) {
          // Off the bumper and back in.
          ball.x = Math.sign(ball.x) * edge;
          ball.vx = -ball.vx * 0.5;
        } else if (Math.abs(ball.x) > LANE.hw) {
          // Into the gutter: it runs down it, past the pins.
          ball.gutter = true;
          ball.x = Math.sign(ball.x) * (LANE.hw + 0.09);
          ball.vx = 0;
        }
      }
      if (ball.z > LANE.pitZ + 0.3) ball.gone = true;
    }
    // The pins.
    for (const p of ps) {
      if (p.gone || !p.down) continue;
      const v = Math.hypot(p.vx, p.vz);
      const k = v > 0 ? Math.max(0, v - ROLL.pinFriction * dt) / v : 0;
      p.vx *= k;
      p.vz *= k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.z > LANE.pitZ || Math.abs(p.x) > LANE.hw + 0.05) p.gone = true; // (off the deck)
    }
    // Who hits whom.
    if (!ball.gone && !ball.gutter) {
      for (const p of ps) {
        if (p.gone) continue;
        const was = p.down;
        const hit = collide(ball, BALL.r, BALL.mass, p, p.down ? PIN.fallenR : PIN.r, PIN.mass, 0.9);
        if (hit && !was) knock(p, Math.hypot(p.vx, p.vz));
      }
    }
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b < ps.length; b++) {
        const p = ps[a];
        const q = ps[b];
        if (p.gone || q.gone || (!p.down && !q.down)) continue; // (two standing pins don't push each other)
        const pw = p.down;
        const qw = q.down;
        // A standing pin is held by the deck: it takes the hit (heavier) until it falls.
        const hit = collide(p, pw ? PIN.fallenR : PIN.r, pw ? PIN.mass : PIN.mass * 3, q, qw ? PIN.fallenR : PIN.r, qw ? PIN.mass : PIN.mass * 3, ROLL.restitution);
        if (!hit) continue;
        if (!pw) knock(p, Math.hypot(p.vx, p.vz) * 3);
        if (!qw) knock(q, Math.hypot(q.vx, q.vz) * 3);
      }
    }
    ms += dt * 1000;
    if (ms >= nextFrame) {
      record();
      nextFrame += ROLL.frameMs;
    }
    // Done once the ball has gone and nothing on the deck is moving.
    const moving = ps.some((p) => !p.gone && p.down && Math.hypot(p.vx, p.vz) > 0.02);
    if ((ball.gone || ball.vz <= 0.05) && !moving) break;
  }
  record();
  return {
    down: ps.filter((p) => p.down).map((p) => p.i),
    standing: ps.filter((p) => !p.down).map((p) => ({ i: p.i, x: r3(p.x), z: r3(p.z) })),
    gutter: ball.gutter,
    frames,
    ms: Math.round(ms),
  };
}

/**
 * A player's score card from the pins each ball knocked down, over `frameCount` frames.
 * Gives { frames: [{ balls, total }], total, done, next: { frame, ball, fresh } }: a frame's
 * total is the running total, null while its bonus balls are still to come; next is the ball
 * to bowl (fresh: a full rack of ten).
 */
export function scoreCard(balls, frameCount = 10) {
  const frames = [];
  let i = 0;
  for (let f = 0; f < frameCount && i < balls.length; f++) {
    const last = f === frameCount - 1;
    if (!last) {
      if (balls[i] === 10) {
        frames.push({ balls: [10], start: i });
        i += 1;
      } else {
        frames.push({ balls: balls.slice(i, i + 2), start: i });
        i += 2;
      }
    } else {
      frames.push({ balls: balls.slice(i, i + 3), start: i });
      i += 3;
    }
  }
  // Running totals.
  let run = 0;
  let open = false;
  for (let f = 0; f < frames.length; f++) {
    const fr = frames[f];
    const last = f === frameCount - 1;
    const [a, b] = fr.balls;
    let need; // balls this frame's score counts
    if (last) need = a === 10 || a + (b || 0) === 10 ? 3 : 2;
    else need = a === 10 ? 3 : a + (b === undefined ? 0 : b) === 10 && b !== undefined ? 3 : 2;
    const counted = balls.slice(fr.start, fr.start + need);
    if (open || counted.length < need) {
      open = true;
      fr.total = null;
    } else {
      run += counted.reduce((s, n) => s + n, 0);
      fr.total = run;
    }
  }
  // The next ball: where it falls on the card.
  let next = null;
  const lastF = frames[frames.length - 1];
  if (!lastF) next = { frame: 0, ball: 0, fresh: true };
  else {
    const f = frames.length - 1;
    const isLast = f === frameCount - 1;
    const bs = lastF.balls;
    if (!isLast) {
      if (bs[0] === 10 || bs.length === 2) next = f + 1 < frameCount ? { frame: f + 1, ball: 0, fresh: true } : null;
      else next = { frame: f, ball: 1, fresh: false };
    } else if (bs.length === 1) next = { frame: f, ball: 1, fresh: bs[0] === 10 };
    else if (bs.length === 2) {
      const bonus = bs[0] === 10 || bs[0] + bs[1] === 10;
      // The third ball: a fresh rack after a strike-strike or a spare, else what's left.
      next = bonus ? { frame: f, ball: 2, fresh: bs[0] === 10 ? bs[1] === 10 : true } : null;
    }
  }
  const done = next === null;
  return { frames: frames.map((fr) => ({ balls: fr.balls, total: fr.total })), total: run, done, next };
}
