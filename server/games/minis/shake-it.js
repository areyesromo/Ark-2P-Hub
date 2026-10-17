// SHAKE IT! Shake the phone (or tap fast, or wiggle a controller's stick).
import { verdicts } from './common.js';

export const NEED = 15;

export default {
  id: 'shake-it', kind: 'micro', name: 'Shake it!', order: 'SHAKE IT!', howTo: 'Shake your phone (or tap fast)', durationMs: 4000,
  create(api) {
    const v = verdicts(api);
    const got = [0, 0];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'shake' || !v.open(slot)) return;
        got[slot]++;
        if (got[slot] >= NEED) v.decide(slot, true);
        else api.update();
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ need: NEED, got, res: v.res }),
    };
  },
};
