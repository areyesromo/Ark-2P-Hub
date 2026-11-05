/**
 * The computer opponent for Anagram Duel (see `bot` in index.js). It sees the same mixed-up
 * letters you do and takes a person's time to see the word: how long varies a lot from word to
 * word (as it does for people: a log-normal spread), so it sometimes beats a quick player and
 * sometimes doesn't get one at all. It places the letters as it goes (the TV shows it), and now
 * and then tries a word that isn't one.
 *   easy:   about 15 s for a word (a fair few it doesn't get in time), and more wrong tries.
 *   normal: about 9 s.
 *   hard:   about 5.5 s, hardly a wrong try.
 */
import { isWord, dictionary } from './word-race.js';
import { ANSWERS } from './anagram-words.js';
import { TIMING } from './anagram-duel.js';

const LEVEL = {
  easy: { median: 15000, wrong: 0.25 },
  normal: { median: 9000, wrong: 0.1 },
  hard: { median: 5500, wrong: 0.03 },
};
const SPREAD = 0.55; // (the log-normal's sigma)
const sorted = (w) => [...w].sort().join('');

/** A word that uses all these letters (one players would know first), or null. */
export function wordFor(letters) {
  const key = sorted(letters.join('').toLowerCase());
  const known = ANSWERS.find((w) => sorted(w) === key && isWord(w));
  return known || dictionary().find((w) => w.length === key.length && sorted(w) === key) || null;
}

export function anagramDuelBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !Array.isArray(view.letters)) return null;
  const n = view.letters.length;
  // How it'll go this round, worked out when the letters show.
  let plan = memory.anagram;
  if (!plan || plan.round !== view.round) {
    const gauss = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    const solve = L.median * Math.exp(SPREAD * gauss);
    const answer = wordFor(view.letters);
    const wrongAt = rng() < L.wrong ? solve * (0.4 + rng() * 0.4) : null;
    plan = memory.anagram = { round: view.round, solve: Math.max(1800, solve + (wrongAt ? TIMING.lockMs : 0)), answer, wrongAt, wrongWord: wrongAt ? notAWord(view.letters, rng) : null };
  }
  if (!plan.answer) return null;
  const elapsed = (view.roundMs || TIMING.roundMs) - (view.timeLeft || 0);
  const placed = view.progress ? view.progress[view.you] : 0;
  const tried = Boolean(view.feedback); // (its wrong try's been made)
  // (after a wrong word it's locked out a moment, and the game doesn't say when that's over: it
  // just doesn't try before then)
  const at = (ms) => ({ botDelayMs: Math.max(60, ms - elapsed, (view.lockedFor || 0) + 50), botFor: view.round });
  // Its run at the word: the letters go in over the last part of the time, then the word.
  const wrong = plan.wrongAt && plan.wrongWord && !tried;
  const end = wrong ? plan.wrongAt : plan.solve;
  const from = wrong ? 0 : plan.wrongAt ? plan.wrongAt + TIMING.lockMs : 0;
  if (placed < n) {
    const due = from + (end - from) * (0.45 + (0.5 * (placed + 1)) / (n + 1));
    return { type: 'progress', n: placed + 1, ...at(due) };
  }
  return { type: 'guess', word: wrong ? plan.wrongWord : plan.answer, ...at(end) };
}

/** A mix of the letters that isn't a word (a wrong try). */
function notAWord(letters, rng) {
  for (let tries = 0; tries < 20; tries++) {
    const w = letters.slice();
    for (let i = w.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [w[i], w[j]] = [w[j], w[i]];
    }
    const word = w.join('').toLowerCase();
    if (!isWord(word)) return word;
  }
  return null;
}
