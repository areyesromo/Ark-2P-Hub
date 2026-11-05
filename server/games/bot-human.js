/**
 * How quickly the computer opponent reacts, modelled on people (see `bot` in index.js). Human
 * reaction to something seen is right-skewed: a median of about 250 to 280 ms, most between about
 * 200 and 380 ms, and a long slow tail; sharp players average about 150 to 220 ms. So a reaction
 * here is log-normal round the level's median, never under its floor:
 *   easy:   a slow player (median 340 ms).   normal: the average (270 ms).   hard: a quick one (215 ms).
 */
export const REACTION = {
  easy: { median: 340, floor: 220 },
  normal: { median: 270, floor: 180 },
  hard: { median: 215, floor: 150 },
};
const SPREAD = 0.22; // the log-normal's sigma: most reactions within about ±25% of the median

/** One reaction time in ms for `level`. */
export function reactionMs(level, rng = Math.random) {
  const r = REACTION[level] || REACTION.normal;
  // A normal draw (Box-Muller), made log-normal round the median.
  const u = Math.max(1e-9, rng());
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(r.floor, Math.min(r.median * 3, r.median * Math.exp(SPREAD * z)));
}
