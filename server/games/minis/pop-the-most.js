// Pop the Most: balloons float up the TV, in each player's colour, plus gold ones and spiky grey
// ones. Steer your crosshair and POP: your colour +1, gold +3 (race for it), spiky -2, and your
// rival's colour scores nothing but takes it away from them. Most points wins.
export const TICK_MS = 50;
export const SPAWN_MS = 420;
export const RISE = [0.16, 0.26]; // field heights per second
// The field is twice as wide as tall (the TV keeps that shape): x runs 0-1 across, y 0-1 down, so a
// step across is ASPECT times longer on screen. Distances and speeds are in field heights.
export const ASPECT = 2;
export const CURSOR_SPEED = 0.85; // field heights per second, in any direction
export const GRAB_R = 0.15; // field heights: the crosshair ring's radius on the TV
export const COOLDOWN_MS = 200;
export const POINTS = { own: 1, gold: 3, spike: -2, theirs: 0 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 1000) / 1000;

export default {
  id: 'pop-the-most', kind: 'party', look: '2d', name: 'Pop the Most', order: 'POP YOUR BALLOONS!', howTo: 'Steer (joystick / stick) and POP (A) your colour and the gold ones', durationMs: 30000,
  create(api) {
    const cursors = [{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }].map((c) => ({ ...c, vx: 0, vy: 0, lastPop: -Infinity }));
    const points = [0, 0];
    let balloons = []; // { id, x, y, rise, who: 0 | 1 | 'gold' | 'spike' }
    let pops = []; // recent pops, for the TV: { id, x, y, who, by, at }
    let nextId = 1;

    function add(b) {
      const balloon = { id: nextId++, rise: RISE[0], ...b };
      balloons.push(balloon);
      return balloon.id;
    }
    function spawn() {
      const r = api.rng();
      const who = r < 0.4 ? 0 : r < 0.8 ? 1 : r < 0.89 ? 'gold' : 'spike';
      add({ x: round(0.06 + api.rng() * 0.88), y: 1.08, rise: RISE[0] + api.rng() * (RISE[1] - RISE[0]), who });
      api.setTimeout(spawn, SPAWN_MS);
    }
    function tick() {
      const dt = TICK_MS / 1000;
      cursors.forEach((c) => {
        c.x = clamp(c.x + (c.vx * CURSOR_SPEED * dt) / ASPECT, 0, 1);
        c.y = clamp(c.y + c.vy * CURSOR_SPEED * dt, 0, 1);
      });
      balloons.forEach((b) => { b.y -= b.rise * dt; });
      balloons = balloons.filter((b) => b.y > -0.08);
      pops = pops.filter((p) => api.now() - p.at < 600);
      api.update();
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() {
        api.setTimeout(spawn, 300);
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if (slot !== 0 && slot !== 1) return;
        const c = cursors[slot];
        if (input.type === 'move') {
          let { x, y } = input;
          if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
          const d = Math.hypot(x, y);
          if (d > 1) {
            x /= d;
            y /= d;
          }
          c.vx = x;
          c.vy = y;
        } else if (input.type === 'pop') {
          const now = api.now();
          if (now - c.lastPop < COOLDOWN_MS) return;
          c.lastPop = now;
          // The nearest balloon under the crosshair.
          let best = null;
          for (const b of balloons) {
            const d = Math.hypot((b.x - c.x) * ASPECT, b.y - c.y);
            if (d <= GRAB_R && (!best || d < best.d)) best = { b, d };
          }
          if (!best) return;
          const { b } = best;
          const kind = b.who === slot ? 'own' : b.who === 'gold' ? 'gold' : b.who === 'spike' ? 'spike' : 'theirs';
          points[slot] += POINTS[kind];
          balloons = balloons.filter((o) => o !== b);
          pops.push({ id: b.id, x: round(b.x), y: round(b.y), who: b.who, by: slot, at: now });
          api.update();
        }
      },
      /** Tests only: put a balloon down (it floats like the rest). Gives its id. */
      debugBalloon: (b) => add(b),
      onTimeUp: () => api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 }),
      view: () => ({
        cursors: cursors.map((c) => ({ x: round(c.x), y: round(c.y) })),
        balloons: balloons.map((b) => ({ id: b.id, x: round(b.x), y: round(b.y), who: b.who })),
        pops: pops.map((p) => ({ id: p.id, x: p.x, y: p.y, who: p.who, by: p.by })),
        points,
      }),
    };
  },
};
