// Blocks. The falling-block classic: pieces of four squares drop into a
// 10×20 well; move and turn them so they fill whole rows, which clear. Clear
// 10 rows and the level goes up (pieces fall faster). Clearing several rows at
// once scores much more: 100, 300, 500 or 800 points for 1 to 4 rows, times
// the level, plus a point a row for dropping pieces yourself. Hold keeps one
// piece aside for later. The run ends when a new piece has no room to appear.
//
// Pieces come in "bags": every 7 pieces have one of each shape, so a long
// wait for a straight piece can't happen.

import { lookOf } from './looks.js';

export const W = 10;
export const H = 20;
export const LINE_POINTS = [0, 100, 300, 500, 800];
export const LINES_PER_LEVEL = 10;
export const TIMING = { lockMs: 500, maxLockResets: 15 };
const NEXT_SHOWN = 3;

// Each shape as its cells in spawn orientation, on a small square grid (size).
export const SHAPES = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
const KINDS = Object.keys(SHAPES);
// Where to try a turned piece if it doesn't fit where it is: in place, a step either way, two steps, one up.
const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

/** How long a piece takes to fall one row at a level (ms). */
export function gravityMs(level) {
  return Math.max(60, Math.round(800 * 0.85 ** (level - 1)));
}

/** A shape's cells after `rot` quarter turns clockwise (0-3). */
export function cellsOf(kind, rot) {
  const { size, cells } = SHAPES[kind];
  let out = cells;
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) out = out.map(([x, y]) => [size - 1 - y, x]);
  return out;
}

export class Blocks {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.look = lookOf(ctx, 'blocks-1p');
    this.timer = null;
  }

  start() {
    this.board = Array(W * H).fill('.');
    this.bag = [];
    this.queue = [];
    this.hold = null;
    this.held = false; // hold used for this piece already
    this.score = 0;
    this.lines = 0;
    this.cleared = null; // { rows, n } the last clear, for the TV to flash
    this.clears = 0; // counts clears, so the TV can tell a new one from the last
    this.bestClear = 0; // the most rows cleared at once this run
    this.pieces = 0;
    this.phase = 'play';
    this.spawn();
  }

  get level() {
    return 1 + Math.floor(this.lines / LINES_PER_LEVEL);
  }

  nextKind() {
    while (this.queue.length <= NEXT_SHOWN) {
      if (!this.bag.length) {
        this.bag = KINDS.slice();
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      this.queue.push(this.bag.pop());
    }
    return this.queue.shift();
  }

  /** A new piece at the top (from the queue, or the one taken out of hold). */
  spawn(kind = this.nextKind()) {
    const size = SHAPES[kind].size;
    this.piece = { kind, rot: 0, x: Math.floor((W - size) / 2), y: kind === 'I' ? -1 : 0 };
    this.landedAt = null;
    this.lockResets = 0;
    if (!this.fits(this.piece)) return this.end();
    this.schedule();
    this.ctx.update();
  }

  cells(p) {
    return cellsOf(p.kind, p.rot).map(([x, y]) => [p.x + x, p.y + y]);
  }

  /** In the well and not on a filled square. Rows above the top are open, so pieces can turn as they appear. */
  fits(p) {
    return this.cells(p).every(([x, y]) => x >= 0 && x < W && y < H && (y < 0 || this.board[y * W + x] === '.'));
  }

  landed() {
    return !this.fits({ ...this.piece, y: this.piece.y + 1 });
  }

  /** The next tick: a row of gravity, or the end of the lock delay once the piece is resting. */
  schedule() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    let ms = gravityMs(this.level);
    if (this.landed()) {
      if (this.landedAt === null) this.landedAt = this.ctx.now();
      ms = Math.max(0, this.landedAt + TIMING.lockMs - this.ctx.now());
    }
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.tick();
    }, ms);
  }

  tick() {
    if (this.landed()) {
      if (this.ctx.now() - this.landedAt >= TIMING.lockMs) return this.lock();
    } else {
      this.piece.y++;
      this.landedAt = null;
      this.ctx.update();
    }
    this.schedule();
  }

  /** A move or turn that worked while the piece rests: the lock waits again (a limited number of times). */
  moved() {
    if (this.landedAt !== null && this.lockResets < TIMING.maxLockResets) {
      this.lockResets++;
      this.landedAt = this.ctx.now();
    }
    if (!this.landed()) this.landedAt = null;
    this.schedule();
    this.ctx.update();
  }

  lock() {
    const cells = this.cells(this.piece);
    // Locked partly above the top: no room left.
    if (cells.some(([, y]) => y < 0)) return this.end();
    for (const [x, y] of cells) this.board[y * W + x] = this.piece.kind;
    const full = [];
    for (let y = 0; y < H; y++) if (this.board.slice(y * W, y * W + W).every((c) => c !== '.')) full.push(y);
    if (full.length) {
      const level = this.level; // the points use the level the rows were cleared at
      const keep = [];
      for (let y = 0; y < H; y++) if (!full.includes(y)) keep.push(...this.board.slice(y * W, y * W + W));
      this.board = Array(full.length * W).fill('.').concat(keep);
      this.lines += full.length;
      this.score += LINE_POINTS[full.length] * level;
      this.cleared = { rows: full, n: full.length };
      this.clears++;
      this.bestClear = Math.max(this.bestClear, full.length);
    }
    this.pieces++;
    this.held = false;
    this.spawn();
  }

  end() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.phase = 'over';
    this.ctx.update();
  }

  move(dx) {
    const p = { ...this.piece, x: this.piece.x + dx };
    if (!this.fits(p)) return;
    this.piece = p;
    this.moved();
  }

  rotate(dir) {
    const rot = (this.piece.rot + (dir === 'ccw' ? 3 : 1)) % 4;
    for (const [dx, dy] of KICKS) {
      const p = { ...this.piece, rot, x: this.piece.x + dx, y: this.piece.y + dy };
      if (this.fits(p)) {
        this.piece = p;
        return this.moved();
      }
    }
  }

  softDrop() {
    if (this.landed()) return;
    this.piece.y++;
    this.score += 1;
    this.landedAt = null;
    this.schedule();
    this.ctx.update();
  }

  hardDrop() {
    let rows = 0;
    while (!this.landed()) {
      this.piece.y++;
      rows++;
    }
    this.score += 2 * rows;
    this.lock();
  }

  swapHold() {
    if (this.held) return;
    const out = this.piece.kind;
    this.held = true;
    const back = this.hold;
    this.hold = out;
    this.spawn(back || undefined);
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    if (input.type === 'move' && (input.dir === 'left' || input.dir === 'right')) this.move(input.dir === 'left' ? -1 : 1);
    else if (input.type === 'rotate' && (input.dir === 'cw' || input.dir === 'ccw')) this.rotate(input.dir);
    else if (input.type === 'soft') this.softDrop();
    else if (input.type === 'drop') this.hardDrop();
    else if (input.type === 'hold') this.swapHold();
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.pausedLock = this.landedAt === null ? null : this.ctx.now() - this.landedAt;
      this.phase = 'paused';
      this.ctx.update();
    } else if (this.phase === 'paused') {
      this.phase = 'play';
      if (this.pausedLock !== null) this.landedAt = this.ctx.now() - this.pausedLock;
      this.schedule();
      this.ctx.update();
    }
  }

  /** Where the piece would land: the shadow drawn under it. */
  ghostY() {
    const p = { ...this.piece };
    while (this.fits({ ...p, y: p.y + 1 })) p.y++;
    return p.y;
  }

  hostView() {
    const paused = this.phase === 'paused';
    return {
      phase: this.phase,
      player: this.ctx.player,
      look: this.look,
      w: W,
      h: H,
      // The well, one character a square: '.' empty, else the shape that filled it. Hidden while paused.
      board: paused ? '.'.repeat(W * H) : this.board.join(''),
      piece: paused ? null : { kind: this.piece.kind, cells: this.cells(this.piece), ghost: this.ghostY() - this.piece.y },
      next: this.queue.slice(0, NEXT_SHOWN),
      hold: this.hold,
      canHold: !this.held,
      score: this.score,
      lines: this.lines,
      level: this.level,
      cleared: this.cleared,
      clears: this.clears,
      bestClear: this.bestClear,
    };
  }

  playerView() {
    return {
      phase: this.phase,
      score: this.score,
      lines: this.lines,
      level: this.level,
      hold: this.hold,
      canHold: !this.held,
      next: this.queue[0],
      clears: this.clears,
      cleared: this.cleared,
    };
  }
}

export default {
  id: 'blocks-1p',
  name: 'Blocks 1P',
  tagline: 'Turn the falling pieces to fill whole rows. Four rows at once scores big.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Blocks(ctx, ctx.rng),
};
