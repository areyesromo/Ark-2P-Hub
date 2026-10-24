// Bumper Cars (3D on the TV): a car each in a round arena with a padded rail. Point the stick
// where you want to go: the car turns that way and drives (it grips, unlike the ice). Ram your
// rival in the side or from behind for a point and they spin out for a moment; a head-on crash
// (into the front of their car) scores nothing. Most points at time up wins.
export const ARENA_R = 6;
export const CAR_R = 0.6;
export const TURN_RATE = 4; // radians a second
export const ACCEL = 9;
export const MAX_SPEED = 5.5;
export const DRAG = 1.5; // forward speed lost a second, as a share
export const GRIP = 8; // sideways slide lost a second, as a share
export const BUMP_SPEED = 1.2; // driving into them at least this fast is a ram
export const FRONT_CONE = (50 * Math.PI) / 180; // hits this close to straight ahead are head-on
export const SPIN_MS = 900;
export const BOUNCE = 0.8;
export const TICK_MS = 50;
const SPIN_RATE = 12; // radians a second while spun out
const DURATION_MS = 30000;

/** The angle from a to b, -π..π. */
const turnTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const r2 = (v) => Math.round(v * 100) / 100;

export default {
  id: 'bumper-cars', kind: 'party', look: '3d', name: 'Bumper Cars', order: 'RAM THEM!', howTo: 'Steer (joystick / stick) and ram your rival in the side or from behind. Head-on doesn\'t count!', durationMs: DURATION_MS,
  create(api) {
    const cars = [{ x: -3, y: 0, h: 0 }, { x: 3, y: 0, h: Math.PI }].map((c) => ({ ...c, vx: 0, vy: 0, spinUntil: -Infinity }));
    const steer = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const points = [0, 0];
    let bump = null; // the latest bump, for the screens: { n, by (the slot that scored, or null) }
    let bumps = 0;
    let done = false;
    let shown = '';

    const spinning = (c, now) => now < c.spinUntil;

    function drive(c, s, dt, now) {
      if (spinning(c, now)) {
        c.h += SPIN_RATE * dt;
      } else {
        const m = Math.min(1, Math.hypot(s.x, s.y));
        if (m > 0.2) {
          const diff = turnTo(c.h, Math.atan2(s.y, s.x));
          c.h += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
          // Turn first, then go: no push while the stick points behind the car.
          const go = ACCEL * m * Math.max(0, Math.cos(diff)) * dt;
          c.vx += Math.cos(c.h) * go;
          c.vy += Math.sin(c.h) * go;
        }
      }
      // Split the speed into forward and sideways: the tyres grip, so sideways dies off fast.
      const fx = Math.cos(c.h);
      const fy = Math.sin(c.h);
      let f = c.vx * fx + c.vy * fy;
      let l = -c.vx * fy + c.vy * fx;
      f *= Math.max(0, 1 - DRAG * dt);
      l *= Math.max(0, 1 - GRIP * dt);
      f = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, f));
      c.vx = f * fx - l * fy;
      c.vy = f * fy + l * fx;
      if (Math.hypot(c.vx, c.vy) < 0.02) c.vx = c.vy = 0;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      // The rail: back inside, bouncing off it.
      const d = Math.hypot(c.x, c.y);
      if (d > ARENA_R - CAR_R) {
        const nx = c.x / d;
        const ny = c.y / d;
        c.x = nx * (ARENA_R - CAR_R);
        c.y = ny * (ARENA_R - CAR_R);
        const out = c.vx * nx + c.vy * ny;
        if (out > 0) {
          c.vx -= 1.5 * out * nx;
          c.vy -= 1.5 * out * ny;
        }
      }
    }

    function collide(now) {
      const [a, b] = cars;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= CAR_R * 2 || dist === 0) return;
      const nx = dx / dist;
      const ny = dy / dist;
      // How fast each was driving into the other: the faster one is doing the ramming.
      const into = [a.vx * nx + a.vy * ny, -(b.vx * nx + b.vy * ny)];
      const push = (CAR_R * 2 - dist) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = into[0] + into[1];
      if (closing <= 0) return;
      const j = ((1 + BOUNCE) * closing) / 2;
      a.vx -= j * nx;
      a.vy -= j * ny;
      b.vx += j * nx;
      b.vy += j * ny;
      const by = into[0] >= into[1] ? 0 : 1;
      if (into[by] < BUMP_SPEED) return;
      const victim = cars[1 - by];
      // Where the hit landed on the victim: straight ahead of it is head-on. A car that's already
      // spinning can't be scored on again (one ram, one point).
      const toHitter = by === 0 ? Math.atan2(-ny, -nx) : Math.atan2(ny, nx);
      const scored = !spinning(victim, now) && Math.abs(turnTo(victim.h, toHitter)) > FRONT_CONE;
      if (scored) {
        points[by]++;
        victim.spinUntil = now + SPIN_MS;
      }
      bump = { n: ++bumps, by: scored ? by : null };
    }

    function view() {
      const now = api.elapsed();
      return {
        arena: ARENA_R, carR: CAR_R,
        cars: cars.map((c) => ({ x: r2(c.x), y: r2(c.y), h: r2(Math.atan2(Math.sin(c.h), Math.cos(c.h))), spinning: spinning(c, now) })),
        points,
        bump,
      };
    }

    function tick() {
      if (done) return;
      const now = api.elapsed();
      const dt = TICK_MS / 1000;
      cars.forEach((c, i) => drive(c, steer[i], dt, now));
      collide(now);
      // Sent only when something moved (cars standing still send nothing).
      const key = JSON.stringify(view());
      if (key !== shown) {
        shown = key;
        api.update();
      }
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() {
        shown = JSON.stringify(view());
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1) || input.type !== 'move') return;
        const { x, y } = input;
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
        steer[slot] = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
      },
      onTimeUp() {
        if (done) return;
        done = true;
        api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 });
      },
      /** Tests only: place a car. */
      debugPlace: (slot, c) => Object.assign(cars[slot], c),
      view,
    };
  },
};
