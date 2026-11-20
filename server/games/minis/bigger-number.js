// BIGGER NUMBER! Two numbers at a time: pick the bigger one, three pairs in a row. One wrong fails.
import { verdicts } from './common.js';

export const PAIRS = 3;

export default {
  id: 'bigger-number', kind: 'micro', name: 'Bigger number!', order: 'BIGGER NUMBER!', howTo: 'Pick the bigger number, three times in a row', durationMs: 5000,
  create(api) {
    const v = verdicts(api);
    // Close numbers (a few apart), so it takes a look: 12 vs 17, 63 vs 59.
    const pairs = [];
    for (let i = 0; i < PAIRS; i++) {
      const a = 10 + Math.floor(api.rng() * 85);
      const gap = 1 + Math.floor(api.rng() * 6);
      const b = api.rng() < 0.5 ? a + gap : a - gap;
      pairs.push(api.rng() < 0.5 ? [a, b] : [b, a]);
    }
    const done = [0, 0];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pick' || !v.open(slot) || (input.side !== 0 && input.side !== 1)) return;
        const [a, b] = pairs[done[slot]];
        if ((input.side === 0 ? a : b) < (input.side === 0 ? b : a)) return v.decide(slot, false);
        done[slot]++;
        if (done[slot] === PAIRS) v.decide(slot, true);
        else api.update();
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ pairs, done, res: v.res }),
    };
  },
};
