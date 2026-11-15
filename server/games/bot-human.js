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

/**
 * What the computer sees in a game played by steering (a game's `steers`, see index.js): the
 * game as it was a reaction time ago. A person steering takes in the game that late, but keeps
 * acting on it all the time; they don't wait a reaction after every move. So the room shows the
 * computer each view a reaction late and plays what it decides straight away. The lag drifts,
 * as a person's does (a new reaction time for its level every half second or so): a fixed lag
 * would make two computers mirror each other move for move.
 */
export class Sight {
  constructor(level, rng = Math.random) {
    this.level = level;
    this.rng = rng;
    this.views = []; // [{ at, view }], oldest first
    this.lag = reactionMs(level, rng);
    this.lagUntil = -Infinity;
  }

  /** Take in a view (a copy: the game may change the original). */
  see(view, now) {
    this.views.push({ at: now, view: structuredClone(view) });
    while (this.views.length > 1 && this.views[0].at < now - 2000) this.views.shift(); // (older than any reaction)
  }

  /** The latest view from at least a reaction time ago, or null while there's none yet. */
  seen(now) {
    if (now >= this.lagUntil) {
      this.lag = reactionMs(this.level, this.rng);
      this.lagUntil = now + 400 + this.rng() * 300;
    }
    const due = now - this.lag;
    for (let i = this.views.length - 1; i >= 0; i--) if (this.views[i].at <= due) return this.views[i].view;
    return null;
  }
}
