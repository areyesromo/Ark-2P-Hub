/**
 * The computer opponent for Rock Paper Scissors (see `bot` in index.js). It only learns what you
 * threw from the reveals (your pick is hidden until then), and keeps it in its memory.
 *   easy:   picks at random.
 *   normal: half the time, beats what you throw most.
 *   hard:   beats what you're likely to throw next: what you throw most, and what you threw
 *           after the same throw before.
 */
import { CHOICES } from './rock-paper-scissors.js';

const BEATEN_BY = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

export function rpsBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !['easy', 'normal', 'hard'].includes(level)) return null;
  const seen = (memory.rps = memory.rps || { rounds: {}, list: [] });
  // A reveal: remember what they threw (once a round).
  if (view.opponentPick && !seen.rounds[view.round]) {
    seen.rounds[view.round] = true;
    seen.list.push(view.opponentPick);
  }
  if (view.phase !== 'choose' || view.yourPick) return null;
  const random = () => CHOICES[Math.floor(rng() * 3)];
  const pace = 900 + rng() * 1800;
  const list = seen.list;
  let choice = random();
  if (list.length && level !== 'easy' && (level === 'hard' || rng() < 0.5)) {
    const weight = { rock: 0, paper: 0, scissors: 0 };
    list.forEach((c, i) => { weight[c] += 1 + i / list.length; }); // later throws count more
    if (level === 'hard' && list.length >= 2) {
      // What did they throw after the throw they just made?
      const lastThrow = list[list.length - 1];
      for (let i = 0; i < list.length - 1; i++) if (list[i] === lastThrow) weight[list[i + 1]] += 2;
    }
    const likely = CHOICES.reduce((a, b) => (weight[b] > weight[a] ? b : a));
    choice = BEATEN_BY[likely];
  }
  return { type: 'pick', choice, botDelayMs: pace };
}
