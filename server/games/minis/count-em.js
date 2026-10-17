// COUNT 'EM! How many sheep? Pick the number.
import { verdicts, choicesFor } from './common.js';

export default {
  id: 'count-em', kind: 'micro', name: "Count 'em!", order: "COUNT 'EM!", howTo: 'How many sheep? Pick the number', durationMs: 4000,
  create(api) {
    const v = verdicts(api);
    const n = 3 + Math.floor(api.rng() * 7);
    const sheep = Array.from({ length: n }, () => ({ x: Math.round((0.1 + api.rng() * 0.8) * 100) / 100, y: Math.round((0.15 + api.rng() * 0.7) * 100) / 100 }));
    const choices = choicesFor(api.rng, n, 3, 1);
    const picks = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pick' || !v.open(slot) || !choices.includes(input.n)) return;
        picks[slot] = input.n;
        v.decide(slot, input.n === n);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ sheep, choices, picks, res: v.res }),
    };
  },
};
