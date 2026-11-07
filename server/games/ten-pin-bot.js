/**
 * The computer opponent for Bowling (see `bot` in index.js). It bowls the way a decent league
 * player does: on a full rack it stands right of the middle and curves the ball back into the
 * pocket; for a spare it stands across from what's left and rolls straight at it. It picks its
 * line by trying throws out (the same roll the game uses), then its hand isn't perfect:
 *   easy:   a wide, unsteady hand (often off its line, now and then in the gutter).
 *   normal: near its line.
 *   hard:   right on it.
 */
import { rollBall, LANE } from './ten-pin-roll.js';

const LEVEL = {
  easy: { aim: 0.28, power: 0.15, spin: 0.3, think: 1.3 },
  normal: { aim: 0.11, power: 0.08, spin: 0.15, think: 1 },
  hard: { aim: 0.04, power: 0.04, spin: 0.06, think: 0.8 },
};

/** Fixed luck for trying throws out, so it picks the same line for the same pins. */
function trialRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();
/**
 * Its line at a full rack: from right of the middle, curving back into the pocket (between the
 * head pin and the 3). Worked out once by trying it hundreds of times: it strikes about two
 * times in three when it's thrown just so (the luck is in how the pins fly).
 */
export const POCKET = { stance: 0.25, aim: 0.4, power: 0.75, spin: -0.5 };

/**
 * The best throw it knows at `pins` from `stance` (the full rack: with a curve into the pocket;
 * a spare: straight). Every aim is tried a few times; the one picked is the best with its
 * neighbours counted in too (a line that still works if the hand slips a little).
 */
export function bestThrow(pins, { stance = 0, bumpers = false } = {}) {
  const full = pins.length === 10;
  if (full && stance === POCKET.stance) return { ...POCKET };
  const key = (full ? 'full' : pins.map((p) => p.i + ':' + p.x.toFixed(2) + ':' + p.z.toFixed(2)).join(',')) + '|' + stance + '|' + bumpers;
  if (cache.has(key)) return cache.get(key);
  const spins = full ? [-0.3, -0.5] : [0];
  const tries = full ? 10 : 5;
  const power = 0.75;
  let best = null;
  for (const spin of spins) {
    const vals = [];
    for (let k = 0; k <= 40; k++) {
      const t = { stance, aim: Math.round((-1 + k * 0.05) * 100) / 100, power, spin };
      let sum = 0;
      for (let s = 0; s < tries; s++) {
        const r = rollBall(t, pins, { rng: trialRng(101 + s), bumpers });
        sum += r.down.length + (r.standing.length === 0 ? 5 : 0); // (all of them is worth a lot more than nearly)
      }
      vals.push({ t, v: sum / tries });
    }
    vals.forEach((c, k) => {
      const near = [vals[k - 1], c, c, vals[k + 1]].filter(Boolean);
      const v = near.reduce((a, b) => a + b.v, 0) / near.length;
      if (!best || v > best.v) best = { t: c.t, v };
    });
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, best.t);
  return best.t;
}

const gauss = (rng) => (rng() + rng() + rng() - 1.5) / 0.5; // (roughly -3..3, mostly near 0)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (n) => Math.round(n * 100) / 100;

export function tenPinBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'aim' || view.turn !== view.you || !Array.isArray(view.standing)) return null;
  const pins = view.standing;
  // Where to stand: right of the middle for a full rack; across from what's left for a spare.
  const mean = pins.reduce((s, p) => s + p.x, 0) / (pins.length || 1);
  const stance = pins.length === 10 ? 0.25 : r2(clamp(-mean * 0.8, -0.3, 0.3));
  const t = bestThrow(pins, { stance, bumpers: view.bumpers });
  return {
    type: 'throw',
    stance: t.stance,
    aim: r2(clamp(t.aim + gauss(rng) * L.aim, -1, 1)),
    power: r2(clamp(t.power + gauss(rng) * L.power, 0, 1)),
    spin: r2(clamp(t.spin + gauss(rng) * L.spin, -1, 1)),
    botDelayMs: (1500 + rng() * 1200) * L.think,
  };
}
