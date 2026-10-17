// SWIPE IT! Three arrows: swipe (or D-pad) each way in order; one wrong fails.
import { verdicts, pick } from './common.js';

export const DIRS = ['up', 'down', 'left', 'right'];

export default {
  id: 'swipe-it', kind: 'micro', name: 'Swipe it!', order: 'SWIPE IT!', howTo: 'Swipe the way each arrow points', durationMs: 4000,
  create(api) {
    const v = verdicts(api);
    const arrows = [pick(api.rng, DIRS), pick(api.rng, DIRS), pick(api.rng, DIRS)];
    const done = [0, 0];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'swipe' || !v.open(slot) || !DIRS.includes(input.dir)) return;
        if (input.dir !== arrows[done[slot]]) return v.decide(slot, false);
        done[slot]++;
        if (done[slot] === arrows.length) v.decide(slot, true);
        else api.update();
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ arrows, done, res: v.res }),
    };
  },
};
