/**
 * The computer opponent for Light Cycles (see `bot` in index.js). Each step it looks at the
 * three ways it can go and never rides into a wall or a trail when it has a way out. Like a person
 * it times its own turns, but takes in your trail a human reaction time late (bot-human.js): a
 * turn your latest cells force on it comes a reaction time later, so a sudden move can catch it out.
 *   easy:   rides straight until something's close, then turns to the more open side.
 *   normal: picks the way that gives it the most of the arena it can reach before you can, and
 *           keeps clear of your front wheel.
 *   hard:   the same, and it sees you sooner and times its turns tighter.
 */
import { flood, laggedSight } from './snake-bot.js';
import { REACTION, reactionMs } from './bot-human.js';

// How neatly it times a turn it planned: Normal and Hard tap it in time for the cell they meant;
// a novice (Easy) taps when it gets round to it, late now and then.
const PRESS_MS = { easy: [60, 220], normal: [20, 50], hard: [10, 30] };

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function tronBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !['easy', 'normal', 'hard'].includes(level) || view.phase !== 'play' || !view.cycles) return null;
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
  const [hx, hy] = me.path[me.path.length - 1];
  const noise = {}; // (the same tie-breaks both times it weighs things up)
  for (const dir of Object.keys(DIRS)) noise[dir] = rng() * (level === 'easy' ? 2 : 0.1);
  let theirs = null;
  let was = null; // their front wheel a reaction time ago, and the trail they've drawn since
  const since = [];
  if (them && !them.crashed) {
    theirs = them.path[them.path.length - 1];
    was = laggedSight(memory, 'tron', view.round, hx + ',' + hy, theirs.slice(), REACTION[level].median, view.tickMs);
    const log = memory.tron.ticks;
    const back = Math.round(REACTION[level].median / Math.max(40, view.tickMs || 100));
    for (let i = Math.max(1, log.length - back); i < log.length; i++) since.push(log[i].state);
  }
  // Its own turns it plans and taps in time; a swerve your latest cells force on it (they block
  // the way ahead that was clear as it last took you in) takes it a reaction time.
  const now = choose(view, level, blocked, [hx, hy], theirs, noise, them && them.dir);
  if (now === view.dir) return null;
  const [sx, sy] = DIRS[view.dir];
  const ahead = [1, 2].map((k) => [hx + sx * k, hy + sy * k]);
  const forced = was && since.some(([x, y]) => ahead.some(([ax, ay]) => ax === x && ay === y));
  return { type: 'turn', dir: now, ...(forced ? { botDelayMs: reactionMs(level, rng) } : { botDelayMs: PRESS_MS[level][0] + rng() * (PRESS_MS[level][1] - PRESS_MS[level][0]), botAnticipate: level !== 'easy' }) };
}

/** The way it would go on these trails, with their front wheel at `theirs`. */
function choose(view, level, blocked, [hx, hy], theirs, noise, theirDir) {
  const { w, h } = view.grid;
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !blocked[y * w + x];
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
      score = run >= 3 && dir === view.dir ? 100 : run; // straight on while it's clear
    } else {
      blocked[ny * w + nx] = 1;
      score = theirs ? territory(blocked, w, h, [nx, ny], theirs) : flood(blocked, w, h, nx, ny, 2000);
      blocked[ny * w + nx] = 0;
      // Keep clear of where their front wheel will be next tick (a head-on is a crash for both).
      const [tdx, tdy] = DIRS[theirDir] || [0, 0];
      const near = theirs ? Math.abs(theirs[0] + tdx - nx) + Math.abs(theirs[1] + tdy - ny) : 99;
      if (near <= 2) score -= 500;
    }
    if (dir === view.dir) score += 0.5; // (no needless wiggling)
    options.push({ dir, score: score + noise[dir] });
  }
  return options.reduce((a, b) => (b.score > a.score ? b : a)).dir;
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
