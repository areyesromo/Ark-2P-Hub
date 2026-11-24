// Sokoban. You're the warehouse worker: push every box onto a target. You can
// push one box at a time, never pull, so a box shoved into a corner is stuck
// (undo, or start the level again). Ten levels, each opened by solving the one
// before. Score: the moves it took (fewer is better), per level; each has a par.

import { settingOf } from './options.js';
import { LEVELS } from './sokoban-levels.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** A level's text as { w, h, walls, targets, boxes, worker } (cells are y * w + x). */
export function parse(text) {
  const lines = text.replace(/^\n/, '').split('\n');
  const w = Math.max(...lines.map((l) => l.length));
  const out = { w, h: lines.length, walls: [], targets: [], boxes: [], worker: 0 };
  lines.forEach((line, y) => {
    [...line.padEnd(w)].forEach((ch, x) => {
      const i = y * w + x;
      if (ch === '#') out.walls.push(i);
      if ('.*+'.includes(ch)) out.targets.push(i);
      if ('$*'.includes(ch)) out.boxes.push(i);
      if ('@+'.includes(ch)) out.worker = i;
    });
  });
  // The floor: what the worker can reach (the blank outside the walls isn't drawn).
  const walls = new Set(out.walls);
  const floor = new Set([out.worker]);
  const todo = [out.worker];
  while (todo.length) {
    const i = todo.pop();
    for (const [dx, dy] of Object.values(DIRS)) {
      const x = (i % w) + dx;
      const y = Math.floor(i / w) + dy;
      const j = y * w + x;
      if (x >= 0 && y >= 0 && x < w && y < out.h && !walls.has(j) && !floor.has(j)) {
        floor.add(j);
        todo.push(j);
      }
    }
  }
  out.floor = [...floor].sort((a, b) => a - b);
  return out;
}

export class Sokoban {
  constructor(ctx) {
    this.ctx = ctx;
    const n = settingOf(ctx, 'level', 1);
    this.levelNo = Number.isInteger(n) && n >= 1 && n <= LEVELS.length ? n : 1;
    this.level = parse(LEVELS[this.levelNo - 1].map);
    this.walls = new Set(this.level.walls);
  }

  start() {
    this.boxes = this.level.boxes.slice();
    this.worker = this.level.worker;
    this.moves = 0;
    this.pushes = 0;
    this.history = []; // { worker, box (index moved, from) } to undo
    this.restarts = 0;
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.phase = 'play';
    this.ctx.update();
  }

  move(dir) {
    const { w, h } = this.level;
    const [dx, dy] = DIRS[dir];
    const step = (i) => {
      const x = (i % w) + dx;
      const y = Math.floor(i / w) + dy;
      return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
    };
    const to = step(this.worker);
    if (to < 0 || this.walls.has(to)) return false;
    const b = this.boxes.indexOf(to);
    let push = null;
    if (b !== -1) {
      const beyond = step(to);
      if (beyond < 0 || this.walls.has(beyond) || this.boxes.includes(beyond)) return false;
      push = { box: b, from: to };
      this.boxes[b] = beyond;
      this.pushes++;
    }
    this.history.push({ worker: this.worker, push });
    this.worker = to;
    this.moves++;
    if (this.solved()) {
      this.phase = 'over';
      this.endedAt = this.ctx.now();
    }
    return true;
  }

  undo() {
    const last = this.history.pop();
    if (!last) return false;
    this.worker = last.worker;
    if (last.push) {
      this.boxes[last.push.box] = last.push.from;
      this.pushes--;
    }
    this.moves--; // an undone move doesn't count
    return true;
  }

  solved() {
    return this.boxes.every((b) => this.level.targets.includes(b));
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    let changed = false;
    if (input.type === 'move' && Object.prototype.hasOwnProperty.call(DIRS, input.dir)) changed = this.move(input.dir);
    else if (input.type === 'undo') changed = this.undo();
    else if (input.type === 'restart' && this.history.length) {
      // Back to the start of the level; the clock keeps going.
      this.boxes = this.level.boxes.slice();
      this.worker = this.level.worker;
      this.moves = 0;
      this.pushes = 0;
      this.history = [];
      this.restarts++;
      changed = true;
    }
    if (changed) this.ctx.update();
  }

  view() {
    const L = this.level;
    return {
      phase: this.phase,
      levelNo: this.levelNo,
      levels: LEVELS.length,
      w: L.w,
      h: L.h,
      walls: L.walls,
      floor: L.floor,
      targets: L.targets,
      boxes: this.boxes,
      worker: this.worker,
      moves: this.moves,
      pushes: this.pushes,
      par: LEVELS[this.levelNo - 1].par,
      onTarget: this.boxes.filter((b) => L.targets.includes(b)).length,
      restarts: this.restarts,
      elapsed: (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt,
      score: this.phase === 'over' ? this.moves : null,
      variant: 'Level ' + this.levelNo,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

export default {
  id: 'sokoban',
  name: 'Sokoban',
  tagline: 'Push every box onto a target. You can only push, never pull: think before you shove.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'moves' },
  create: (ctx) => new Sokoban(ctx),
};
