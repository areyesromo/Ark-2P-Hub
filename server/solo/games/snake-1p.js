// Snake. The classic: eat the food to grow, don't hit a wall or your own
// tail. Every few bites the snake speeds up. Score: food eaten. With "wrap"
// walls you come out on the other side instead of crashing into them.

import { settingOf } from './options.js';
import { lookOf } from './looks.js';

export const GRID = { w: 24, h: 14 };
export const START_LENGTH = 4;
export const TIMING = { countdownMs: 3000 };
export const SPEEDS = {
  normal: { startCps: 7, maxCps: 14 }, // cells per second
  fast: { startCps: 10, maxCps: 18 },
};
export const FASTER_EVERY = 4; // bites per speed step
const MAX_QUEUE = 2; // turns buffered, so a quick double-turn both count

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const key = (x, y) => y * GRID.w + x;

export class Snake {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.speed = SPEEDS[settingOf(ctx, 'speed', 'normal')] ? settingOf(ctx, 'speed', 'normal') : 'normal';
    this.wrap = settingOf(ctx, 'walls', 'solid') === 'wrap';
    this.look = lookOf(ctx, 'snake-1p');
    this.timer = null;
  }

  start() {
    const y = Math.floor(GRID.h / 2);
    this.body = Array.from({ length: START_LENGTH }, (_, i) => [5 - i, y]);
    this.dir = 'right';
    this.queue = [];
    this.eaten = 0;
    this.crashed = false;
    this.food = null;
    this.spawnFood();
    this.enter('countdown', TIMING.countdownMs);
    this.schedule(() => this.countdownStep(), Math.min(1000, TIMING.countdownMs));
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  schedule(fn, ms) {
    this.clear();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  clear() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Push the 3-2-1 once a second, then go. */
  countdownStep() {
    const left = this.phaseEnds - this.ctx.now();
    if (left > 0) {
      this.ctx.update();
      this.schedule(() => this.countdownStep(), Math.min(1000, left));
      return;
    }
    this.enter('play');
    this.loop();
  }

  get cps() {
    const s = SPEEDS[this.speed];
    return Math.min(s.maxCps, s.startCps + Math.floor(this.eaten / FASTER_EVERY));
  }

  loop() {
    this.schedule(() => {
      this.tick();
      if (this.phase === 'play') this.loop();
    }, 1000 / this.cps);
  }

  /** Drop the food on a random empty cell. */
  spawnFood() {
    const taken = new Set(this.body.map(([x, y]) => key(x, y)));
    const free = GRID.w * GRID.h - taken.size;
    this.food = null;
    if (free <= 0) return;
    let n = Math.floor(this.rng() * free);
    for (let i = 0; i < GRID.w * GRID.h; i++) {
      if (taken.has(i)) continue;
      if (n-- === 0) {
        this.food = [i % GRID.w, Math.floor(i / GRID.w)];
        return;
      }
    }
  }

  tick() {
    if (this.queue.length) this.dir = this.queue.shift();
    const [dx, dy] = DIRS[this.dir];
    let x = this.body[0][0] + dx;
    let y = this.body[0][1] + dy;
    if (this.wrap) {
      x = (x + GRID.w) % GRID.w;
      y = (y + GRID.h) % GRID.h;
    }
    const eats = Boolean(this.food) && this.food[0] === x && this.food[1] === y;
    // The tail moves on this tick unless the snake is growing, so its cell is free to enter.
    const body = eats ? this.body : this.body.slice(0, -1);
    const hit = x < 0 || y < 0 || x >= GRID.w || y >= GRID.h || body.some(([bx, by]) => bx === x && by === y);
    if (hit) {
      this.crashed = true;
      return this.end();
    }
    this.body.unshift([x, y]);
    if (eats) {
      this.eaten++;
      this.spawnFood();
      if (!this.food) return this.end(); // the whole board is snake: nothing left to eat
    } else {
      this.body.pop();
    }
    this.ctx.update();
  }

  end() {
    this.clear();
    this.enter('over');
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (input.type !== 'turn' || !Object.prototype.hasOwnProperty.call(DIRS, input.dir)) return;
    if (this.phase !== 'play' && this.phase !== 'countdown') return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    // No-op and 180° turns (straight back into your own neck) are ignored.
    if (input.dir === last || input.dir === OPPOSITE[last] || this.queue.length >= MAX_QUEUE) return;
    this.queue.push(input.dir);
  }

  togglePause() {
    if (this.phase === 'play') {
      this.clear();
      this.enter('paused');
    } else if (this.phase === 'paused') {
      this.enter('play');
      this.loop();
    }
  }

  countdown() {
    return this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  get variant() {
    return (this.speed === 'fast' ? 'Fast' : 'Normal') + (this.wrap ? ' · Wrap' : '');
  }

  hostView() {
    return {
      phase: this.phase,
      player: this.ctx.player,
      grid: GRID,
      wrap: this.wrap,
      countdown: this.countdown(),
      body: this.body,
      dir: this.dir,
      food: this.food,
      crashed: this.crashed,
      cps: this.cps,
      score: this.eaten,
      variant: this.variant,
      look: this.look,
    };
  }

  playerView() {
    return {
      phase: this.phase,
      countdown: this.countdown(),
      dir: this.dir,
      score: this.eaten,
      length: this.body.length,
      variant: this.variant,
    };
  }
}

export default {
  id: 'snake-1p',
  name: 'Snake 1P',
  tagline: 'Eat, grow, don\'t bite your own tail. It speeds up as you go.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Snake(ctx, ctx.rng),
};
