// ODD ONE OUT! Nine emoji, one is different: pick it (first pick counts).
import { verdicts, pick } from './common.js';

const PAIRS = [['🍎', '🍅'], ['🐶', '🐱'], ['😀', '😃'], ['🌕', '🌝'], ['🚗', '🚙'], ['🍩', '🍪'], ['⭐', '🌟'], ['🐟', '🐠'], ['🙂', '🙃'], ['🍋', '🍌'], ['🐻', '🐼'], ['⚽', '🏀']];

export default {
  id: 'odd-one', kind: 'micro', name: 'Odd one out!', order: 'ODD ONE OUT!', howTo: 'Pick the one that is different', durationMs: 4000,
  create(api) {
    const v = verdicts(api);
    let [same, odd] = pick(api.rng, PAIRS);
    if (api.rng() < 0.5) [same, odd] = [odd, same];
    const at = Math.floor(api.rng() * 9);
    const cells = Array.from({ length: 9 }, (_, i) => (i === at ? odd : same));
    const picks = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pick' || !v.open(slot) || !Number.isInteger(input.i) || input.i < 0 || input.i > 8) return;
        picks[slot] = input.i;
        v.decide(slot, input.i === at);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ cells, picks, res: v.res }),
    };
  },
};
