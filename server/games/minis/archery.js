// Archery (3D on the TV): a target each at the end of the range. Move your sight, DRAW the bow (hold),
// and let go to shoot. The sight wobbles: less once you've held the bow drawn a moment, more again as
// your arms tire. A crosswind pushes every arrow the same way: aim off to allow for it. Three arrows
// each; rings score 10 (the gold) down to 1, off the target 0. The higher total wins.
//
// The wobble is worked out here from the time and how long the bow's been drawn (swayAt), so the
// TV draws the same wobble and the server says where each arrow lands.
import { plausibleT } from './runner.js';

export const ARROWS = 3;
export const AIM_MAX = 1.6; // the sight can go this far from the middle (target radii)
export const WIND_MAX = 0.4;
const END_MS = 400; // after the last arrow, a moment to see it land

/** How far the sight wobbles `drawnMs` after drawing (not drawn: a lot). */
export function wobble(drawnMs) {
  if (!Number.isFinite(drawnMs) || drawnMs < 0) return 0.6;
  if (drawnMs < 1200) return 0.6 - 0.45 * (drawnMs / 1200);
  if (drawnMs < 3500) return 0.15;
  return Math.min(1, 0.15 + ((drawnMs - 3500) / 1000) * 0.15);
}

/** The sight's wobble (x, y) at `t` for a player whose wobble pattern is `seed`, drawn since `drawnAt` (or not). */
export function swayAt(t, seed, drawnAt) {
  const a = wobble(drawnAt === null || drawnAt === undefined ? -1 : t - drawnAt);
  return [a * Math.sin(t / 430 + seed * 1.7), a * 0.8 * Math.sin(t / 610 + seed * 2.3)];
}

/** The ring an arrow at (x, y) scores: 10 in the middle, 1 at the rim, 0 off the target. */
export function ringFor(x, y) {
  const d = Math.hypot(x, y);
  return d > 1 ? 0 : Math.max(1, 10 - Math.floor(d * 10));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r3 = (n) => Math.round(n * 1000) / 1000;

export default {
  id: 'archery', kind: 'party', look: '3d', name: 'Archery', order: 'TAKE AIM!', howTo: 'Aim, hold DRAW to steady the bow, let go to shoot. Mind the wind (controller: stick aims, hold A)', durationMs: 40000,
  create(api) {
    const wind = r3((api.rng() * 2 - 1) * WIND_MAX);
    const seeds = [r3(api.rng() * 10), r3(api.rng() * 10)];
    const aims = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const drawnAt = [null, null];
    const arrows = [[], []];
    let done = false;

    const total = (s) => arrows[s].reduce((a, b) => a + b.ring, 0);
    function finish() {
      if (done) return;
      done = true;
      const [a, b] = [total(0), total(1)];
      api.end({ winner: a === b ? null : a > b ? 0 : 1 });
    }

    return {
      start() {},
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1) || arrows[slot].length >= ARROWS) return;
        if (input.type === 'aim') {
          if (typeof input.x !== 'number' || typeof input.y !== 'number' || !Number.isFinite(input.x) || !Number.isFinite(input.y)) return;
          aims[slot] = { x: r3(clamp(input.x, -AIM_MAX, AIM_MAX)), y: r3(clamp(input.y, -AIM_MAX, AIM_MAX)) };
          return api.update();
        }
        if (input.type === 'draw' && typeof input.on === 'boolean') {
          if (input.on && drawnAt[slot] === null) drawnAt[slot] = plausibleT(input.t, api.elapsed());
          if (!input.on) drawnAt[slot] = null;
          return api.update();
        }
        if (input.type === 'shoot' && drawnAt[slot] !== null) {
          // Where the sight was as you let go, plus the wind.
          const t = Math.max(drawnAt[slot], plausibleT(input.t, api.elapsed()));
          const [sx, sy] = swayAt(t, seeds[slot], drawnAt[slot]);
          const x = r3(aims[slot].x + sx + wind);
          const y = r3(aims[slot].y + sy);
          arrows[slot].push({ x, y, ring: ringFor(x, y) });
          drawnAt[slot] = null;
          if (arrows[0].length >= ARROWS && arrows[1].length >= ARROWS) api.setTimeout(finish, END_MS);
          api.update();
        }
      },
      onTimeUp: finish,
      view: () => ({ wind, seeds, aims, drawnAt, arrows, total: [total(0), total(1)], arrowsEach: ARROWS }),
    };
  },
};
