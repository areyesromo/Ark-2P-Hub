/**
 * The computer opponent for Dice Party (see `bot` in index.js). It holds dice one at a time (as
 * you would), then rolls or scores. It judges a box by its score against what that box usually
 * gets ("par"), so it won't spend Chance or Five of a kind on a poor roll.
 *   easy:   holds its most common face, rolls all three times, and takes the highest score.
 *   normal: tries every way of holding the dice (a few dozen rolls each) and stops when it's ahead.
 *   hard:   the same with many more trial rolls, and it plays for the top-section bonus.
 */
import { BOXES, ROLLS } from './dice-party.js';

const PAR = { ones: 2, twos: 5, threes: 8, fours: 11, fives: 14, sixes: 17, three: 16, four: 8, house: 14, small: 17, large: 13, yahtzee: 9, chance: 22 };
const TRIALS = { normal: 40, hard: 220 };

export function diceBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'turn' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const pace = 600 + rng() * 700;
  const card = view.cards[view.you];
  const open = BOXES.filter((b) => card[b.id] === undefined);
  if (!open.length) return null;
  if (view.rollsLeft === ROLLS) return { type: 'roll', botDelayMs: pace };
  const dice = view.dice;
  const value = (b, d) => b.score(d) - (level === 'easy' ? 0 : PAR[b.id] * (level === 'hard' && b.upper ? 1.15 : 1));
  const bestBox = (d) => open.reduce((a, b) => (value(b, d) > value(a, d) ? b : a));
  const score = () => ({ type: 'score', box: bestBox(dice).id, botDelayMs: pace });
  if (view.rollsLeft === 0) return score();

  let want;
  if (level === 'easy') {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach((d) => counts[d]++);
    const face = counts.indexOf(Math.max(...counts));
    want = dice.map((d) => d === face);
  } else {
    // Every way of holding the dice, judged by trial rolls of the rest.
    const now = value(bestBox(dice), dice);
    let bestEv = -Infinity;
    for (let mask = 0; mask < 32; mask++) {
      const hold = dice.map((_, i) => Boolean(mask & (1 << i)));
      if (hold.every(Boolean)) continue;
      let total = 0;
      for (let t = 0; t < TRIALS[level]; t++) {
        const d = dice.map((x, i) => (hold[i] ? x : 1 + Math.floor(rng() * 6)));
        const b = bestBox(d);
        total += value(b, d);
      }
      const ev = total / TRIALS[level];
      if (ev > bestEv) { bestEv = ev; want = hold; }
    }
    if (now >= bestEv) return score(); // what it has beats rolling on
  }
  const toggle = want.findIndex((h, i) => h !== view.held[i]);
  if (toggle !== -1) return { type: 'hold', die: toggle, botDelayMs: 350 + rng() * 300 };
  return { type: 'roll', botDelayMs: pace };
}
