// CATCH IT! A claw carries a present back and forth over your basket: let go when it's above it.
import { verdicts } from './common.js';
import { plausibleT, lagFor } from './runner.js';
import { needleAt } from './stop-it.js';

/** Where the claw is (0..1 across) `t` ms in: there and back every periodMs, starting at `phase`. */
export function clawAt(t, periodMs, phase) {
  return needleAt(t + phase * periodMs, periodMs);
}

/** Half the basket's width (across 0..1): a drop this close to its middle lands in it. */
export const BASKET = 0.09;

export default {
  id: 'catch-it', kind: 'micro', name: 'Catch it!', order: 'CATCH IT!', howTo: 'Let go when the present is over your basket', durationMs: 4500,
  create(api) {
    const v = verdicts(api);
    const periodMs = Math.round(1700 * api.speed);
    const phase = Math.round(api.rng() * 1000) / 1000;
    const basket = Math.round((0.15 + api.rng() * 0.7) * 1000) / 1000;
    const drops = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'drop' || !v.open(slot)) return;
        const at = plausibleT(input.t, api.elapsed()) - (typeof input.t === 'number' ? 0 : lagFor(api.players[slot]));
        const x = clawAt(at, periodMs, phase);
        drops[slot] = Math.round(x * 1000) / 1000;
        v.decide(slot, Math.abs(x - basket) <= BASKET);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ periodMs, phase, basket, drops, res: v.res }),
    };
  },
};
