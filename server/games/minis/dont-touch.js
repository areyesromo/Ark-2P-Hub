// DON'T TOUCH! Any tap or button press fails; hold still until time's up.
import { verdicts } from './common.js';

export default {
  id: 'dont-touch', kind: 'micro', name: "Don't touch!", order: "DON'T TOUCH!", howTo: 'Hands off! Any tap fails', durationMs: 3000,
  create(api) {
    const v = verdicts(api);
    return {
      start() {},
      onInput(slot) {
        v.decide(slot, false);
      },
      onTimeUp: () => v.timeUp(true),
      view: () => ({ res: v.res }),
    };
  },
};
