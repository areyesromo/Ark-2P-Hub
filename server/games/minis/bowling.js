// Bowling Bash (3D on the TV): tap to set your aim, tap again for power.
// Two rolls each; most pins wins. The pocket (just right of centre) at
// about 85% power is the sweet spot, with a little luck either way.
import { plausibleT } from './runner.js';

export const ROLL_MS = 1500;
export const SWEET = { aim: 0.15, power: 0.85 };

/** Pins in rows of 1-4: x across the lane, z back from the head pin. */
export const PINS = [];
for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) PINS.push({ x: Math.round((i - r / 2) * 0.6 * 100) / 100, z: Math.round(r * 0.52 * 100) / 100 });

/** The aim arrow (-1..1), `ms` into aiming. Copied in public/games/minis/bowling.js. */
export function aimAt(ms) {
  return Math.sin((2 * Math.PI * ms) / 1400);
}
/** The power meter (0..1), `ms` into powering up. Copied in public/games/minis/bowling.js. */
export function powerAt(ms) {
  const p = (ms % 1000) / 1000;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default {
  id: 'bowling', kind: 'party', look: '3d', name: 'Bowling Bash', order: 'BOWL!', howTo: 'Tap (or A) to aim, tap again for power: two rolls', durationMs: 40000,
  create(api) {
    const lanes = [0, 1].map(() => ({ roll: 1, stage: 'aim', since: 0, aim: null, power: null, standing: PINS.map((_, i) => i), knocked: [] }));
    const total = (s) => lanes[s].knocked.reduce((a, b) => a + b, 0);
    const result = () => api.end({ winner: total(0) === total(1) ? null : total(0) > total(1) ? 0 : 1 });

    function knock(lane) {
      const q = clamp01(1 - Math.abs(lane.aim - SWEET.aim) * 1.6) * clamp01(1 - Math.abs(lane.power - SWEET.power) * 1.5);
      const n = lane.standing.length;
      const k = Math.max(0, Math.min(n, Math.round(n * q + (api.rng() - 0.5) * 2)));
      // The pins nearest the ball's line go first.
      const line = lane.aim * 1.2;
      const order = lane.standing.slice().sort((a, b) => Math.abs(PINS[a].x - line) - Math.abs(PINS[b].x - line));
      const down = new Set(order.slice(0, k));
      lane.standing = lane.standing.filter((i) => !down.has(i));
      lane.knocked.push(k);
    }

    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'tap' || (slot !== 0 && slot !== 1)) return;
        const lane = lanes[slot];
        const t = plausibleT(input.t, api.elapsed());
        if (lane.stage === 'aim' && t >= lane.since) {
          lane.aim = Math.round(aimAt(t - lane.since) * 1000) / 1000;
          lane.stage = 'power';
          lane.since = t;
        } else if (lane.stage === 'power' && t >= lane.since) {
          lane.power = Math.round(powerAt(t - lane.since) * 1000) / 1000;
          knock(lane);
          lane.stage = 'rolling';
          lane.since = t;
          api.setTimeout(() => {
            if (lane.roll === 1) {
              lane.roll = 2;
              lane.stage = 'aim';
              lane.since = api.elapsed();
              lane.aim = lane.power = null;
              return api.update();
            }
            lane.stage = 'done';
            if (lanes.every((l) => l.stage === 'done')) return result();
            api.update();
          }, ROLL_MS);
        } else return;
        api.update();
      },
      onTimeUp: result,
      view: () => ({ lanes, pins: PINS }),
    };
  },
};
