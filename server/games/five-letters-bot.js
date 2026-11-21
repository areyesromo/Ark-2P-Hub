/**
 * The computer for Five Letters (see `bot` in index.js). It sees its own guesses and their colours,
 * never yours, and knows the everyday words the answers come from. Like a person it takes a while
 * over each guess.
 *   easy:   a word that fits what it has seen, but now and then it forgets the yellows; slow.
 *   normal: a word that fits everything it has seen.
 *   hard:   of the words that fit, the one whose colours would split the rest the most; quicker.
 */
import { POOL, marks } from './five-letters.js';

const THINK = { easy: [18000, 12000], normal: [12000, 8000], hard: [8000, 6000] }; // [least, plus up to]
let opener = null; // Hard's first guess: the best splitter of every answer (worked out once)

/** Words that would have given these colours. `yellows`: false ignores where the yellows say. */
function fits(word, board, yellows = true) {
  for (const g of board) {
    const m = marks(g.word, word);
    if (m === g.marks) continue;
    if (yellows) return false;
    // (only the greens and the letters it knows aren't there)
    for (let i = 0; i < m.length; i++) {
      if (g.marks[i] === 'g' && word[i] !== g.word[i]) return false;
      if (g.marks[i] === 'b' && !g.marks.split('').some((x, j) => x !== 'b' && g.word[j] === g.word[i]) && word.includes(g.word[i])) return false;
    }
  }
  return true;
}

/** The candidate that leaves the fewest words on average, whatever the colours. */
function splitter(candidates, from) {
  let best = from[0];
  let bestScore = Infinity;
  for (const w of from) {
    const buckets = new Map();
    for (const c of candidates) {
      const m = marks(w, c);
      buckets.set(m, (buckets.get(m) || 0) + 1);
    }
    let s = 0;
    for (const n of buckets.values()) s += n * n;
    if (!candidates.includes(w)) s += 0.5; // (a word that could be it, when it's as good)
    if (s < bestScore) { bestScore = s; best = w; }
  }
  return best;
}

export function fiveLettersBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || !THINK[level]) return null;
  const me = view.you;
  if (view.done[me]) return null;
  const board = view.boards[me];
  const [least, plus] = THINK[level];
  const pace = { botDelayMs: least + rng() * plus, botFor: view.round + ':' + board.length };
  const tried = new Set(board.map((g) => g.word));
  let candidates = POOL.filter((w) => !tried.has(w) && fits(w, board, !(level === 'easy' && rng() < 0.35)));
  if (!candidates.length) candidates = POOL.filter((w) => !tried.has(w) && fits(w, board));
  if (!candidates.length) candidates = POOL.filter((w) => !tried.has(w));
  let word;
  if (level === 'hard' && !board.length) {
    if (!opener) opener = splitter(POOL, POOL);
    word = opener;
  } else if (level === 'hard' && candidates.length > 2) {
    word = splitter(candidates, candidates.length > 150 ? candidates.slice(0, 150) : candidates);
  } else {
    word = candidates[Math.floor(rng() * candidates.length)];
  }
  return { type: 'guess', word, ...pace };
}
