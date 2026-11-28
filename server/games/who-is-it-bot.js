/**
 * The computer for Who Is It (see `bot` in index.js). It sees its own board: the faces still
 * standing and the answers so far (and how many you have left, which is out in the open).
 *   easy:   asks whatever comes to mind, and sometimes guesses with a few faces still up.
 *   normal: asks the question that splits the faces left most evenly (half yes, half no), and
 *           names the face once only one is left.
 *   hard:   plays the race. It knows the chance of winning from any count of faces left on each
 *           board (worked out exactly, both sides playing their best), so it can weigh each real
 *           question against guessing now. Behind, it asks bold questions (a long shot that could
 *           leave just two or three faces); ahead, it plays safe; and when you're about to name
 *           its face, it guesses.
 */
import { FACES, QUESTIONS } from './who-is-it.js';

// WIN[n][m]: the chance the player to move wins with n faces left on their board and m on the
// other's, both playing their best. Guess (right 1 time in n; wrong loses), or ask a question that
// leaves k or n - k (any split, since there are plenty of questions).
const MAX = FACES.length;
const WIN = [];
for (let n = 0; n <= MAX; n++) WIN.push(new Array(MAX + 1).fill(0));
for (let total = 2; total <= 2 * MAX; total++) {
  for (let n = 1; n <= MAX; n++) {
    const m = total - n;
    if (m < 1 || m > MAX) continue;
    if (n === 1) { WIN[n][m] = 1; continue; }
    let best = 1 / n; // guess
    for (let k = 1; k < n; k++) {
      // (the other then moves with m faces against our k or n - k: smaller totals, already worked out)
      const v = (k / n) * (1 - WIN[m][k]) + ((n - k) / n) * (1 - WIN[m][n - k]);
      if (v > best) best = v;
    }
    WIN[n][m] = best;
  }
}
export { WIN };

const pace = (rng) => 1500 + rng() * 2000;

export function whoIsItBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const left = view.left[me];
  const theirs = view.left[1 - me].length;
  const say = (move) => ({ ...move, botDelayMs: pace(rng), botFor: 'r' + view.round + ':' + view.n });
  const guess = () => say({ type: 'guess', face: left[Math.floor(rng() * left.length)] });
  if (left.length === 1) return guess();
  const open = QUESTIONS.filter((q) => !view.asked[me].includes(q.id));
  // How evenly a question splits the faces left (0: all one way; useless).
  const split = (q) => {
    const yes = left.filter((i) => q.test(FACES[i])).length;
    return Math.min(yes, left.length - yes);
  };
  const useful = open.filter((q) => split(q) > 0);
  if (!useful.length) return guess();
  if (level === 'easy') {
    if (left.length <= 3 && rng() < 0.3) return guess();
    // Mostly any question that rules something out; now and then one that doesn't.
    const pool = rng() < 0.85 ? useful : open;
    return say({ type: 'ask', q: pool[Math.floor(rng() * pool.length)].id });
  }
  if (level === 'hard') {
    // Each question it can really ask, against guessing now.
    const n = left.length;
    let pick = null;
    let value = 1 / n;
    for (const q of useful) {
      const k = left.filter((i) => q.test(FACES[i])).length;
      const v = (k / n) * (1 - WIN[theirs][k]) + ((n - k) / n) * (1 - WIN[theirs][n - k]);
      if (v > value + 1e-9 || (pick && Math.abs(v - value) < 1e-9 && rng() < 0.5)) { value = v; pick = q; }
    }
    return pick ? say({ type: 'ask', q: pick.id }) : guess();
  }
  const best = Math.max(...useful.map(split));
  const top = useful.filter((q) => split(q) === best);
  return say({ type: 'ask', q: top[Math.floor(rng() * top.length)].id });
}
