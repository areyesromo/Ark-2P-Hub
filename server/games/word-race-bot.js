/**
 * The computer opponent for Word Race (see `bot` in index.js). It finds words in the grid the way
 * a person does: the familiar ones first (short, everyday words), the odd longer one, and fewer as
 * the easy ones run out; it doesn't know most of the dictionary's obscure words. Each word takes
 * a moment to spot (a log-normal spread, as people's times are) and to trace.
 *   easy:   a word every 9 s or so, short ones, and a small vocabulary.
 *   normal: every 5.5 s, and more words it knows.
 *   hard:   every 3.5 s, a big vocabulary, and it goes for the longer words.
 */
import { solve, neighbours, MIN_LETTERS } from './word-race.js';
import { ANSWERS } from './anagram-words.js';
import { WORDS as HUNT_WORDS } from './word-hunt-words.js';
import { WORDS as SKETCH_WORDS } from './sketch-words.js';
import { COMMON } from './word-race-common.js';

const LEVEL = {
  easy: { median: 9000, knows: 0.15, everyday: 0.8, long: 0, trace: 320 },
  normal: { median: 5500, knows: 0.5, everyday: 0.95, long: 0.5, trace: 240 },
  hard: { median: 3500, knows: 1, everyday: 1, long: 1.2, trace: 180 },
};
const SPREAD = 0.5;
// Words everyone knows (the hub's other word lists).
const BASE = [...COMMON, ...ANSWERS, ...HUNT_WORDS, ...Object.values(SKETCH_WORDS).flat()].map((w) => String(w).toLowerCase());
const EVERYDAY = new Set([...BASE, ...BASE.map((w) => w + 's')]); // (and their plurals: the dictionary checks those)
// Of the rest, how many of each length a player knows (shorter ones more often).
const OTHERS = { 3: 0.04, 4: 0.05, 5: 0.06, 6: 0.06 };

/** A steady 0..1 for a word (the same every time: it knows a word or it doesn't). */
function hash(word, salt) {
  let h = 2166136261 ^ salt;
  for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

/** Does a player at this level know the word? */
export function knows(word, level) {
  const L = LEVEL[level];
  if (EVERYDAY.has(word)) return hash(word, 7) < L.everyday;
  let p = (OTHERS[Math.min(word.length, 6)] || 0.1) * L.knows;
  if (/[jqxz]/.test(word)) p *= 0.5;
  return hash(word, 11) < p;
}

/** A path of tiles that spells `word` on the grid, or null. */
export function pathFor(grid, word) {
  const size = Math.round(Math.sqrt(grid.length));
  const text = (i) => (grid[i] === 'Q' ? 'qu' : grid[i].toLowerCase());
  const used = new Array(grid.length).fill(false);
  const walk = (i, at, path) => {
    const t = text(i);
    if (!word.startsWith(t, at)) return null;
    path.push(i);
    if (at + t.length === word.length) return path.slice();
    used[i] = true;
    for (const nb of neighbours(i, size)) {
      if (used[nb]) continue;
      const found = walk(nb, at + t.length, path);
      if (found) { used[i] = false; return found; }
    }
    used[i] = false;
    path.pop();
    return null;
  };
  for (let i = 0; i < grid.length; i++) {
    const found = walk(i, 0, []);
    if (found) return found;
  }
  return null;
}

export function wordRaceBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !Array.isArray(view.grid)) return null;
  // The words it'll see in this grid, easiest first (worked out once a round).
  const key = view.round + ':' + view.grid.join('');
  let plan = memory.wordRace;
  if (!plan || plan.key !== key) {
    const words = [...solve(view.grid)].filter((w) => w.length >= MIN_LETTERS && knows(w, level));
    const ease = (w) => (EVERYDAY.has(w) ? -1.5 : 0) + (w.length - 3) * (1 - L.long * 0.6) + rng() * 2.5;
    plan = memory.wordRace = { key, words: words.map((w) => ({ w, e: ease(w) })).sort((a, b) => a.e - b.e).map((x) => x.w) };
  }
  const found = new Set((view.yourWords || []).map((x) => x.word));
  const word = plan.words.find((w) => !found.has(w));
  if (!word) return null;
  const path = pathFor(view.grid, word);
  if (!path) return null;
  // Spotting it (slower as the easy ones run out), then tracing it.
  const gauss = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const spot = L.median * Math.exp(SPREAD * gauss) * (1 + found.size * 0.04);
  return { type: 'word', path, botDelayMs: spot + path.length * L.trace, botFor: key };
}
