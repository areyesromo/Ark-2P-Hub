/**
 * The computer opponent for Sumo (see `bot` in index.js). It gets between you and the middle of
 * the ring and shoves you outwards, dashing when it's lined up, and backs off its own edge first.
 * It steers a human reaction time after it sees things (bot-human.js).
 *   easy:   charges straight at you, dashes too soon, and cuts it fine at the edge.
 *   normal: comes at you from the middle side, and dashes a little early.
 *   hard:   waits until you're close to dash, keeps clear of the edge, and steps aside from a dash
 *           it isn't lined up to meet.
 */
import { reactionMs } from './bot-human.js';

// margin: how far from the rim it turns back; lead: how far ahead (s) it guesses where you'll be;
// dash: how close before it dashes. (Tried out: dashing from about 2 wins most often; too far out
// wastes it, and guessing ahead overshoots you.)
export const LEVEL = { easy: { margin: 0.6, lead: 0.3, dash: 3.2 }, normal: { margin: 1.1, lead: 0.15, dash: 2.6 }, hard: { margin: 1.1, lead: 0, dash: 2 } };

export function sumoBot(view, level, rng = Math.random) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.discs) return null;
  const me = view.discs[view.you];
  const foe = view.discs[1 - view.you];
  if (me.out || foe.out) return null;
  const { x: cx, y: cy, r: ringR } = view.ring;
  const pace = reactionMs(level, rng);
  const move = (dx, dy) => {
    const d = Math.hypot(dx, dy) || 1;
    return { type: 'move', x: dx / d, y: dy / d, botDelayMs: pace };
  };
  // Too near the rim (and heading out): back towards the middle first.
  const myR = Math.hypot(me.x - cx, me.y - cy);
  const outward = (me.x - cx) * me.vx + (me.y - cy) * me.vy > 0;
  if (myR > ringR - L.margin && (outward || myR > ringR - view.playerR * 1.2)) return move(cx - me.x, cy - me.y);
  // Where they'll be a moment from now.
  const fx = foe.x + foe.vx * L.lead;
  const fy = foe.y + foe.vy * L.lead;
  const fr = Math.hypot(fx - cx, fy - cy) || 1;
  const ox = (fx - cx) / fr; // outwards, through them
  const oy = (fy - cy) / fr;
  const dist = Math.hypot(fx - me.x, fy - me.y);
  // Lined up: coming at them from the middle side.
  const along = ((fx - me.x) * ox + (fy - me.y) * oy) / (dist || 1);
  // Lined up from the middle side, or it's the one nearer the rim (then it shoves back now).
  const lined = level === 'easy' || along > 0.7 || myR > fr;
  // Hard: a dash coming at it when it isn't lined up to meet it: step aside.
  if (level === 'hard' && !lined && foe.dashing) {
    const ax = me.x - foe.x;
    const ay = me.y - foe.y;
    const side = (ax * foe.vy - ay * foe.vx) >= 0 ? 1 : -1;
    return move(-foe.vy * side + (cx - me.x) * 0.3, foe.vx * side + (cy - me.y) * 0.3);
  }
  if (lined) {
    const ready = me.dashIn === 0;
    const worth = dist < L.dash;
    if (ready && worth) return { type: 'dash', botDelayMs: pace };
    return move(fx - me.x, fy - me.y);
  }
  // Get round to the middle side of them first.
  const spotX = fx - ox * view.playerR * 3;
  const spotY = fy - oy * view.playerR * 3;
  return move(spotX - me.x, spotY - me.y);
}
