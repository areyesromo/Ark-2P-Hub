/**
 * The computer opponent for Snake Battle (see `bot` in index.js). Each step it looks at the three
 * ways it can go: never into a wall or a body when it has a way out, the one with the most room
 * left (a flood fill), and the nearest food. Like a person it plans its own turns and taps them in
 * time, but takes in your snake a human reaction time late (bot-human.js): a turn your latest move
 * forces on it comes a reaction time later, so a sudden move of yours can catch it out.
 *   easy:   avoids what's right in front of it, heads for food, and is sometimes late to turn.
 *   normal: checks it won't box itself in.
 *   hard:   quick, finds the way round to food, keeps away from your head, and once it's longer
 *           it hems you in.
 */
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
import { REACTION, reactionMs } from './bot-human.js';

const LEVELS = ['easy', 'normal', 'hard'];
// How neatly it times a turn it planned: Normal and Hard tap it in time for the cell they meant;
// a novice (Easy) taps when it gets round to it, late now and then.
const PRESS_MS = { easy: [60, 220], normal: [25, 80], hard: [15, 40] };

export function snakeBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !LEVELS.includes(level) || view.phase !== 'play' || !view.snakes) return null;
  const me = view.snakes[view.you];
  const them = view.snakes[1 - view.you];
  if (!me || me.crashed) return null;
  // Your snake as it saw it a reaction time ago (a copy: the game's arrays move on).
  const snap = them ? { body: them.body.map((c) => c.slice()), crashed: them.crashed } : null;
  const seen = snap ? laggedSight(memory, 'snake', view.round, me.body[0].join() + ':' + me.body.length, snap, REACTION[level].median, view.tickMs) : null;
  const noise = {}; // (the same tie-breaks both times it weighs things up)
  for (const dir of Object.keys(DIRS)) noise[dir] = rng() * (level === 'easy' ? 15 : 0.5);
  // Its own turns it plans and taps in time; a swerve your latest move forces on it (your head
  // now in the way ahead that was clear as it last took you in) takes it a reaction time.
  const now = choose(view, level, me, them, noise);
  if (now === view.dir) return null;
  const [sx, sy] = DIRS[view.dir];
  const [hx, hy] = me.body[0];
  const inWay = (s) => s && s.body.slice(0, 3).some(([x, y]) => [1, 2].some((k) => x === hx + sx * k && y === hy + sy * k));
  const forced = seen && inWay(them) && !inWay(seen);
  return { type: 'turn', dir: now, ...(forced ? { botDelayMs: reactionMs(level, rng) } : { botDelayMs: PRESS_MS[level][0] + rng() * (PRESS_MS[level][1] - PRESS_MS[level][0]), botAnticipate: level !== 'easy' }) };
}

/** The way it would go, with the rival as `them`. */
function choose(view, level, me, them, noise) {
  const { w, h } = view.grid;
  const blocked = new Uint8Array(w * h);
  // Bodies (a tail moves on, so its last cell is free next step).
  for (const s of [me, them]) if (s) s.body.forEach(([x, y], i) => { if (i < s.body.length - 1) blocked[y * w + x] = 1; });
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !blocked[y * w + x];
  const [hx, hy] = me.body[0];
  const theirHead = them && !them.crashed ? them.body[0] : null;
  const food = view.food || [];
  const options = [];
  for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
    if (dir === OPPOSITE[view.dir]) continue;
    const nx = hx + dx;
    const ny = hy + dy;
    if (!free(nx, ny)) { options.push({ dir, score: -1e9 }); continue; }
    let score = 0;
    if (level !== 'easy') {
      const room = flood(blocked, w, h, nx, ny, me.body.length * 2 + 10);
      score += room < me.body.length + 2 ? room * 50 - 1e6 : Math.min(room, 60) * 4; // don't box yourself in
    }
    // The nearest food: as the crow flies, or (Hard) by the way round the bodies.
    let best = Infinity;
    if (level === 'hard') best = pathToFood(blocked, w, h, nx, ny, food);
    else for (const [fx, fy] of food) best = Math.min(best, Math.abs(fx - nx) + Math.abs(fy - ny));
    if (best < Infinity) score -= best * 10;
    // Hard, longer than you and close: it hems you in (the less room your head has, the better).
    if (level === 'hard' && theirHead && me.body.length > them.body.length && Math.abs(theirHead[0] - nx) + Math.abs(theirHead[1] - ny) < 8) {
      blocked[ny * w + nx] = 1;
      const theirRoom = flood(blocked, w, h, theirHead[0], theirHead[1], 80);
      blocked[ny * w + nx] = 0;
      score += (80 - theirRoom) * 3;
    }
    if (level === 'hard' && theirHead && Math.abs(theirHead[0] - nx) + Math.abs(theirHead[1] - ny) <= 1) score -= 5000; // a head-on
    if (dir === view.dir) score += 1; // (no needless wiggling)
    options.push({ dir, score: score + noise[dir] });
  }
  return options.reduce((a, b) => (b.score > a.score ? b : a)).dir;
}

/**
 * What the computer has seen of its rival: their state a human reaction time ago. Each tick's
 * `state` (keyed by `tick`) goes into `memory`; it gets back the one about `lagMs` old.
 */
export function laggedSight(memory, name, round, tick, state, lagMs, tickMs) {
  const seen = (memory[name] = memory[name] && memory[name].round === round ? memory[name] : { round, ticks: [] });
  if (!seen.ticks.length || seen.ticks[seen.ticks.length - 1].tick !== tick) seen.ticks.push({ tick, state });
  const back = Math.round(lagMs / Math.max(40, tickMs || 100));
  if (seen.ticks.length > back + 30) seen.ticks.splice(0, seen.ticks.length - back - 30);
  return seen.ticks[Math.max(0, seen.ticks.length - 1 - back)].state;
}


/** How many steps to the nearest food going round the bodies (Infinity: none it can reach). */
function pathToFood(blocked, w, h, x, y, food) {
  const want = new Set(food.map(([fx, fy]) => fy * w + fx));
  if (!want.size) return Infinity;
  const dist = new Int32Array(w * h).fill(-1);
  const queue = [y * w + x];
  dist[y * w + x] = 0;
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    if (want.has(k)) return dist[k];
    const cx = k % w;
    const cy = (k - cx) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = cx + dx;
      const ay = cy + dy;
      if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
      const j = ay * w + ax;
      if (dist[j] !== -1 || blocked[j]) continue;
      dist[j] = dist[k] + 1;
      queue.push(j);
    }
  }
  return Infinity;
}

/** How many cells can be reached from (x, y), up to `cap`. */
export function flood(blocked, w, h, x, y, cap) {
  const seen = new Uint8Array(w * h);
  const stack = [y * w + x];
  seen[y * w + x] = 1;
  let n = 0;
  while (stack.length && n < cap) {
    const k = stack.pop();
    n++;
    const cx = k % w;
    const cy = (k - cx) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = cx + dx;
      const ay = cy + dy;
      if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
      const j = ay * w + ax;
      if (seen[j] || blocked[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return n;
}
