/**
 * The computer opponent for Kart Race and Kart Race 3D (see `bot` in index.js). It drives like a
 * player reading the road on the TV: it steers for a point ahead on the road (further ahead the
 * faster it goes), eases off and brakes into the bends, drifts the sharp ones, and uses its items.
 * Its steering is a human reaction time behind what it sees (bot-human.js). In a balloon battle it
 * fetches items from the ? boxes, then chases you and fires when you're ahead of it. It readies up after you on the menus.
 *   easy:   wobbly steering, brakes early and hard, never drifts, uses items whenever.
 *   normal: a steady line, sensible braking, drifts the sharpest bends.
 *   hard:   a tight line, carries speed through the bends, drifts, and saves items for the straights.
 */
import { reactionMs } from './bot-human.js';

// pace: on a big 3D road, the share of its top speed it aims for (the levels' gap there).
const LEVEL = {
  easy: { wobble: 0.35, corner: 0.7, drift: false, look: 1.1, pace: 0.82 },
  normal: { wobble: 0.12, corner: 0.85, drift: true, look: 1, pace: 0.92 },
  hard: { wobble: 0.04, corner: 0.97, drift: true, look: 0.95, pace: 1 },
};
// The big 3D roads (a lap of 400-500): their bends are wide, so the computer brakes only for what
// a kart can't turn (the server's KART.turnRate at full lock), and steers gently enough that its
// reaction time doesn't make it weave from lock to lock. The small 2D roads keep the tuned driving.
const BIG_ROAD = 300;
const TURN_RATE = 2.8;
const STEER_GAIN = { big: 1.4, small: 2.4 };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function kartRaceBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L) return null;
  const me = view.you;
  // The menus: ready when you are (setup, between races, a rematch).
  const ready = view.ready || [false, false];
  if ((view.phase === 'setup' || view.phase === 'standings') && ready[1 - me] && !ready[me]) return { type: 'go', botDelayMs: 600 + rng() * 800 };
  if (view.phase === 'over' && ready[1 - me] && !ready[me]) return { type: 'rematch', botDelayMs: 900 + rng() * 900 };
  if (view.phase !== 'race' || !view.karts) return memory.kartDriving ? stop(memory) : null;
  const k = view.karts[me];
  if (k.finished) return memory.kartDriving ? stop(memory) : null;
  const pace = driveDelayMs(level, rng);
  const move = driveKart(view, level, rng, memory, 0, true);
  return move ? { ...move, botDelayMs: pace } : null;
}

/** How long a driving decision takes to reach the wheel. */
export function driveDelayMs(level, rng = Math.random) {
  return reactionMs(level, rng) * 0.6; // (steering is a running correction: a bit quicker than a fresh reaction)
}

/**
 * Drive kart `view.you` for a moment, racing (or battling) like a player: shared by the computer
 * opponent above and the computer racers in an 8-kart Cup (kart-race.js driveComputers). `lane`:
 * how far right of the road's middle to hold (negative: left), so a pack doesn't drive in single
 * file. `memory.sway` (a computer racer's own style, about ±0.1) makes it a little wobblier and
 * later on the brakes, or steadier and earlier. Returns a drive or item input, or null.
 */
export function driveKart(view, level, rng, memory, lane = 0, giveRoom = false) {
  const L = LEVEL[level];
  const me = view.you;
  const k = view.karts[me];
  const sway = memory.sway || 0;
  // Items: Easy whenever; the others on a straight, or a banana with you behind.
  if (k.items && k.items.length && rng() < (level === 'easy' ? 0.05 : 0.03)) {
    const straight = !view.road || Math.abs(bend(view.road)) < 0.25;
    if (level === 'easy' || straight) return { type: 'item' };
  }
  let steerTo;
  let turn = 0;
  if (view.road) {
    // A point ahead on the road, further the faster it goes.
    const r = view.road;
    // (On a big road, the point 5 ahead or further even when slow: a point 1 ahead of a kart off the middle,
    // as on the grid, is a sharp angle away, and it would weave there.)
    const nearest = r.length > BIG_ROAD ? 3 : 1;
    const i = Math.min(r.ahead.length - 1, Math.max(nearest, Math.round((Math.abs(k.speed) / 2.2) * L.look)));
    const a = r.ahead[i];
    // The seat computer on a big road keeps to its own side of a kart alongside: two aiming at the
    // same point grind together, and every bump costs speed. (The Cup's racers get their line,
    // room included, from driveComputers.)
    if (giveRoom && r.length > BIG_ROAD) lane += besideShift(view, k, a.angle);
    const p = { x: a.x - Math.sin(a.angle) * lane, y: a.y + Math.cos(a.angle) * lane }; // in its lane
    steerTo = Math.atan2(p.y - k.y, p.x - k.x);
    turn = bend(r);
  } else if (view.ring) {
    // A battle: balloons only pop to items, so with none it fetches some from a ? box; then
    // after you, firing when you're ahead of it. It goes round the ring the shorter way (the
    // arena is a ring round an island), straight at it once it's close.
    const r = view.ring;
    const foe = view.karts[1 - me];
    const armed = k.items && k.items.length;
    const ringGap = (s) => ((((s - r.s) % 1) + 1) % 1) * r.length; // forwards round the ring
    const way = (s) => Math.min(ringGap(s), r.length - ringGap(s));
    const box = !armed && r.boxes.length ? r.boxes.reduce((a, b) => (way(b.s) < way(a.s) ? b : a)) : null;
    const to = box ? { x: box.x, y: box.y, s: box.s } : { x: foe.x, y: foe.y, s: r.foe };
    if (Math.hypot(to.x - k.x, to.y - k.y) < 3.5) steerTo = Math.atan2(to.y - k.y, to.x - k.x);
    else {
      const pts = ringGap(to.s) <= r.length / 2 ? r.ahead : r.back;
      const p = pts[Math.min(pts.length - 1, Math.max(1, Math.round(Math.abs(k.speed) / 2.2)))];
      steerTo = Math.atan2(p.y - k.y, p.x - k.x);
    }
    if (armed && Math.abs(angleDiff(Math.atan2(foe.y - k.y, foe.x - k.x), k.angle)) < 0.3 && Math.hypot(foe.x - k.x, foe.y - k.y) < 8) return { type: 'item' };
  } else return null;
  // Stuck against a wall (on the gas but hardly moving for a second): back out, turning.
  const stuck = memory.kartStuck || (memory.kartStuck = { since: null, until: 0 });
  const now = view.raceMs || 0;
  if (now < stuck.until) return { type: 'drive', steer: stuck.steer, gas: false, brake: true, drift: false };
  if (Math.abs(k.speed) < 0.6) {
    if (stuck.since === null) stuck.since = now;
    else if (now - stuck.since > 1000) {
      stuck.since = null;
      stuck.until = now + 900;
      stuck.steer = angleDiff(steerTo, k.angle) > 0 ? -1 : 1; // (reversing turns it the other way)
      return { type: 'drive', steer: stuck.steer, gas: false, brake: true, drift: false };
    }
  } else stuck.since = null;
  const big = Boolean(view.road && view.road.length > BIG_ROAD);
  const err = angleDiff(steerTo, k.angle);
  const steer = Math.max(-1, Math.min(1, err * (big ? STEER_GAIN.big : STEER_GAIN.small) + (rng() * 2 - 1) * L.wobble * (1 + sway)));
  // Speed for the bend ahead: slower the sharper it is.
  const top = k.top || view.maxSpeed || 8.5;
  const drift = L.drift && Math.abs(turn) > 0.7 && k.speed > top * 0.55;
  let gas;
  let brake;
  if (big) {
    // Off the gas above its pace (it coasts down, keeping a boost's speed for a while); on the
    // brakes only for a bend it can't turn at this speed.
    const bendLimit = bigRoadBend(view.road, turn, k.turnRate || TURN_RATE, L, sway);
    brake = k.speed > bendLimit + 0.4 && !drift;
    gas = !brake && (k.speed < top * L.pace * (1 + sway * 0.1) || drift);
  } else {
    const want = top * (1 - Math.min(0.65, Math.abs(turn) * 0.75)) * (Math.abs(turn) > 0.2 ? L.corner * (1 + sway * 0.3) : 1);
    const fast = k.speed > want + 0.4;
    gas = !fast || drift;
    brake = fast && !drift;
  }
  const input = { type: 'drive', steer: Math.round(steer * 20) / 20, gas, brake, drift };
  memory.kartDriving = true;
  return input;
}

/** Sideways room to give a kart alongside (within 2 ahead or behind, 2.5 across): 2 away from it. */
function besideShift(view, k, roadAngle) {
  const sx = -Math.sin(roadAngle);
  const sy = Math.cos(roadAngle);
  let shift = 0;
  view.karts.forEach((o, j) => {
    if (j === view.you || !o) return;
    const dx = o.x - k.x;
    const dy = o.y - k.y;
    const across = dx * sx + dy * sy;
    const along = dx * sy - dy * sx;
    if (Math.abs(along) < 2 && Math.abs(across) < 2.5) shift += across > 0 ? -2 : across < 0 ? 2 : 0;
  });
  return shift;
}

/**
 * On a big road, the fastest it can take the bend ahead: the road's curvature against this racer's
 * turn rate, with the level's margin (no limit on a straight).
 */
function bigRoadBend(road, turn, rate, L, sway) {
  const a = road.ahead[0];
  const b = road.ahead[road.ahead.length - 1];
  const curve = Math.abs(turn) / (Math.hypot(b.x - a.x, b.y - a.y) || 1); // radians a unit of road
  return curve > 1e-6 ? (rate * L.corner * (1 + sway * 0.3)) / curve : Infinity;
}

/** How much the road bends over the next stretch (radians). */
function bend(road) {
  const a = road.ahead;
  return angleDiff(a[a.length - 1].angle, a[0].angle);
}

/** Let go of everything (the race is over for it). */
function stop(memory) {
  memory.kartDriving = false;
  return { type: 'drive', steer: 0, gas: false, brake: false, drift: false, botDelayMs: 200 };
}
