// Sliding Puzzle. Numbered tiles in a square with one gap: slide tiles into
// the gap until they read 1, 2, 3… in order, the gap at the bottom right.
// Tapping a tile in line with the gap slides it (and any tiles between) over.
// The shuffle is made of real slides from the solved board, so every puzzle
// can be solved. Score: the time it took, per size (lower is better).

import { settingOf } from './options.js';

export const SIZES = [3, 4, 5];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export class Slide {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const n = settingOf(ctx, 'size', 4);
    this.n = SIZES.includes(n) ? n : 4;
    this.timer = null;
  }

  start() {
    const n = this.n;
    this.tiles = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n)); // 0 is the gap
    // Shuffle with random slides (never straight back), many more than the board has tiles.
    let last = null;
    for (let k = 0; k < n * n * 40 || this.solved; k++) {
      const options = Object.keys(DIRS).filter((d) => d !== last && this.neighbour(d) !== -1);
      const d = options[Math.floor(this.rng() * options.length)];
      this.swapGap(this.neighbour(d));
      last = { up: 'down', down: 'up', left: 'right', right: 'left' }[d];
    }
    this.moves = 0;
    this.startedAt = null; // the clock starts with the first slide
    this.endedAt = null;
    this.phase = 'play';
    this.clock();
    this.ctx.update();
  }

  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      if (this.startedAt !== null) this.ctx.update();
      this.clock();
    }, 1000);
  }

  get gap() {
    return this.tiles.indexOf(0);
  }

  get solved() {
    return this.tiles.every((t, i) => t === (i + 1) % this.tiles.length);
  }

  /** The cell next to the gap in a direction from it, or -1 off the edge. */
  neighbour(dir) {
    const n = this.n;
    const g = this.gap;
    const x = (g % n) + DIRS[dir][0];
    const y = Math.floor(g / n) + DIRS[dir][1];
    return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x;
  }

  swapGap(i) {
    const g = this.gap;
    [this.tiles[g], this.tiles[i]] = [this.tiles[i], this.tiles[g]];
  }

  /** Slide the tile at cell i (and those between it and the gap) towards the gap. True if it moved. */
  tap(i) {
    const n = this.n;
    const g = this.gap;
    const [gx, gy, x, y] = [g % n, Math.floor(g / n), i % n, Math.floor(i / n)];
    if (i === g || (gx !== x && gy !== y)) return false;
    const step = gx === x ? (y > gy ? n : -n) : x > gx ? 1 : -1;
    for (let c = g; c !== i; c += step) this.swapGap(c + step);
    return true;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    let moved = false;
    if (input.type === 'tap' && Number.isInteger(input.cell) && input.cell >= 0 && input.cell < this.tiles.length) moved = this.tap(input.cell);
    // A direction moves the tile that can go that way into the gap (it's on the gap's other side).
    else if (input.type === 'move' && Object.prototype.hasOwnProperty.call(DIRS, input.dir)) {
      const from = this.neighbour({ up: 'down', down: 'up', left: 'right', right: 'left' }[input.dir]);
      if (from !== -1) moved = this.tap(from);
    }
    if (!moved) return;
    if (this.startedAt === null) this.startedAt = this.ctx.now();
    this.moves++;
    if (this.solved) {
      this.endedAt = this.ctx.now();
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
    }
    this.ctx.update();
  }

  get elapsed() {
    if (this.startedAt === null) return 0;
    return (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
  }

  view() {
    return {
      phase: this.phase,
      n: this.n,
      tiles: this.tiles,
      moves: this.moves,
      elapsed: this.elapsed,
      started: this.startedAt !== null,
      score: this.phase === 'over' ? this.elapsed : null,
      variant: this.n + '×' + this.n,
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
  id: 'slide',
  name: 'Sliding Puzzle',
  tagline: 'Slide the numbered tiles back into order. 3×3, 4×4 or 5×5.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Slide(ctx, ctx.rng),
};
