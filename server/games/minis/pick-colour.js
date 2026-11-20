// PICK THE COLOUR! A colour's name written in another colour's ink: pick the ink, not the word.
import { verdicts, pick, shuffle } from './common.js';

/** The colours (their ink on the TV is the colour itself). */
export const COLOURS = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#facc15', purple: '#a855f7', orange: '#f97316' };

export default {
  id: 'pick-colour', kind: 'micro', name: 'Pick the colour!', order: 'PICK THE COLOUR!', howTo: 'Pick the colour of the ink, not the word', durationMs: 4000,
  create(api) {
    const v = verdicts(api);
    const names = Object.keys(COLOURS);
    const ink = pick(api.rng, names);
    const word = pick(api.rng, names.filter((n) => n !== ink)); // (never the same: that'd be no trick)
    // The ink, the word's own colour (the trap), and two more.
    const choices = shuffle(api.rng, [ink, word, ...shuffle(api.rng, names.filter((n) => n !== ink && n !== word)).slice(0, 2)]);
    const picks = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pick' || !v.open(slot) || !choices.includes(input.c)) return;
        picks[slot] = input.c;
        v.decide(slot, input.c === ink);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ word, ink, choices, picks, res: v.res }),
    };
  },
};
