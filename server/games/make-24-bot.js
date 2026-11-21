/**
 * The computer for Make 24 (see `bot` in index.js). It works the numbers out like a person: a while
 * to see a way (longer when there are few), joining them one pair at a time on its "phone" (the TV
 * shows its progress), then the answer.
 *   easy:   slow, and one puzzle in six it just doesn't see (and gives up on).
 *   normal: a person who's good at sums.
 *   hard:   quick.
 */
import { apply, OPS } from './make-24.js';

const PACE = { easy: [26000, 26000], normal: [15000, 16000], hard: [8000, 10000] }; // [least, plus up to]

/** A way to make 24, as steps ([i, op, j] on the list as it is then), or null. */
export function solve(numbers) {
  const walk = (items, steps) => {
    if (items.length === 1) return items[0][0] === 24 && items[0][1] === 1 ? steps : null;
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          const v = apply(items[i], op, items[j]);
          if (!v) continue;
          const found = walk(items.filter((_, k) => k !== i && k !== j).concat([v]), steps.concat([[i, op, j]]));
          if (found) return found;
        }
      }
    }
    return null;
  };
  return walk(numbers.map((n) => [n, 1]), []);
}

/** How many ways (up to 12): fewer ways, a harder puzzle, a longer think. */
function ways(numbers) {
  let n = 0;
  const walk = (items) => {
    if (n >= 12) return;
    if (items.length === 1) { if (items[0][0] === 24 && items[0][1] === 1) n++; return; }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        for (const op of OPS) {
          for (const [a, b] of [[i, j], [j, i]]) {
            if ((op === '+' || op === '*') && a > b) continue;
            const v = apply(items[a], op, items[b]);
            if (v) walk(items.filter((_, k) => k !== a && k !== b).concat([v]));
          }
        }
      }
    }
  };
  walk(numbers.map((x) => [x, 1]));
  return n;
}

export function make24Bot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || view.phase !== 'play' || !PACE[level]) return null;
  const key = view.round + ':' + view.numbers.join();
  if (memory.key !== key) {
    const [least, plus] = PACE[level];
    const hard = 1 + (12 - Math.min(12, ways(view.numbers))) / 12; // (1 for an easy one, up to 2)
    memory.key = key;
    memory.total = (least + rng() * plus) * hard;
    memory.stuck = level === 'easy' && rng() < 1 / 6;
    memory.steps = solve(view.numbers);
  }
  // Stuck: it gives up on this one (the puzzle moves on if you give up too, or the clock runs out).
  if (memory.stuck || !memory.steps) return view.skips[view.you] ? null : { type: 'skip', botDelayMs: memory.total, botFor: key + ':skip' };
  const joined = view.progress[view.you];
  const pace = { botDelayMs: memory.total / 4, botFor: key + ':' + joined };
  if (joined < 2) return { type: 'progress', joined: joined + 1, ...pace };
  return { type: 'solve', steps: memory.steps, ...pace };
}
