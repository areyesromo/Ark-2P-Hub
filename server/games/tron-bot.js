/**
 * The computer opponent for Light Cycles (see `bot` in index.js). Each step it looks at the
 * three ways it can go and never rides into a wall or a trail when it has a way out.
 *   easy:   rides straight until something's close, then turns to the more open side.
 *   normal: picks the way with the most room left (a flood fill).
 *   hard:   picks the way that gives it the most of the arena it can reach before you can, and
 *           keeps away from your front wheel.
 */
import { flood } from './snake-bot.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const REACT = { easy: [40, 110], normal: [20, 45], hard: [8, 20] };

export function tronBot(view, level, rng = Math.random) {
  if (!view || !REACT[level] || view.phase !== 'play' || !view.cycles) return null;
  const me = view.cycles[view.you];
  const them = view.cycles[1 - view.you];
  if (!me || me.crashed) return null;
  const { w, h } = view.grid;
  const blocked = new Uint8Array(w * h);
  // The trails, corner to corner.
  for (const c of view.cycles) {
    const path = c.path;
    for (let i = 0; i < path.length; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1] || path[i];
      const dx = Math.sign(bx - ax);
      const dy = Math.sign(by - ay);
      for (let x = ax, y = ay, n = 0; n <= Math.abs(bx - ax) + Math.abs(by - ay); n++, x += dx, y += dy) {
        if (x >= 0 && y >= 0 && x < w && y < h) blocked[y * w + x] = 1;
      }
    }
  }
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !blocked[y * w + x];
  const [hx, hy] = me.path[me.path.length - 1];
  const theirs = them && !them.crashed ? them.path[them.path.length - 1] : null;
  const options = [];
  for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
    if (dir === OPPOSITE[view.dir]) continue;
    const nx = hx + dx;
    const ny = hy + dy;
    if (!free(nx, ny)) { options.push({ dir, score: -1e9 }); continue; }
    let score;
    if (level === 'easy') {
      let run = 0;
      while (run < 12 && free(nx + dx * run, ny + dy * run)) run++;
      score = run >= 3 && dir === view.dir ? 100 : run + rng() * 2; // straight on while it's clear
    } else if (level === 'normal') {
      score = flood(blocked, w, h, nx, ny, 600);
    } else {
      blocked[ny * w + nx] = 1;
      score = theirs ? territory(blocked, w, h, [nx, ny], theirs) : flood(blocked, w, h, nx, ny, 2000);
      blocked[ny * w + nx] = 0;
      if (theirs && Math.abs(theirs[0] - nx) + Math.abs(theirs[1] - ny) <= 1) score -= 500; // a head-on
    }
    if (dir === view.dir) score += 0.5; // (no needless wiggling)
    options.push({ dir, score: score + rng() * 0.1 });
  }
  const best = options.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.dir === view.dir) return null;
  const [lo, hi] = REACT[level];
  return { type: 'turn', dir: best.dir, botDelayMs: lo + rng() * (hi - lo) };
}

/** The cells I get to before them, less the ones they get to first (a race out from both heads). */
function territory(blocked, w, h, mine, theirs) {
  const dist = [new Int32Array(w * h).fill(-1), new Int32Array(w * h).fill(-1)];
  let score = 0;
  [mine, theirs].forEach(([x, y], who) => {
    const queue = [y * w + x];
    dist[who][y * w + x] = 0;
    for (let q = 0; q < queue.length; q++) {
      const k = queue[q];
      const cx = k % w;
      const cy = (k - cx) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = cx + dx;
        const ay = cy + dy;
        if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
        const j = ay * w + ax;
        if (blocked[j] || dist[who][j] !== -1) continue;
        dist[who][j] = dist[who][k] + 1;
        queue.push(j);
      }
    }
  });
  for (let k = 0; k < w * h; k++) {
    const a = dist[0][k];
    const b = dist[1][k];
    if (a !== -1 && (b === -1 || a < b)) score++;
    else if (b !== -1 && (a === -1 || b < a)) score--;
  }
  return score;
}
