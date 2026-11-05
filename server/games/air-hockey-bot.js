/**
 * The computer opponent for Air Hockey (see `bot` in index.js). With the puck on its side it
 * gets behind it and strikes through it towards your goal; otherwise it guards its own goal,
 * between the puck and the goal mouth.
 *   easy:   slow to react, unsteady, and only nudges the puck.
 *   normal: quicker, and strikes towards somewhere in your goal mouth (hard to read).
 *   hard:   the same, and much quicker to react: it gets there first.
 */
import { FIELD } from './air-hockey.js';

const LEVEL = {
  easy: { react: [220, 340], through: 0, lead: 0, wobble: 0.7, spread: 0 },
  normal: { react: [130, 210], through: 1.1, lead: 0.1, wobble: 0.35, spread: 0.3 },
  hard: { react: [50, 90], through: 1.1, lead: 0.1, wobble: 0.35, spread: 0.3 },
};

export function airHockeyBot(view, level, rng = Math.random) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.puck) return null;
  const me = view.you;
  const p = view.puck;
  const m = view.mallets[me];
  const half = FIELD.w / 2;
  const home = me === 0 ? 0 : FIELD.w; // my goal line
  const away = me === 0 ? FIELD.w : 0; // theirs
  const toward = me === 0 ? 1 : -1; // the way I attack
  // Where the puck will be a moment from now.
  const px = p.x + p.vx * L.lead;
  const py = p.y + p.vy * L.lead;
  const mine = me === 0 ? px < half + FIELD.puckR : px > half - FIELD.puckR; // (one resting on the line is anyone's)
  const reach = FIELD.malletR + FIELD.puckR;
  let tx;
  let ty;
  if (mine) {
    const behind = (px - m.x) * toward > -0.1; // the mallet is between the puck and my goal
    if (behind) {
      // Strike: through the puck, towards somewhere in their goal mouth (hard to read).
      const gy = FIELD.h / 2 + (rng() - 0.5) * FIELD.goalH * L.spread;
      const dx = away - px;
      const dy = gy - py;
      const d = Math.hypot(dx, dy) || 1;
      tx = px + (dx / d) * L.through;
      ty = py + (dy / d) * L.through;
    } else if (Math.abs(px - home) < FIELD.malletR) {
      // Against my end wall, where no mallet can get behind it.
      const corner = py < FIELD.malletR || py > FIELD.h - FIELD.malletR;
      const mouth = Math.abs(py - FIELD.h / 2) < FIELD.goalH / 2;
      if (corner || mouth) {
        // In a corner pocket or my goal mouth (a hit there scores for them): stand off, out of
        // its way, while the table drifts it back out (see AirHockey#unstick).
        tx = home + toward * 2.2;
        ty = FIELD.h / 2 + (py > FIELD.h / 2 ? -2.2 : 2.2);
      } else {
        // Hit it into the wall: it comes back off it.
        tx = px;
        ty = py;
      }
    } else {
      // The puck got past: back round it, between it and my goal.
      tx = px - toward * reach * 1.4;
      ty = py + (py < m.y ? reach : -reach);
    }
  } else {
    // Guard the goal: in front of the mouth, lined up with the puck.
    tx = home + toward * 1.6;
    const lim = FIELD.goalH / 2;
    ty = FIELD.h / 2 + Math.max(-lim, Math.min(lim, (level === 'easy' ? 0.4 : 0.8) * (py - FIELD.h / 2)));
  }
  // (Easy's hand isn't steady.)
  tx += (rng() * 2 - 1) * L.wobble;
  ty += (rng() * 2 - 1) * L.wobble;
  const [lo, hi] = L.react;
  return { type: 'move', x: Math.max(0, Math.min(FIELD.w, tx)), y: Math.max(0, Math.min(FIELD.h, ty)), botDelayMs: lo + rng() * (hi - lo) };
}
