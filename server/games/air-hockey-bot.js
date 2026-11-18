/**
 * The computer opponent for Air Hockey (see `bot` in index.js). With the puck on its side it
 * gets behind it and strikes through it towards your goal; otherwise it guards its own goal,
 * between the puck and the goal mouth.
 *   easy:   slow to react, unsteady, and hits the puck only gently; it doesn't chase a fast shot
 *           at its goal (it would knock it in), it gets in front of it.
 *   normal: quicker; it strikes towards somewhere in your goal mouth (hard to read), and keeps in
 *           line with a fast shot coming at its goal, where it will cross.
 *   hard:   the same, and more: it reacts quicker (a sharp player's reactions: bot-human.js),
 *           reads where the puck is going, meets it there and shoots at the open side of your goal
 *           (see meet), off a rail when you cover it.
 * It moves like a person: each move comes with a hand (see AirHockey#moveMallets) that speeds up
 * and eases off, and its aim is off by an amount it picks once per plan (guard, strike, ...),
 * so its mallet doesn't twitch from one move to the next. Where it shoots is picked once per
 * strike, too. `memory` keeps the plan between moves.
 */
import { FIELD, PHYSICS } from './air-hockey.js';
import { reactionMs, REACTION } from './bot-human.js';

// wobble: how far off its aim can be (picked once per plan); hand: how quickly its hand gets going
// (units / s²); meets: plays the puck where it will be and shoots at the open side (see meet);
// banks: off a rail when that side's covered; goalie: stays in line with a fast shot, where it will cross.
const LEVEL = {
  easy: { through: 0.5, lead: 0, wobble: 0.7, spread: 0, guard: 0.4, hand: 70, goalie: true },
  normal: { through: 1.1, lead: 0.1, wobble: 0.35, spread: 0.3, guard: 0.6, hand: 100, goalie: true },
  hard: { through: 1.1, lead: 0.22, wobble: 0.35, spread: 0.3, guard: 1, hand: 130, meets: true, banks: true, goalie: true }, // (it leads by about its reaction time: where the puck will be when it gets there)
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
  const delayMs = reactionMs(level, rng);
  // (Normal and Hard don't go at a fast shot coming at their goal: a mallet moving into it only
  // deflects it in. They stay in line, in front of the goal, and let the shot come onto them.)
  const shot = L.goalie && p.vx * toward < -6;
  const read = L.meets && mine && !shot && meet(view, L, REACTION[level].median / 1000, memory, rng); // (planned on its usual reaction, so the spot holds steady)
  if (read) {
    plan = 'meet';
    tx = read.x;
    ty = read.y;
  } else if (mine && !shot) {
    // Behind it enough that a hit sends it forwards, not off at an angle back towards my own goal.
    const gap = Math.hypot(px - m.x, py - m.y) || 1;
    const behind = ((px - m.x) * toward) / gap > 0.35;
    if (behind) {
      // Strike: through the puck, towards somewhere in their goal mouth (hard to read); at the
      // open side when their mallet stands in the mouth (a shot at it never goes in).
      plan = 'strike';
      let gy = FIELD.h / 2 + aim(memory, plan, rng, L).goal * FIELD.goalH * L.spread;
      const foe = view.mallets[1 - me];
      if (Math.abs(foe.x - away) < 3 && Math.abs(gy - foe.y) < FIELD.malletR + FIELD.puckR + 0.2) {
        const side = foe.y > FIELD.h / 2 ? -1 : 1;
        gy = FIELD.h / 2 + side * (FIELD.goalH / 2 - FIELD.puckR - 0.15) * (0.6 + 0.4 * (aim(memory, plan, rng, L).goal + 0.5));
      }
      const dx = away - px;
      const dy = gy - py;
      const d = Math.hypot(dx, dy) || 1;
      tx = px + (dx / d) * L.through;
      ty = py + (dy / d) * L.through;
    } else if (Math.abs(px - home) < FIELD.malletR) {
      // Against my end wall, where no mallet can get behind it.
      const corner = py < FIELD.malletR || py > FIELD.h - FIELD.malletR;
      plan = 'wall';
      if (corner || Math.abs(py - FIELD.h / 2) < FIELD.goalH / 2 + 1.6) {
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
    // (Normal and Hard read a shot coming their way, off the rails too: where it will cross.)
    const comingY = L.goalie && p.vx * toward < -1 ? yAt(p, tx) : py;
    ty = FIELD.h / 2 + Math.max(-lim, Math.min(lim, L.guard * (comingY - FIELD.h / 2)));
  }
  // (Easy's aim is the least steady. Stepping round the puck, or poking it off its own end wall, it
  // takes care, whatever its aim: a slip there puts it in its own goal.)
  const off = aim(memory, plan, rng, L);
  const steady = plan === 'round' || plan === 'wall' ? 0.25 : 1;
  tx += off.x * L.wobble * steady;
  ty += off.y * L.wobble * steady;
  return { type: 'move', x: Math.max(0, Math.min(FIELD.w, tx)), y: Math.max(0, Math.min(FIELD.h, ty)), hand: L.hand, botDelayMs: delayMs };
}

/**
 * Hard plays it as a good player does: it reads where the puck is going (off the rails too), picks
 * the first spot on its way that it can get behind in time (its move starts after its reaction,
 * and its hand needs a moment to get going), and strikes through it at the open side of their
 * goal, away from their mallet, or off a rail if they're covering it. Null: nothing it can reach.
 */
function meet(view, L, delay, memory, rng) {
  const me = view.you;
  const m = view.mallets[me];
  const foe = view.mallets[1 - me];
  const toward = me === 0 ? 1 : -1;
  const home = me === 0 ? 0 : FIELD.w;
  const away = FIELD.w - home;
  const reach = FIELD.malletR + FIELD.puckR;
  const off = aim(memory, 'meet', rng, L).goal; // (its aim isn't perfect: -0.5 .. 0.5)
  for (const s of path(view.puck)) {
    if (s.t < delay || (s.x - FIELD.w / 2) * toward > -reach) continue; // (in its half, once it can move)
    // The open side of their goal, or the same spot banked off the rail on their mallet's side.
    const gy = FIELD.h / 2 + (foe.y > FIELD.h / 2 ? -1 : 1) * (1.1 + off * 0.6);
    let goal = { x: away, y: gy };
    if (L.banks && inLine(s, goal, foe)) goal = { x: away, y: foe.y > FIELD.h / 2 ? -gy : 2 * FIELD.h - gy };
    const d = Math.hypot(goal.x - s.x, goal.y - s.y);
    const ux = (goal.x - s.x) / d;
    const uy = (goal.y - s.y) / d;
    const hx = s.x - ux * (reach + 0.1); // where its mallet meets the puck
    const hy = s.y - uy * (reach + 0.1);
    if ((hx - home) * toward < FIELD.malletR) continue; // (no room behind it)
    if ((s.x - m.x) * toward < 0.3) return null; // (it's not behind where the puck will be: go round it first)
    const gap = Math.hypot(hx - m.x, hy - m.y);
    if (delay + gap / PHYSICS.malletSpeed + PHYSICS.malletSpeed / (2 * L.hand) > s.t + 0.05) continue;
    return { x: s.x + ux * L.through, y: s.y + uy * L.through };
  }
  return null;
}

/** Is `foe`'s mallet in the way of a shot from `from` to `to`? */
function inLine(from, to, foe) {
  const ax = to.x - from.x;
  const ay = to.y - from.y;
  const u = ((foe.x - from.x) * ax + (foe.y - from.y) * ay) / (ax * ax + ay * ay);
  if (u < 0 || u > 1) return false;
  return Math.hypot(from.x + ax * u - foe.x, from.y + ay * u - foe.y) < FIELD.malletR + FIELD.puckR + 0.2;
}

/** The puck's way over the next second and a half (rails and friction, no mallets): [{ t, x, y }]. */
function path(p) {
  const out = [];
  const r = FIELD.puckR;
  const dt = 1 / 60;
  let { x, y, vx, vy } = p;
  for (let t = dt; t <= 1.5; t += dt) {
    const keep = Math.max(0, 1 - PHYSICS.friction * dt);
    vx *= keep;
    vy *= keep;
    x += vx * dt;
    y += vy * dt;
    if (y < r || y > FIELD.h - r) {
      y = y < r ? r : FIELD.h - r;
      vy = -vy * PHYSICS.wallBounce;
    }
    if (Math.abs(y - FIELD.h / 2) >= FIELD.goalH / 2 && (x < r || x > FIELD.w - r)) {
      x = x < r ? r : FIELD.w - r;
      vx = -vx * PHYSICS.wallBounce;
    }
    if (x < -r || x > FIELD.w + r) break;
    out.push({ t, x, y });
  }
  return out;
}

/** Where the puck crosses the line x, off the side rails, going the way it's going. */
function yAt(p, x) {
  if (!p.vx) return p.y;
  const lo = FIELD.puckR;
  const span = FIELD.h - 2 * FIELD.puckR;
  const y = (((p.y + (p.vy * (x - p.x)) / p.vx - lo) % (2 * span)) + 2 * span) % (2 * span);
  return lo + (y > span ? 2 * span - y : y);
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
