// STOP IT! A needle sweeps back and forth; stop it in the green zone.
import { verdicts } from './common.js';
import { plausibleT } from './runner.js';

/** The needle (0..1) `ms` in, sweeping there and back every periodMs. Copied in public/games/minis/stop-it.js. */
export function needleAt(ms, periodMs) {
  const p = (ms % periodMs) / periodMs;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

export default {
  id: 'stop-it', kind: 'micro', name: 'Stop it!', order: 'STOP IT!', howTo: 'Stop the needle in the green', durationMs: 3500,
  create(api) {
    const v = verdicts(api);
    const from = Math.round((0.1 + api.rng() * 0.62) * 1000) / 1000;
    const zone = { from, to: Math.round((from + 0.18) * 1000) / 1000 };
    const periodMs = Math.round(1400 * api.speed);
    const stops = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'stop' || !v.open(slot)) return;
        const at = needleAt(plausibleT(input.t, api.elapsed()), periodMs);
        stops[slot] = at;
        v.decide(slot, at >= zone.from && at <= zone.to);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ zone, periodMs, stops, res: v.res }),
    };
  },
};
