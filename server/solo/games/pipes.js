// Pipes. A grid of pipe pieces (ends, straights, bends, T's and crosses), each turned at random.
// Tap a piece to turn it a quarter. Water runs from the tap in the middle along every joined pipe;
// solve it when the water reaches every piece and no pipe is left open (an end that goes nowhere,
// or off the edge). In 🌀 Wrap round boards a pipe can run off one edge and on at the other.
// Lock a piece you're sure of so a stray tap can't turn it. Every board has an answer (the one it
// was made from), and any way of joining everything up counts.
// Score: the time it took (lower is better), per size; each hint adds 30 s.

import { settingOf } from './options.js';

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const SIDES = [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]];
export const SIZES = [7, 5, 9];
export const HINT_PENALTY = 30000;
const MAX_UNDO = 500;

/** A piece's openings turned a quarter clockwise `times` times. */
export function turned(mask, times) {
  let m = mask;
  for (let k = 0; k < ((times % 4) + 4) % 4; k++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

/** The square next to i on a side ([dx, dy]), or -1 off the edge (unless the board wraps round). */
export function neighbour(n, wrap, i, dx, dy) {
  let x = (i % n) + dx;
  let y = Math.floor(i / n) + dy;
  if (wrap) {
    x = (x + n) % n;
    y = (y + n) % n;
  } else if (x < 0 || y < 0 || x >= n || y >= n) return -1;
  return y * n + x;
}

/**
 * A board: a random tree of pipes over the whole grid, grown from the tap (each square joins one
 * already in the tree, picked at random from the edge of what's grown). Returns the pieces' openings.
 */
export function makeBoard(n, wrap, rng) {
  const size = n * n;
  const masks = new Array(size).fill(0);
  const tap = Math.floor(size / 2); // (the middle: the sizes are odd)
  const inTree = new Uint8Array(size);
  inTree[tap] = 1;
  const edge = [];
  const addEdges = (i) => {
    for (const [bit, dx, dy, back] of SIDES) {
      const j = neighbour(n, wrap, i, dx, dy);
      if (j >= 0 && !inTree[j]) edge.push([i, j, bit, back]);
    }
  };
  addEdges(tap);
  while (edge.length) {
    const k = Math.floor(rng() * edge.length);
    const [i, j, bit, back] = edge[k];
    edge[k] = edge[edge.length - 1];
    edge.pop();
    if (inTree[j]) continue;
    // (no crosses on small boards: a four-way piece makes a 5 × 5 too easy to read)
    if (n < 7 && countBits(masks[i]) >= 3) continue;
    masks[i] |= bit;
    masks[j] |= back;
    inTree[j] = 1;
    addEdges(j);
  }
  // A square the rule above left out joins through any neighbour.
  for (let i = 0; i < size; i++) {
    if (inTree[i]) continue;
    for (const [bit, dx, dy, back] of SIDES) {
      const j = neighbour(n, wrap, i, dx, dy);
      if (j >= 0 && inTree[j]) {
        masks[i] |= bit;
        masks[j] |= back;
        inTree[i] = 1;
        break;
      }
    }
  }
  return { masks, tap };
}

const countBits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

/** Where the water gets to from the tap (a set of squares), and how many pipe ends lead nowhere. */
export function flow(n, wrap, masks, tap) {
  const wet = new Set([tap]);
  const todo = [tap];
  while (todo.length) {
    const i = todo.pop();
    for (const [bit, dx, dy, back] of SIDES) {
      if (!(masks[i] & bit)) continue;
      const j = neighbour(n, wrap, i, dx, dy);
      if (j < 0 || !(masks[j] & back) || wet.has(j)) continue;
      wet.add(j);
      todo.push(j);
    }
  }
  let open = 0;
  for (let i = 0; i < masks.length; i++) {
    for (const [bit, dx, dy, back] of SIDES) {
      if (!(masks[i] & bit)) continue;
      const j = neighbour(n, wrap, i, dx, dy);
      if (j < 0 || !(masks[j] & back)) open++;
    }
  }
  return { wet, open };
}

export class Pipes {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const n = settingOf(ctx, 'size', 7);
    this.n = SIZES.includes(n) ? n : 7;
    this.wrap = settingOf(ctx, 'edges', 'solid') === 'wrap';
    this.timer = null;
  }

  start() {
    const { masks, tap } = makeBoard(this.n, this.wrap, this.rng);
    this.answer = masks; // (the board it was made from; never sent)
    this.tap = tap;
    this.base = masks;
    // Each piece turned at random (straights and crosses look the same some ways round).
    this.rots = masks.map(() => Math.floor(this.rng() * 4));
    this.locked = masks.map(() => false);
    this.history = [];
    this.hints = 0;
    this.hint = null;
    this.hintNo = 0;
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.won = false;
    this.phase = 'play';
    // (a scramble that happens to be solved already: give one piece a turn)
    if (this.solved()) this.rots[this.firstTurnable()] += 1;
    this.clock();
    this.ctx.update();
  }

  firstTurnable() {
    return this.base.findIndex((m) => m !== 5 && m !== 10 && m !== 15);
  }

  get masks() {
    return this.base.map((m, i) => turned(m, this.rots[i]));
  }

  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      this.ctx.update();
      this.clock();
    }, 1000);
  }

  stopClock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  solved() {
    const f = flow(this.n, this.wrap, this.masks, this.tap);
    return f.open === 0 && f.wet.size === this.n * this.n;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    const cellOk = (c) => Number.isInteger(c) && c >= 0 && c < this.n * this.n;
    if (input.type === 'tap' && cellOk(input.cell) && !this.locked[input.cell]) {
      // A quarter clockwise, or anticlockwise with back: true.
      const by = input.back === true ? -1 : 1;
      this.rots[input.cell] += by;
      this.history.push([input.cell, by]);
      if (this.history.length > MAX_UNDO) this.history.shift();
    } else if (input.type === 'lock' && cellOk(input.cell)) {
      this.locked[input.cell] = !this.locked[input.cell];
    } else if (input.type === 'undo' && this.history.length) {
      const [cell, by] = this.history.pop();
      this.rots[cell] -= by;
    } else if (input.type === 'hint') {
      if (!this.giveHint()) return;
    } else return;
    if (this.solved()) {
      this.won = true;
      this.endedAt = this.ctx.now();
      this.hint = null;
      this.phase = 'over';
      this.stopClock();
    }
    this.ctx.update();
  }

  /** Turns one piece that's the wrong way round (as the board was made) the right way, and locks it. */
  giveHint() {
    const masks = this.masks;
    const cell = masks.findIndex((m, i) => m !== this.answer[i] && !this.locked[i]);
    const pick = cell >= 0 ? cell : masks.findIndex((m, i) => m !== this.answer[i]);
    if (pick < 0) return false;
    // The fewest clockwise quarter-turns that put it right (a whole number of turns is kept, so the
    // screens can spin it the short way).
    let k = 0;
    while (turned(this.base[pick], this.rots[pick] + k) !== this.answer[pick]) k++;
    this.rots[pick] += k;
    this.locked[pick] = true;
    this.hints++;
    this.hint = pick;
    this.hintNo++;
    return true;
  }

  togglePause() {
    if (this.phase === 'play') {
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
      this.stopClock();
    } else if (this.phase === 'paused') {
      this.startedAt += this.ctx.now() - this.pausedAt;
      this.phase = 'play';
      this.clock();
    } else return;
    this.ctx.update();
  }

  get elapsed() {
    const end = this.endedAt !== null ? this.endedAt : this.phase === 'paused' ? this.pausedAt : this.ctx.now();
    return end - this.startedAt + this.hints * HINT_PENALTY;
  }

  view() {
    const hidden = this.phase === 'paused';
    const f = flow(this.n, this.wrap, this.masks, this.tap);
    return {
      phase: this.phase,
      n: this.n,
      wrap: this.wrap,
      tap: this.tap,
      base: hidden ? this.base.map(() => 0) : this.base,
      rots: this.rots,
      locked: this.locked,
      wet: hidden ? [] : [...f.wet].sort((a, b) => a - b),
      open: f.open,
      hint: this.hint,
      hintNo: this.hintNo,
      hints: this.hints,
      canUndo: this.history.length > 0,
      elapsed: this.elapsed,
      won: this.won,
      score: this.phase === 'over' && this.won ? this.elapsed : null,
      variant: `${this.n} × ${this.n}${this.wrap ? ' wrap' : ''}`,
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
  id: 'pipes',
  name: 'Pipes',
  tagline: 'Turn the pipe pieces until the water from the tap reaches every one, with no open ends.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Pipes(ctx, ctx.rng),
};
