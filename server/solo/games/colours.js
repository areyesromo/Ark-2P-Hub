// Colour Trap. A colour's name appears written in a colour: tap the colour of
// the ink, not what the word says (BLUE written in red is red). Your brain
// wants to read the word, which is the trap. 45 seconds; a wrong answer costs
// 3 of them. Score: right answers.

import { TimedQuiz } from './timed-quiz.js';

// The choices always sit in this order (and match a controller's coloured buttons: B red, X blue, A green, Y yellow).
export const INKS = ['red', 'blue', 'green', 'yellow'];

export class ColourTrap extends TimedQuiz {
  constructor(ctx, rng) {
    super(ctx, rng);
    this.seconds = 45;
  }

  question() {
    const pick = () => Math.floor(this.rng() * INKS.length);
    const ink = pick();
    let word = pick();
    // Mostly a mismatch (that's the trap); now and then they agree, so you can't just avoid the word.
    if (this.rng() < 0.8) while (word === ink) word = pick();
    return { word: INKS[word], ink: INKS[ink], options: INKS, answer: ink };
  }
}

export default {
  id: 'colours',
  name: 'Colour Trap',
  tagline: 'Tap the colour of the ink, not the word. RED written in blue is blue!',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new ColourTrap(ctx, ctx.rng),
};
