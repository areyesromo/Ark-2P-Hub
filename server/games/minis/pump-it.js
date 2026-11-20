// PUMP IT! Pump the tyre up to the line, but not past the top of the green: it bursts.
import { verdicts } from './common.js';

export default {
  id: 'pump-it', kind: 'micro', name: 'Pump it!', order: 'PUMP IT!', howTo: 'Pump up to the green, not past it', durationMs: 4500,
  create(api) {
    const v = verdicts(api);
    // The green: two pumps wide, somewhere between 9 and 13 pumps up; past it, it bursts.
    const line = 9 + Math.floor(api.rng() * 5);
    const zone = { from: line, to: line + 1 };
    const top = line + 4; // (the gauge's full height)
    const air = [0, 0];
    const burst = [false, false];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pump' || !v.open(slot)) return;
        air[slot]++;
        if (air[slot] > zone.to) {
          burst[slot] = true;
          return v.decide(slot, false);
        }
        api.update();
      },
      // Time up: in the green passes.
      onTimeUp() {
        for (const slot of [0, 1]) if (v.open(slot)) v.res[slot] = air[slot] >= zone.from;
        v.timeUp();
      },
      view: () => ({ zone, top, air, burst, res: v.res }),
    };
  },
};
