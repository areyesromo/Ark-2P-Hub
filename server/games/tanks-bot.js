/**
 * The computer opponent for Tank Duel (see `bot` in index.js). It reads the field the TV shows.
 * With a clear line to you it turns to face you and fires; without one it drives round the cover
 * towards you (a path on a coarse grid); and it steps aside from shells coming its way.
 * Its aim wobbles a little each shot, as a person's does, and it reacts at human speed
 * (bot-human.js).
 *   easy:   slow, aims loosely (many shots miss), never dodges.
 *   normal: a steadier aim, and dodges shells that are close.
 *   hard:   quicker, aims tight, and dodges early.
 */
import { TANK, SHELL } from './tanks.js';
import { reactionMs } from './bot-human.js';

// aim: how far its aim strays (radians, a new wobble each shot, as a person's does); dodge: how
// far ahead (s) it sees a shell coming.
const LEVEL = {
  easy: { aim: 0.12, dodge: 0 },
  normal: { aim: 0.06, dodge: 0.7 },
  hard: { aim: 0.03, dodge: 1.1 },
};
const CELL = 0.5;

export function tanksBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.tanks) return null;
  const me = view.tanks[view.you];
  const foe = view.tanks[1 - view.you];
  if (!me || !me.alive || !foe || !foe.alive) return null;
  const pace = reactionMs(level, rng); // (a human reaction: bot-human.js)
  const move = (dx, dy, mag) => {
    const d = Math.hypot(dx, dy) || 1;
    return { type: 'move', x: (dx / d) * mag, y: (dy / d) * mag, botDelayMs: pace };
  };
  const walls = view.obstacles;
  const { w, h } = view.field;

  // A shell coming our way: step aside (across its path, to the clearer side).
  if (L.dodge) {
    for (const s of view.shells) {
      if (s.owner === view.you) continue;
      const rx = me.x - s.x;
      const ry = me.y - s.y;
      const v2 = s.vx * s.vx + s.vy * s.vy;
      const t = (rx * s.vx + ry * s.vy) / v2; // seconds to its closest point
      if (t < 0 || t > L.dodge) continue;
      const miss = Math.hypot(rx - s.vx * t, ry - s.vy * t);
      if (miss > TANK.r + SHELL.r + 0.25) continue;
      const side = (rx * s.vy - ry * s.vx) >= 0 ? 1 : -1;
      let ax = s.vy * side;
      let ay = -s.vx * side;
      if (!open(me.x + ax / Math.hypot(ax, ay), me.y + ay / Math.hypot(ax, ay), walls, w, h)) { ax = -ax; ay = -ay; }
      return move(ax, ay, 1);
    }
  }

  const dx = foe.x - me.x;
  const dy = foe.y - me.y;
  const clear = lineClear(me.x, me.y, foe.x, foe.y, walls);
  if (clear) {
    // Where it means to shoot: at you, give or take this shot's wobble.
    if (memory.tankAim === undefined || view.ready !== memory.tankReady) memory.tankAim = (rng() * 2 - 1) * L.aim;
    memory.tankReady = view.ready;
    const want = Math.atan2(dy, dx) + memory.tankAim;
    const off = Math.abs(Math.atan2(Math.sin(want - me.angle), Math.cos(want - me.angle)));
    if (off < 0.05 && view.ready) return { type: 'fire', botDelayMs: pace };
    // Turn to face them (a tank faces the way it drives): closing in from afar, barely creeping
    // up close.
    const dist = Math.hypot(dx, dy);
    return move(dx, dy, dist > 5 ? 0.6 : dist < 2.5 ? 0.16 : 0.25);
  }
  // No clear line: round the cover towards them.
  const step = route(me, foe, walls, w, h);
  return step ? move(step[0] - me.x, step[1] - me.y, 1) : move(dx, dy, 1);
}

/** Can a tank stand here: on the field, clear of the cover? */
function open(x, y, walls, w, h) {
  const r = TANK.r;
  if (x < r || y < r || x > w - r || y > h - r) return false;
  return !walls.some((o) => x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r);
}

/** A straight line between two points crosses no cover. */
function lineClear(ax, ay, bx, by, walls) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
  for (let i = 1; i < n; i++) {
    const x = ax + ((bx - ax) * i) / n;
    const y = ay + ((by - ay) * i) / n;
    if (walls.some((o) => x > o.x - SHELL.r && x < o.x + o.w + SHELL.r && y > o.y - SHELL.r && y < o.y + o.h + SHELL.r)) return false;
  }
  return true;
}

/** The next point on the shortest path (on a coarse grid of open spots) from `me` to `foe`. */
function route(me, foe, walls, w, h) {
  const cw = Math.floor(w / CELL);
  const ch = Math.floor(h / CELL);
  const at = (p) => [Math.min(cw - 1, Math.floor(p.x / CELL)), Math.min(ch - 1, Math.floor(p.y / CELL))];
  const centre = (c) => [(c % cw + 0.5) * CELL, (Math.floor(c / cw) + 0.5) * CELL];
  const ok = new Uint8Array(cw * ch);
  for (let c = 0; c < cw * ch; c++) { const [x, y] = centre(c); ok[c] = open(x, y, walls, w, h) ? 1 : 0; }
  const [fx, fy] = at(foe);
  const [mx, my] = at(me);
  const dist = new Int32Array(cw * ch).fill(-1);
  const start = fy * cw + fx;
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    const cx = k % cw;
    const cy = (k - cx) / cw;
    for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ax = cx + ddx;
      const ay = cy + ddy;
      if (ax < 0 || ay < 0 || ax >= cw || ay >= ch) continue;
      const j = ay * cw + ax;
      if (dist[j] !== -1 || (!ok[j] && j !== start)) continue;
      dist[j] = dist[k] + 1;
      queue.push(j);
    }
  }
  // The neighbouring spot closest (by the path) to them.
  let best = null;
  let bestD = Infinity;
  for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ax = mx + ddx;
    const ay = my + ddy;
    if (ax < 0 || ay < 0 || ax >= cw || ay >= ch) continue;
    const j = ay * cw + ax;
    if (dist[j] !== -1 && ok[j] && dist[j] < bestD) { bestD = dist[j]; best = centre(j); }
  }
  return best;
}
