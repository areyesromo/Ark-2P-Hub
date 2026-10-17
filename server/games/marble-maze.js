// Marble Maze: a co-op 3D tilting maze. A marble rolls on a board the two of
// you tilt together: one tilts it left and right, the other forwards and
// back (or, in shared mode, you both steer everything). Roll the marble to
// the goal without dropping it down a hole; faster runs earn more stars.
// Phones use the joystick, D-pad or tilt pad; controllers use the stick.
// The TV draws it in 3D (three.js).
//
// Same loop as Sumo/Tank Duel: physics at 60 Hz, ~30 views a second.

import { settingOf } from './options.js';

export const LEVELS = [
  { name: 'First roll', map: [
    '#############',
    '#S....#.....#',
    '#.###.#.###.#',
    '#...#...#...#',
    '###.#####.###',
    '#...#...#...#',
    '#.###.#.###.#',
    '#.....#....G#',
    '#############',
  ] },
  { name: 'Swiss cheese', map: [
    '#############',
    '#S..........#',
    '#..O....O...#',
    '#.....O.....#',
    '#..O.....O..#',
    '#.....O.....#',
    '#.O.......O.#',
    '#.....O....G#',
    '#############',
  ] },
  { name: 'Zigzag', map: [
    '#############',
    '#S..........#',
    '#...........#',
    '#########...#',
    '#..O........#',
    '#.......O...#',
    '#...#########',
    '#.....O.....#',
    '#..O........#',
    '#G..........#',
    '#############',
  ] },
  { name: 'Narrow escape', map: [
    '###############',
    '#S..#.........#',
    '#....O........#',
    '#.O.#....#G#..#',
    '#...#.O..#.#..#',
    '#...#....#.#O.#',
    '#........O....#',
    '#..O......#...#',
    '###############',
  ] },
  { name: 'The gauntlet', map: [
    '###############',
    '#S.O....O....O#',
    '#....O.....O..#',
    '##########.####',
    '#..O.......O..#',
    '#....O..O.....#',
    '#.#############',
    '#..O....O....G#',
    '#....O........#',
    '###############',
  ] },
];

export const MARBLE = { r: 0.3, accel: 9, drag: 0.9, maxSpeed: 6, bounce: 0.35 };
export const HOLE_R = 0.36; // the marble drops in once its centre is this close
export const GOAL_R = 0.4;
export const TILT = { rate: 4 }; // how fast the board follows the sticks (full tilt per second x rate)
export const PHYSICS = { tickMs: 1000 / 60, sendEvery: 2, substeps: 2 };
export const TIMING = { introMs: 3000, fallMs: 1200, clearMs: 3500, levelMs: 120000 };
export const MODES = { 1: 'split', 2: 'shared' };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A level's map, parsed: walls, holes, start, goal, and the shortest path length (in cells) for its par time. */
export function parseLevel(level) {
  const walls = [];
  const holes = [];
  let start = null;
  let goal = null;
  level.map.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '#') walls.push([x, y]);
    if (c === 'O') holes.push({ x: x + 0.5, y: y + 0.5 });
    if (c === 'S') start = { x: x + 0.5, y: y + 0.5 };
    if (c === 'G') goal = { x: x + 0.5, y: y + 0.5 };
  }));
  const path = shortestPath(level.map);
  return {
    name: level.name, map: level.map, w: level.map[0].length, h: level.map.length,
    walls, holes, start, goal, path, parMs: Math.round(path * 900 + 5000),
  };
}

/** Cells from S to G, going round walls and holes (null if there's no way). */
export function shortestPath(map) {
  let s = null;
  map.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'S') s = [x, y]; }));
  const dist = new Map([[s.join(), 0]]);
  const queue = [s];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (map[y][x] === 'G') return dist.get(x + ',' + y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const c = map[ny] && map[ny][nx];
      if (!c || c === '#' || c === 'O' || dist.has(nx + ',' + ny)) continue;
      dist.set(nx + ',' + ny, dist.get(x + ',' + y) + 1);
      queue.push([nx, ny]);
    }
  }
  return null;
}

export class MarbleMaze {
  constructor(ctx) {
    this.ctx = ctx;
    this.levelCount = clamp(settingOf(ctx, 'levels', 3), 1, LEVELS.length);
    this.mode = MODES[settingOf(ctx, 'controls', 1)] || 'split';
    this.timer = null;
  }

  start() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.levelIndex = -1;
    this.stars = 0;
    this.history = []; // { name, ms, falls, stars }
    this.controls = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.nextLevel();
    this.last = this.ctx.now();
    this.frame = 0;
    this.loop();
  }

  nextLevel() {
    this.levelIndex++;
    this.level = parseLevel(LEVELS[this.levelIndex]);
    this.falls = 0;
    this.result = null;
    this.tilt = { x: 0, y: 0 };
    this.respawn();
    this.enter('intro', TIMING.introMs);
  }

  respawn() {
    this.marble = { x: this.level.start.x, y: this.level.start.y, vx: 0, vy: 0, z: 0 };
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  loop() {
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.tick();
      if (this.phase !== 'over') this.loop();
    }, PHYSICS.tickMs);
  }

  /** Where the sticks want the board: split, P1 left/right and P2 forwards/back; shared, both add up. */
  target() {
    const [a, b] = this.controls;
    if (this.mode === 'split') return { x: a.x, y: b.y };
    return { x: clamp(a.x + b.x, -1, 1), y: clamp(a.y + b.y, -1, 1) };
  }

  tick() {
    const now = this.ctx.now();
    const dt = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    const before = this.phase;

    if (this.phase === 'intro' && now >= this.phaseEnds) {
      this.phase = 'play';
      this.startedAt = now;
      this.phaseEnds = null;
    } else if (this.phase === 'fall' && now >= this.phaseEnds) {
      this.respawn();
      this.phase = 'play';
      this.phaseEnds = null;
    } else if (this.phase === 'clear' && now >= this.phaseEnds) {
      if (this.levelIndex + 1 >= this.levelCount) return this.finish();
      this.nextLevel();
    }

    // The board follows the sticks smoothly (even between levels, so it can level out).
    const t = this.target();
    const k = Math.min(1, TILT.rate * dt);
    this.tilt.x += (t.x - this.tilt.x) * k;
    this.tilt.y += (t.y - this.tilt.y) * k;

    if (this.phase === 'play') {
      const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000))) * PHYSICS.substeps;
      for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps);
      if (this.phase === 'play' && now - this.startedAt >= TIMING.levelMs) this.endLevel(false);
    } else if (this.phase === 'fall') {
      this.marble.z = Math.min(1, this.marble.z + dt * 2.5); // sinking into the hole
    }

    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  step(dt) {
    const m = this.marble;
    m.vx += this.tilt.x * MARBLE.accel * dt;
    m.vy += this.tilt.y * MARBLE.accel * dt;
    const drag = Math.max(0, 1 - MARBLE.drag * dt);
    m.vx *= drag;
    m.vy *= drag;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed > MARBLE.maxSpeed) {
      m.vx *= MARBLE.maxSpeed / speed;
      m.vy *= MARBLE.maxSpeed / speed;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    this.collide(m);
    const { goal } = this.level;
    if (Math.hypot(m.x - goal.x, m.y - goal.y) < GOAL_R) return this.endLevel(true);
    const hole = this.level.holes.find((h) => Math.hypot(m.x - h.x, m.y - h.y) < HOLE_R);
    if (hole) {
      this.falls++;
      m.x = hole.x;
      m.y = hole.y;
      m.vx = m.vy = 0;
      this.enter('fall', TIMING.fallMs);
    }
  }

  /** Bounce off the wall blocks around the marble. */
  collide(m) {
    const r = MARBLE.r;
    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        const row = this.level.map[y];
        if (!row || row[x] !== '#') continue;
        const px = clamp(m.x, x, x + 1);
        const py = clamp(m.y, y, y + 1);
        const dx = m.x - px;
        const dy = m.y - py;
        const d = Math.hypot(dx, dy);
        if (d >= r || d === 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        m.x = px + nx * r;
        m.y = py + ny * r;
        const vn = m.vx * nx + m.vy * ny;
        if (vn < 0) {
          m.vx -= (1 + MARBLE.bounce) * vn * nx;
          m.vy -= (1 + MARBLE.bounce) * vn * ny;
        }
      }
    }
  }

  /** Stars for a level: 3 within par, 2 within twice par, 1 for getting there at all. */
  starsFor(cleared, ms) {
    if (!cleared) return 0;
    return ms <= this.level.parMs ? 3 : ms <= 2 * this.level.parMs ? 2 : 1;
  }

  endLevel(cleared) {
    const ms = this.ctx.now() - this.startedAt;
    const stars = this.starsFor(cleared, ms);
    this.stars += stars;
    this.result = { cleared, ms, falls: this.falls, stars };
    this.history.push({ name: this.level.name, ...this.result });
    if (cleared) {
      this.marble.vx = this.marble.vy = 0;
      this.marble.x = this.level.goal.x;
      this.marble.y = this.level.goal.y;
    }
    this.enter('clear', TIMING.clearMs);
  }

  finish() {
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'move' && Number.isFinite(input.x) && Number.isFinite(input.y)) {
      this.controls[slot] = { x: clamp(input.x, -1, 1), y: clamp(input.y, -1, 1) };
    }
  }

  /** Which way each player tilts the board. */
  axisOf(slot) {
    return this.mode === 'shared' ? 'both' : slot === 0 ? 'x' : 'y';
  }

  view() {
    const now = this.ctx.now();
    const m = this.marble;
    const lv = this.level;
    return {
      phase: this.phase,
      mode: this.mode,
      levelIndex: this.levelIndex,
      levels: this.levelCount,
      level: { name: lv.name, map: lv.map, w: lv.w, h: lv.h, parMs: lv.parMs },
      marble: { x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy },
      tilt: { x: this.tilt.x, y: this.tilt.y },
      axes: [this.axisOf(0), this.axisOf(1)],
      elapsedMs: this.phase === 'play' || this.phase === 'fall' ? now - this.startedAt : this.result ? this.result.ms : 0,
      falls: this.falls,
      countdown: this.phase === 'intro' ? Math.ceil(Math.max(0, this.phaseEnds - now) / 1000) : 0,
      result: this.result,
      history: this.history,
      stars: this.stars,
      maxStars: this.levelCount * 3,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot, axis: this.axisOf(slot) });
  }
}

export default {
  id: 'marble-maze',
  name: 'Marble Maze',
  category: 'casual',
  music: 'casual',
  tagline: 'Co-op 3D: tilt the board together to roll the marble to the goal. One of you tilts left and right, the other forwards and back. Mind the holes!',
  create: (ctx) => new MarbleMaze(ctx),
};
