/**
 * The computer for Word Tiles (see `bot` in index.js). It tries the words it knows along every row
 * and column, against its rack and the letters already down, and checks each play like the game does.
 *   easy:   knows the short everyday words (three and four letters), and plays the first decent
 *           one it finds rather than the best.
 *   normal: knows the everyday words up to five letters, and plays the one that scores most.
 *   hard:   knows the whole dictionary (up to eight letters), plays for the most points, and minds
 *           what it keeps: a good mix of vowels and consonants, no stranded awkward letters.
 * With nothing to play it swaps its worst tiles (or passes when the bag's low).
 */
import { RACK, POINTS, findPlays, words } from './word-tiles-rules.js';
import { COMMON } from './word-race-common.js';
import { ANSWERS } from './anagram-words.js';

const pace = (rng) => 2500 + rng() * 3000;
const EASY = COMMON.filter((w) => w.length <= 4);
const NORMAL = [...new Set([...COMMON, ...ANSWERS])];
let HARD = null;
const hardList = () => (HARD || (HARD = [...words()].filter((w) => w.length <= 8)));

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** How good the tiles kept back are: a balance of vowels, and no clumsy letters. */
function leave(rack, used) {
  const left = rack.slice();
  for (const t of used) left.splice(left.indexOf(t.letter), 1);
  const v = left.filter((l) => VOWELS.has(l)).length;
  const c = left.length - v;
  let score = -Math.abs(v - c) * 1.5;
  for (const l of left) if (POINTS[l] >= 8) score -= 3;
  if (left.includes('s')) score += 2;
  if (new Set(left).size < left.length) score -= 1.5; // doubles
  return score;
}

export function wordTilesBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !view.rack || !['easy', 'normal', 'hard'].includes(level)) return null;
  const say = (move) => ({ ...move, botDelayMs: pace(rng), botFor: view.round + ':' + view.n });
  const rack = view.rack;
  const list = level === 'easy' ? EASY : level === 'normal' ? NORMAL : hardList();
  const plays = findPlays(view.board, rack, list);
  // A play the game turned down (it shouldn't happen): don't offer it again.
  if (plays.length) {
    let pick;
    if (level === 'easy') {
      plays.sort((a, b) => a.score - b.score);
      pick = plays[Math.floor(plays.length * (0.3 + rng() * 0.5))];
    } else if (level === 'normal') pick = plays.reduce((a, b) => (b.score > a.score ? b : a));
    else pick = plays.reduce((a, b) => (b.score + leave(rack, b.tiles) > a.score + leave(rack, a.tiles) ? b : a));
    return say({ type: 'play', tiles: pick.tiles });
  }
  if (view.bag >= RACK) {
    // Swap the clumsiest tiles: the high-value ones and spare vowels.
    const out = rack.filter((l, i) => POINTS[l] >= 8 || (VOWELS.has(l) && rack.slice(0, i).filter((x) => VOWELS.has(x)).length >= 2));
    return say({ type: 'swap', letters: out.length ? out : rack.slice(0, 3) });
  }
  return say({ type: 'pass' });
}
