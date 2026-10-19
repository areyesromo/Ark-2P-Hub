// Ice Rink Sumo (3D on the TV): two pucks on a round rink of ice. Steer to build up speed
// (there's very little grip) and bump your rival off the edge. Off the ice loses at once;
// at the end of time, whoever is nearer the middle wins.
export const RINK_R = 5;
export const PUCK = { r: 0.55, accel: 6, drag: 0.5, maxSpeed: 6 };
export const BOUNCE = 0.9; // a solid bump: the hitter keeps a little speed
export const BUMP_SPEED = 1; // closing speed that counts as a bump (and plays a sound), not a shove
export const TICK_MS = 50;
const DURATION_MS = 30000;

export default {
  id: 'ice-sumo', kind: 'party', look: '3d', name: 'Ice Rink Sumo', order: 'BUMP!', howTo: 'Steer (joystick / stick) on the slippery ice and bump your rival off', durationMs: DURATION_MS,
  create(api) {
    const pucks = [{ x: -2.4, y: 0 }, { x: 2.4, y: 0 }].map((p) => ({ ...p, vx: 0, vy: 0 }));
    const steer = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    let bumps = 0;
    let over = false;

    function collide() {
      const [a, b] = pucks;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = PUCK.r * 2;
      if (dist >= min || dist === 0) return;
      const nx = dx / dist;
      const ny = dy / dist;
      const push = (min - dist) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing <= 0) return;
      const j = ((1 + BOUNCE) * closing) / 2;
      a.vx -= j * nx;
      a.vy -= j * ny;
      b.vx += j * nx;
      b.vy += j * ny;
      if (closing > BUMP_SPEED) bumps++;
    }

    function tick() {
      if (over) return;
      const dt = TICK_MS / 1000;
      pucks.forEach((p, i) => {
        p.vx += steer[i].x * PUCK.accel * dt;
        p.vy += steer[i].y * PUCK.accel * dt;
        const keep = Math.max(0, 1 - PUCK.drag * dt);
        p.vx *= keep;
        p.vy *= keep;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > PUCK.maxSpeed) {
          p.vx *= PUCK.maxSpeed / speed;
          p.vy *= PUCK.maxSpeed / speed;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
      collide();
      const out = pucks.map((p) => Math.hypot(p.x, p.y) > RINK_R);
      if (out[0] || out[1]) {
        over = true;
        api.update();
        return api.end({ winner: out[0] && out[1] ? null : out[0] ? 1 : 0 });
      }
      api.update();
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() { api.setTimeout(tick, TICK_MS); },
      onInput(slot, input) {
        if (input.type !== 'move' || (slot !== 0 && slot !== 1)) return;
        let { x, y } = input;
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const d = Math.hypot(x, y);
        if (d > 1) { x /= d; y /= d; }
        steer[slot] = { x, y };
      },
      /** Tests only: place a puck. */
      debugPlace: (slot, p) => Object.assign(pucks[slot], p),
      onTimeUp: () => {
        over = true;
        const [a, b] = pucks.map((p) => Math.hypot(p.x, p.y));
        api.end({ winner: a === b ? null : a < b ? 0 : 1 });
      },
      view: () => ({
        rink: RINK_R,
        r: PUCK.r,
        pucks: pucks.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, vx: Math.round(p.vx * 10) / 10, vy: Math.round(p.vy * 10) / 10 })),
        bumps,
      }),
    };
  },
};
