/**
 * The computer for Quiz Battle and Trivia Quest (see `bot` in index.js). Its view carries the
 * answer (botAnswer, only in its own botView), and it picks it as often as its level says;
 * otherwise a wrong answer. In Trivia Quest, unsure, it spends its 50/50 first (Normal and Hard).
 *   easy:   right 45% of the time, slowly.   normal: 65%.   hard: 85%, and quick.
 */
const RIGHT = { easy: 0.45, normal: 0.65, hard: 0.85 };
const ANSWER_MS = { easy: [4000, 9000], normal: [2500, 7000], hard: [1500, 4500] };

export function quizBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'question' || !RIGHT[level] || !view.question) return null;
  if (view.yourPick !== null && view.yourPick !== undefined) return null;
  if (!Number.isInteger(view.botAnswer)) return null;
  const [lo, hi] = ANSWER_MS[level];
  const pace = Math.min(lo + rng() * (hi - lo), Math.max(500, (view.timeLeftMs || 10000) - 1500));
  const removed = view.removed || [];
  const left = [0, 1, 2, 3].filter((i) => i < view.question.options.length && !removed.includes(i));
  if (removed.length) {
    // After a 50/50: it knows it or it's a coin toss between the two left.
    const choice = rng() < RIGHT[level] ? view.botAnswer : left[Math.floor(rng() * left.length)];
    return { type: 'answer', choice, botDelayMs: pace };
  }
  if (rng() < RIGHT[level]) return { type: 'answer', choice: view.botAnswer, botDelayMs: pace };
  if (view.fiftyLeft && level !== 'easy') return { type: 'fifty', botDelayMs: pace / 2 };
  const wrong = left.filter((i) => i !== view.botAnswer);
  return { type: 'answer', choice: wrong[Math.floor(rng() * wrong.length)], botDelayMs: pace };
}
