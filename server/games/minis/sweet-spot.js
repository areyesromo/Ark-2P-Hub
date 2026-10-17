// Sweet Spot: your wheel spins through 1-10; stop it three times. Highest
// total wins.
import { plausibleT } from './runner.js';

export const SPINS = 3;
export const STEP_MS = 110;
export const PAUSE_MS = 800;

/** The number showing `ms` into a spin. Copied in public/games/minis/sweet-spot.js. */
export function wheelValue(ms, offset) {
  return 1 + (Math.floor((ms + offset) / STEP_MS) % 10);
}

export default {
  id: 'sweet-spot', kind: 'party', name: 'Sweet Spot', order: 'STOP ON 10!', howTo: 'Stop your wheel (or A) on the biggest number, 3 times', durationMs: 25000,
  create(api) {
    const offset = () => Math.floor(api.rng() * STEP_MS * 10);
    const spins = [[], []];
    const spinStart = [0, 0];
    const offsets = [offset(), offset()];
    const total = (s) => spins[s].reduce((a, b) => a + b, 0);
    const result = () => api.end({ winner: total(0) === total(1) ? null : total(0) > total(1) ? 0 : 1 });
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'stop' || (slot !== 0 && slot !== 1) || spins[slot].length >= SPINS) return;
        const t = plausibleT(input.t, api.elapsed());
        if (t < spinStart[slot]) return; // still in the pause between spins
        spins[slot].push(wheelValue(t - spinStart[slot], offsets[slot]));
        spinStart[slot] = t + PAUSE_MS;
        offsets[slot] = offset();
        if (spins[0].length === SPINS && spins[1].length === SPINS) return result();
        api.update();
      },
      onTimeUp: result,
      view: () => ({ spins, spinStart, offset: offsets, step: STEP_MS }),
    };
  },
};
