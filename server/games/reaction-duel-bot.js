/**
 * The computer opponent for Reaction Duel (see `bot` in index.js): it never jumps the gun, and
 * taps a human-ish reaction time after GO.
 *   easy:   0.38 to 0.60 s.   normal: 0.27 to 0.40 s.   hard: 0.20 to 0.29 s.
 */
const REACTION = { easy: [380, 600], normal: [270, 400], hard: [200, 290] };

export function reactionDuelBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'go' || !REACTION[level]) return null;
  const [lo, hi] = REACTION[level];
  return { type: 'tap', botDelayMs: lo + rng() * (hi - lo) };
}
