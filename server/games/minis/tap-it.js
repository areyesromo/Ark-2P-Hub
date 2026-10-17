// TAP IT! A target drifts around; tap it once (controllers: move a cursor, A).
import { verdicts } from './common.js';
import { plausibleT } from './runner.js';

export const TARGET_R = 0.12;

/** Where the target is (0..1 each way) `ms` into the micro. Copied in public/games/minis/tap-it.js. */
export function targetAt(ms, seed) {
  const a = (seed % 628) / 100;
  return { x: 0.5 + 0.35 * Math.sin(ms / 700 + a), y: 0.5 + 0.35 * Math.sin(ms / 530 + a * 1.7) };
}

export default {
  id: 'tap-it', kind: 'micro', name: 'Tap it!', order: 'TAP IT!', howTo: 'Tap the moving target', durationMs: 4000,
  create(api) {
    const v = verdicts(api);
    const seed = Math.floor(api.rng() * 1e6);
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'tap' || !v.open(slot) || typeof input.x !== 'number' || typeof input.y !== 'number') return;
        const p = targetAt(plausibleT(input.t, api.elapsed()), seed);
        if (Math.hypot(input.x - p.x, input.y - p.y) <= TARGET_R) v.decide(slot, true);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ seed, r: TARGET_R, res: v.res }),
    };
  },
};
