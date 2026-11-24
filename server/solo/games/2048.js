// 2048. Slide every tile on a 4×4 board one way; two equal tiles that bump
// into each other merge into their sum, and that sum is added to the score.
// After every move a new 2 (sometimes a 4) appears. Reach 2048 and you can
// keep going; the run ends when no move changes the board.

import { lookOf } from './looks.js';

export const SIZE = 4;
export const GOAL = 2048;
const FOUR_CHANCE = 0.1;

const DIRS = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

export class Game2048 {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.look = lookOf(ctx, '2048');
  }

  start() {
    this.cells = Array(SIZE * SIZE).fill(null); // { id, v } or null
    this.nextId = 1;
    this.score = 0;
    this.moves = 0;
    this.reached = false; // made a GOAL tile at some point
    this.lastMove = null;
    this.phase = 'play';
    this.spawn();
    this.spawn();
    this.ctx.update();
  }

  at(x, y) {
    return this.cells[y * SIZE + x];
  }

  spawn() {
    const free = [];
    this.cells.forEach((c, i) => { if (!c) free.push(i); });
    if (!free.length) return null;
    const i = free[Math.floor(this.rng() * free.length)];
    this.cells[i] = { id: this.nextId++, v: this.rng() < FOUR_CHANCE ? 4 : 2, fresh: true };
    return i;
  }

  /**
   * Slide the board one way. Returns true when something moved. Each tile
   * merges at most once per move, and the tiles closest to the wall go first
   * ([2, 2, 2] slid left is [4, 2]).
   */
  slide(dir) {
    const [dx, dy] = DIRS[dir];
    const order = [...Array(SIZE).keys()];
    if (dx > 0 || dy > 0) order.reverse(); // walk from the wall we slide towards
    const next = Array(SIZE * SIZE).fill(null);
    let moved = false;
    let gained = 0;
    for (let line = 0; line < SIZE; line++) {
      const out = []; // tiles of this line, wall first
      for (const k of order) {
        const [x, y] = dx ? [k, line] : [line, k];
        const c = this.at(x, y);
        if (!c) continue;
        const last = out[out.length - 1];
        if (last && last.v === c.v && !last.merged) {
          last.v *= 2;
          last.merged = true;
          last.from.push(c.id);
          gained += last.v;
        } else {
          out.push({ id: c.id, v: c.v, merged: false, from: [c.id] });
        }
      }
      out.forEach((t, i) => {
        const k = order[i];
        const [x, y] = dx ? [k, line] : [line, k];
        // A merged tile is a new tile: it gets a new id so the TV pops it.
        const tile = t.merged ? { id: this.nextId++, v: t.v, merged: true } : { id: t.id, v: t.v };
        next[y * SIZE + x] = tile;
      });
    }
    for (let i = 0; i < next.length; i++) {
      const a = this.cells[i];
      const b = next[i];
      if ((a && a.v) !== (b && b.v) || (a && b && !b.merged && a.id !== b.id)) moved = true;
    }
    if (!moved) return false;
    this.cells = next;
    this.score += gained;
    return true;
  }

  canMove() {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = this.at(x, y);
        if (!c) return true;
        // (An empty neighbour is found when the loop gets to it.)
        if (x + 1 < SIZE && this.at(x + 1, y)?.v === c.v) return true;
        if (y + 1 < SIZE && this.at(x, y + 1)?.v === c.v) return true;
      }
    }
    return false;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'give-up' && this.phase === 'play') {
      this.phase = 'over';
      return this.ctx.update();
    }
    if (input.type !== 'move' || this.phase !== 'play' || !Object.prototype.hasOwnProperty.call(DIRS, input.dir)) return;
    if (!this.slide(input.dir)) return;
    this.moves++;
    this.lastMove = input.dir;
    this.spawn();
    if (!this.reached && this.cells.some((c) => c && c.v >= GOAL)) this.reached = true;
    if (!this.canMove()) this.phase = 'over';
    this.ctx.update();
  }

  get biggest() {
    return Math.max(...this.cells.map((c) => (c ? c.v : 0)));
  }

  hostView() {
    return {
      phase: this.phase,
      player: this.ctx.player,
      look: this.look,
      size: SIZE,
      tiles: this.cells.map((c, i) => (c ? { id: c.id, v: c.v, x: i % SIZE, y: Math.floor(i / SIZE), merged: Boolean(c.merged), fresh: Boolean(c.fresh) } : null)).filter(Boolean),
      score: this.score,
      moves: this.moves,
      biggest: this.biggest,
      reached: this.reached,
      lastMove: this.lastMove,
    };
  }

  playerView() {
    return {
      phase: this.phase,
      score: this.score,
      moves: this.moves,
      biggest: this.biggest,
      reached: this.reached,
    };
  }
}

export default {
  id: '2048',
  name: '2048',
  tagline: 'Swipe to slide the tiles; equal tiles merge. Can you make 2048?',
  category: 'puzzle',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Game2048(ctx, ctx.rng),
};
