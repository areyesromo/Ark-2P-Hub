/**
 * The computer for Hangman Duel (see `bot` in index.js). It picks an everyday word for you, and
 * guesses yours as a person does: the letters most likely given the gaps, the letters showing and
 * the ones it has ruled out. It takes a moment over each letter.
 *   easy:   guesses by how common letters are in English, now and then from the words that fit; slow.
 *   normal: the letter found in the most words that still fit.
 *   hard:   the same, a little quicker, and when one word is left it fills it in.
 */
import { PICKS } from './hangman.js';
import { dictionary } from './word-race.js';

const ENGLISH = 'etaoinshrdlcumwfgypbvkjxqz';
const PACE = { easy: [2200, 2200], normal: [1500, 1500], hard: [1000, 1200] };
const byLength = new Map();

function wordsOf(n) {
  if (!byLength.has(n)) byLength.set(n, dictionary().filter((w) => w.length === n));
  return byLength.get(n);
}

export function hangmanBot(view, level, rng = Math.random) {
  if (!view || !PACE[level]) return null;
  const me = view.you;
  if (view.phase === 'set' && !view.ready[me]) return { type: 'word', word: PICKS[Math.floor(rng() * PICKS.length)], botDelayMs: 3000 + rng() * 3000 };
  if (view.phase !== 'guess' || view.done[me] || !view.masks[me]) return null;
  const mask = view.masks[me];
  const tried = view.tried[me];
  const wrong = tried.filter((c) => !mask.includes(c));
  const pace = { botDelayMs: PACE[level][0] + rng() * PACE[level][1], botFor: view.round + ':' + tried.length };
  const fits = (level !== 'easy' || rng() < 0.45) ? wordsOf(mask.length).filter((w) => {
    for (let i = 0; i < w.length; i++) {
      if (mask[i] ? w[i] !== mask[i] : tried.includes(w[i])) return false;
    }
    return !wrong.some((c) => w.includes(c));
  }) : [];
  let letter;
  if (fits.length) {
    const count = {};
    for (const w of fits) for (const c of new Set(w)) if (!tried.includes(c)) count[c] = (count[c] || 0) + 1;
    const order = Object.keys(count).sort((a, b) => count[b] - count[a] || ENGLISH.indexOf(a) - ENGLISH.indexOf(b));
    letter = order[level === 'easy' && order.length > 1 && rng() < 0.3 ? 1 : 0];
  }
  if (!letter) letter = [...ENGLISH].find((c) => !tried.includes(c));
  if (!letter) return null;
  return { type: 'letter', letter, ...pace };
}
