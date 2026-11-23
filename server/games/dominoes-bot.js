/**
 * The computer for Dominoes (see `bot` in index.js). It sees its own tiles, the line and what you
 * drew (a draw means you had nothing for either end), never your tiles.
 *   easy:   much as Normal, but one tile in four it plays any that fits.
 *   normal: plays its heaviest tile that fits (fewer pips to be caught with).
 *   hard:   also leaves ends you've shown you can't match, keeps a spread of numbers in its hand,
 *           and gets rid of its doubles early.
 */
import { halves, pips } from './dominoes.js';

export function dominoesBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !view.tiles || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  if (memory.hand !== view.hand) { memory.hand = view.hand; memory.lacks = new Set(); memory.lastKey = ''; }
  // A draw by the other: they had nothing for either end then.
  const l = view.last;
  const key = JSON.stringify(l) + view.counts;
  if (l && l.by !== me && l.what === 'draw' && view.ends && key !== memory.lastKey) { memory.lacks.add(view.ends[0]); memory.lacks.add(view.ends[1]); }
  memory.lastKey = key;
  if (view.phase !== 'play' || view.turn !== me) return null;
  const pace = (ms) => ms + rng() * ms * 0.8;
  const tag = view.hand + ':' + view.line.length + ':' + view.tiles.length;
  if (view.stuck) return { type: view.stuck, botDelayMs: pace(900), botFor: tag };
  const options = [];
  for (const [tile, ends] of Object.entries(view.fits)) for (const end of ends) options.push({ tile, end });
  if (!options.length) return null;
  let pick;
  if (level === 'easy' && rng() < 0.25) pick = options[Math.floor(rng() * options.length)];
  else {
    const score = (o) => {
      let s = pips(o.tile);
      if (level !== 'hard') return s + rng() * 0.1;
      const [a, b] = halves(o.tile);
      if (a === b) s += 6; // doubles out early
      // The end it leaves open: one they lack is good; keep numbers it still holds.
      const ends = view.ends ? view.ends.slice() : [a, b];
      const open = !view.ends ? null : o.end === 'L' ? (a === ends[0] ? b : a) : (a === ends[1] ? b : a);
      if (open !== null) {
        if (memory.lacks.has(open)) s += 8;
        const rest = view.tiles.filter((t) => t !== o.tile);
        if (rest.some((t) => halves(t).includes(open))) s += 3;
      }
      return s + rng() * 0.1;
    };
    pick = options.slice().sort((x, y) => score(y) - score(x))[0];
  }
  return { type: 'play', tile: pick.tile, end: pick.end, botDelayMs: pace(1300), botFor: tag };
}
