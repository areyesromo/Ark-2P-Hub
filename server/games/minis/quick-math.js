// QUICK MATH! A sum on screen: pick the answer.
import { verdicts, pick, choicesFor } from './common.js';

export default {
  id: 'quick-math', kind: 'micro', name: 'Quick math!', order: 'QUICK MATH!', howTo: 'Pick the right answer', durationMs: 4500,
  create(api) {
    const v = verdicts(api);
    const r = () => 2 + Math.floor(api.rng() * 11); // 2..12
    let a = r();
    let b = r();
    const op = pick(api.rng, ['+', '−', '×']);
    if (op === '−' && b > a) [a, b] = [b, a];
    const answer = op === '+' ? a + b : op === '−' ? a - b : a * b;
    const choices = choicesFor(api.rng, answer, op === '×' ? 10 : 4);
    const picks = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pick' || !v.open(slot) || !choices.includes(input.n)) return;
        picks[slot] = input.n;
        v.decide(slot, input.n === answer);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ q: `${a} ${op} ${b}`, choices, picks, res: v.res }),
    };
  },
};
