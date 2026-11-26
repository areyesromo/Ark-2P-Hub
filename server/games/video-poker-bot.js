/**
 * The computer for Video Poker (see `bot` in index.js). It sees the five cards dealt and not the
 * new ones coming, so it tries every way of holding (32 of them) over a sample of possible draws.
 *   easy:   a rule of thumb: keeps any pair or better, else its picture cards, else nothing.
 *   normal: scores each hold by how often it beats what a sensible player would keep with the same
 *           new cards (you both draw the same ones), over a small sample.
 *   hard:   a bigger sample, and it plays against the hold a Normal player would choose.
 */
import { deck, evaluate, rankOf } from './holdem-hands.js';

const PATTERNS = Array.from({ length: 32 }, (_, m) => [0, 1, 2, 3, 4].map((i) => !!(m & (1 << i))));

function sampleDraws(dealt, n, rng) {
  const rest = deck().filter((c) => !dealt.includes(c));
  const out = [];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 5; i++) {
      const j = i + Math.floor(rng() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    out.push(rest.slice(0, 5));
  }
  return out;
}

const finalFor = (dealt, hold, spare) => {
  let k = 0;
  return dealt.map((c, i) => (hold[i] ? c : spare[k++]));
};

/** The rule of thumb (Easy, and the "sensible player" Hard plays against). */
export function thumbHold(dealt) {
  const counts = new Map();
  for (const c of dealt) counts.set(rankOf(c), (counts.get(rankOf(c)) || 0) + 1);
  const cat = evaluate(dealt).category;
  if (cat >= 4) return [true, true, true, true, true]; // a straight or better: keep it all
  if ([...counts.values()].some((n) => n >= 2)) return dealt.map((c) => counts.get(rankOf(c)) >= 2);
  // Four to a flush.
  const suits = {};
  for (const c of dealt) suits[c.slice(-1)] = (suits[c.slice(-1)] || 0) + 1;
  const flush = Object.keys(suits).find((s) => suits[s] === 4);
  if (flush) return dealt.map((c) => c.slice(-1) === flush);
  return dealt.map((c) => rankOf(c) >= 11);
}

export function videoPokerBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'hold' || view.locked[view.you] || !['easy', 'normal', 'hard'].includes(level)) return null;
  const dealt = view.dealt;
  const pace = { botDelayMs: 2500 + rng() * 3500, botFor: 'h' + view.hand };
  if (level === 'easy') {
    let hold = thumbHold(dealt);
    if (rng() < 0.4) hold = hold.map((h) => (rng() < 0.3 ? !h : h)); // (now and then a slip)
    return { type: 'hold', hold, ...pace };
  }
  const draws = sampleDraws(dealt, level === 'hard' ? 120 : 50, rng);
  // Every hold's final hand on every sampled draw.
  const scores = PATTERNS.map((hold) => draws.map((d) => evaluate(finalFor(dealt, hold, d)).score));
  /** The hold that most often beats the scores `theirs` (one per sampled draw). */
  const bestAgainst = (theirs) => {
    let best = null;
    scores.forEach((mine, p) => {
      let v = 0;
      mine.forEach((s, k) => { v += (s > theirs[k] ? 1 : s === theirs[k] ? 0.5 : 0) + s / 1e8; });
      if (!best || v > best.v) best = { v, p };
    });
    return best.p;
  };
  const thumb = PATTERNS.findIndex((h) => h.every((x, i) => x === thumbHold(dealt)[i]));
  let pick = bestAgainst(scores[thumb]);
  // Hard: against the hold a Normal player would choose, not just the rule of thumb.
  if (level === 'hard') pick = bestAgainst(scores[pick]);
  return { type: 'hold', hold: PATTERNS[pick], ...pace };
}
