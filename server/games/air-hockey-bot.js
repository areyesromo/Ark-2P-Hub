/**
 * The computer opponent for Air Hockey (see `bot` in index.js). With the puck on its side it
 * gets behind it and strikes through it towards your goal; otherwise it guards its own goal,
 * between the puck and the goal mouth.
 *   easy:   slow to react, unsteady, and only nudges the puck.
 *   normal: quicker, and strikes towards somewhere in your goal mouth (hard to read).
 *   hard:   the same, guards its goal tighter (right in line with the puck), reacts quicker (a
 *           sharp player's reactions: bot-human.js), and goes where the puck will be by then.
 * It moves like a person: each move comes with a hand (see AirHockey#moveMallets) that speeds up
 * and eases off, and its aim is off by an amount it picks once per plan (guard, strike, ...),
 * so its mallet doesn't twitch from one move to the next. Where it shoots is picked once per
 * strike, too. `memory` keeps the plan between moves.
 */
import { FIELD } from './air-hockey.js';
import { reactionMs } from './bot-human.js';

// wobble: how far off its aim can be (picked once per plan); hand: how quickly its hand gets going (units / s²).
const LEVEL = {
  easy: { through: 0, lead: 0, wobble: 0.7, spread: 0, guard: 0.4, hand: 70 },
  normal: { through: 1.1, lead: 0.1, wobble: 0.35, spread: 0.3, guard: 0.6, hand: 100 },
  hard: { through: 1.1, lead: 0.22, wobble: 0.35, spread: 0.3, guard: 1, hand: 130 }, // (it leads by about its reaction time: where the puck will be when it gets there)
};

export function airHockeyBot(view, level, rng = Math.random, _retries = 0, memory = {}) {
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
  let plan;
  if (mine) {
    // Behind it enough that a hit sends it forwards, not off at an angle back towards my own goal.
    const gap = Math.hypot(px - m.x, py - m.y) || 1;
    const behind = ((px - m.x) * toward) / gap > 0.35;
    if (behind) {
      // Strike: through the puck, towards somewhere in their goal mouth (hard to read).
      plan = 'strike';
      const gy = FIELD.h / 2 + aim(memory, plan, rng, L).goal * FIELD.goalH * L.spread;
      const dx = away - px;
      const dy = gy - py;
      const d = Math.hypot(dx, dy) || 1;
      tx = px + (dx / d) * L.through;
      ty = py + (dy / d) * L.through;
    } else if (Math.abs(px - home) < FIELD.malletR) {
      // Against my end wall, where no mallet can get behind it.
      const corner = py < FIELD.malletR || py > FIELD.h - FIELD.malletR;
      plan = 'wall';
      if (corner || Math.abs(py - FIELD.h / 2) < FIELD.goalH / 2 + 1) {
        // In a corner pocket, my goal mouth or beside it (a hit there scores for them): stand
        // off, out of its way, while the table drifts it back out (see AirHockey#unstick).
        tx = home + toward * 2.2;
        ty = FIELD.h / 2 + (py > FIELD.h / 2 ? -2.2 : 2.2);
      } else {
        // Hit it into the wall: it comes back off it.
        tx = px;
        ty = py;
      }
    } else {
      // The puck got past: round behind it, with room to spare (a straight line back through it
      // knocks it into my own goal). In its way, it steps out to the side first, leaning forwards
      // so the mallet isn't carried back into it.
      plan = 'round';
      const clear = reach + 0.6;
      let side = m.y < py ? -1 : 1; // (the side the mallet's already on)
      if (py + side * clear < FIELD.malletR || py + side * clear > FIELD.h - FIELD.malletR) side = -side; // (no room by the rail)
      // (in its way: within touching distance across, and not yet back past it; well inside the
      // side step, so even an unsteady aim gets clear of it and on round)
      const inWay = Math.abs(m.y - py) < reach + 0.25 && (m.x - px) * toward > -reach;
      tx = inWay ? m.x + toward * 0.5 : px - toward * reach * 1.6;
      ty = py + side * clear * (inWay ? 1 : 0.6);
    }
  } else {
    // Guard the goal: in front of the mouth, lined up with the puck.
    plan = 'guard';
    tx = home + toward * 1.6;
    const lim = FIELD.goalH / 2;
    ty = FIELD.h / 2 + Math.max(-lim, Math.min(lim, L.guard * (py - FIELD.h / 2)));
  }
  // (Easy's aim is the least steady. Stepping round the puck it keeps its distance, whatever its aim.)
  const off = aim(memory, plan, rng, L);
  const steady = plan === 'round' ? 0.25 : 1;
  tx += off.x * L.wobble * steady;
  ty += off.y * L.wobble * steady;
  return { type: 'move', x: Math.max(0, Math.min(FIELD.w, tx)), y: Math.max(0, Math.min(FIELD.h, ty)), hand: L.hand, botDelayMs: reactionMs(level, rng) };
}

/** How far off its aim is, and where in the goal mouth it shoots (-0.5 .. 0.5): new for each new plan. */
function aim(memory, plan, rng, L) {
  const m = memory || {};
  if (m.plan !== plan || !m.aim) {
    m.plan = plan;
    m.aim = { x: rng() * 2 - 1, y: rng() * 2 - 1, goal: rng() - 0.5 };
  }
  return m.aim;
}
