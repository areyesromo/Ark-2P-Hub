// Bubble Shooter. Coloured bubbles hang from the ceiling. Aim the launcher at
// the bottom and fire: a bubble flies (bouncing off the side walls) and
// sticks where it touches. Three or more of one colour together pop, and
// anything left hanging from nothing falls. Every few shots that pop nothing,
// the whole ceiling comes down a row; let a bubble reach the line at the
// bottom and it's over. Clear the board for a bonus and a fresh one.
// Score: points (10 a popped bubble, 20 a fallen one).
//
// Shots are worked out the moment they're fired (the path is sent with the
// result, for the TV to animate), so the game needs no clock.

export const COLS = 10; // bubbles in a full row; the rows in between hold one fewer, shifted half a bubble
export const DEATH_ROW = 12; // a bubble stuck on this row (or lower) ends the run
export const ROW_H = Math.sqrt(3) / 2; // rows sit closer than a bubble's width
export const FIELD = { w: COLS, h: DEATH_ROW * ROW_H + 2.2 };
export const LAUNCHER = { x: COLS / 2, y: FIELD.h - 0.6 };
export const COLOURS = 6;
export const MAX_ANGLE = 78; // degrees either side of straight up
export const MISSES_PER_DROP = 5;
const STEP = 0.05; // the shot moves this far per step of its path
const START_ROWS = 5;
const POINTS = { pop: 10, drop: 20, clear: 1000 };

export class Bubbles {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
  }

  start() {
    this.score = 0;
    this.level = 1;
    this.shots = 0;
    this.popped = 0;
    this.bestCombo = 0; // most bubbles gone in one shot
    this.cleared = 0;
    this.newBoard();
    this.phase = 'play';
    this.ctx.update();
  }

  /** How many colours are in play: four at first, one more each board, up to six. */
  get colours() {
    return Math.min(COLOURS, 3 + this.level);
  }

  newBoard() {
    this.parity = 0; // which rows are the short ones (it flips each time the ceiling comes down)
    this.grid = [];
    for (let r = 0; r < START_ROWS; r++) this.grid.push(this.randomRow(r));
    while (this.grid.length < DEATH_ROW + 2) this.grid.push(Array(this.width(this.grid.length)).fill(-1));
    this.misses = 0;
    this.current = this.pickColour();
    this.next = this.pickColour();
    this.aim = 0;
    this.last = null; // { path, colour, at, popped, dropped, n }: the last shot, for the TV to animate
  }

  /** Short rows hold one bubble fewer. */
  short(r) {
    return (r + this.parity) % 2 === 1;
  }

  width(r) {
    return this.short(r) ? COLS - 1 : COLS;
  }

  randomRow(r) {
    return Array.from({ length: this.width(r) }, () => Math.floor(this.rng() * this.colours));
  }

  /** Where a cell's centre is. */
  centre(r, c) {
    return { x: c + 0.5 + (this.short(r) ? 0.5 : 0), y: r * ROW_H + 0.5 };
  }

  cell(r, c) {
    return r >= 0 && r < this.grid.length && c >= 0 && c < this.grid[r].length ? this.grid[r][c] : undefined;
  }

  neighbours(r, c) {
    // A short row sits half a bubble to the right, so its neighbours above and below are c and c+1;
    // a full row's are c-1 and c.
    const d = this.short(r) ? [0, 1] : [-1, 0];
    const out = [[r, c - 1], [r, c + 1]];
    for (const rr of [r - 1, r + 1]) for (const dc of d) out.push([rr, c + dc]);
    return out.filter(([rr, cc]) => this.cell(rr, cc) !== undefined);
  }

  /** A colour still on the board (so every shot can be useful), or any colour on an empty board. */
  pickColour() {
    const left = new Set();
    for (const row of this.grid || []) for (const v of row) if (v >= 0) left.add(v);
    const list = left.size ? [...left] : Array.from({ length: this.colours }, (_, i) => i);
    return list[Math.floor(this.rng() * list.length)];
  }

  /** Follow a shot at the given angle: { path: points where it turned and stopped, r, c: where it sticks }. */
  fly(angle) {
    const a = (angle * Math.PI) / 180;
    let dx = Math.sin(a) * STEP;
    const dy = -Math.cos(a) * STEP;
    let x = LAUNCHER.x;
    let y = LAUNCHER.y;
    const path = [{ x, y }];
    for (let i = 0; i < 20000; i++) {
      x += dx;
      y += dy;
      if (x < 0.5 || x > COLS - 0.5) {
        x = x < 0.5 ? 1 - x : 2 * (COLS - 0.5) - x;
        dx = -dx;
        path.push({ x, y });
      }
      if (y <= 0.5 || this.touches(x, y)) break;
    }
    const spot = this.snap(x, y);
    path.push(this.centre(spot.r, spot.c));
    return { path, ...spot };
  }

  /** True when a bubble at (x, y) touches one on the board. */
  touches(x, y) {
    const r0 = Math.max(0, Math.floor((y - 0.5) / ROW_H) - 1);
    for (let r = r0; r <= r0 + 3 && r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] < 0) continue;
        const p = this.centre(r, c);
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < 0.85 * 0.85) return true;
      }
    }
    return false;
  }

  /** The empty cell nearest (x, y) that a bubble can hang in: on the top row or next to another. */
  snap(x, y) {
    let best = null;
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] >= 0) continue;
        if (r > 0 && !this.neighbours(r, c).some(([rr, cc]) => this.grid[rr][cc] >= 0)) continue;
        const p = this.centre(r, c);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (!best || d < best.d) best = { r, c, d };
      }
    }
    return { r: best.r, c: best.c };
  }

  /** The cells joined to (r, c) that pass the test. */
  group(r, c, test) {
    const seen = new Set([r + ',' + c]);
    const out = [[r, c]];
    for (let i = 0; i < out.length; i++) {
      for (const [rr, cc] of this.neighbours(...out[i])) {
        const k = rr + ',' + cc;
        if (!seen.has(k) && test(this.grid[rr][cc])) {
          seen.add(k);
          out.push([rr, cc]);
        }
      }
    }
    return out;
  }

  shoot(angle) {
    const { path, r, c } = this.fly(angle);
    const colour = this.current;
    this.grid[r][c] = colour;
    this.shots++;
    let popped = [];
    let dropped = [];
    const same = this.group(r, c, (v) => v === colour);
    if (same.length >= 3) {
      popped = same;
      for (const [rr, cc] of popped) this.grid[rr][cc] = -1;
      // Whatever no longer hangs from the ceiling falls.
      const held = new Set();
      for (let cc = 0; cc < this.grid[0].length; cc++) {
        if (this.grid[0][cc] >= 0) for (const [rr, c2] of this.group(0, cc, (v) => v >= 0)) held.add(rr + ',' + c2);
      }
      for (let rr = 0; rr < this.grid.length; rr++) {
        for (let c2 = 0; c2 < this.grid[rr].length; c2++) {
          if (this.grid[rr][c2] >= 0 && !held.has(rr + ',' + c2)) {
            dropped.push([rr, c2]);
            this.grid[rr][c2] = -1;
          }
        }
      }
      this.score += popped.length * POINTS.pop + dropped.length * POINTS.drop;
      this.popped += popped.length + dropped.length;
      this.bestCombo = Math.max(this.bestCombo, popped.length + dropped.length);
      this.misses = 0;
    } else {
      this.misses++;
    }
    this.last = { path, colour, at: [r, c], popped, dropped, n: this.shots };
    this.current = this.next;

    if (this.grid.every((row) => row.every((v) => v < 0))) {
      // A clear board: a bonus and the next, with one more colour.
      this.score += POINTS.clear;
      this.cleared++;
      this.level++;
      const last = this.last;
      this.newBoard();
      this.last = { ...last, cleared: true };
      return;
    }
    if (this.misses >= MISSES_PER_DROP) {
      this.misses = 0;
      this.dropCeiling();
    }
    this.next = this.pickColour();
    if (!this.colourLeft(this.current)) this.current = this.pickColour();
    if (this.lowest() >= DEATH_ROW) this.phase = 'over';
  }

  colourLeft(colour) {
    return this.grid.some((row) => row.includes(colour));
  }

  /** The whole ceiling comes down a row, with a new row on top. */
  dropCeiling() {
    this.grid.pop();
    this.parity = 1 - this.parity;
    this.grid.unshift(this.randomRow(0));
  }

  /** The lowest row with a bubble in it, or -1. */
  lowest() {
    for (let r = this.grid.length - 1; r >= 0; r--) if (this.grid[r].some((v) => v >= 0)) return r;
    return -1;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    const ok = typeof input.angle === 'number' && Number.isFinite(input.angle);
    if (!ok || (input.type !== 'aim' && input.type !== 'shoot')) return;
    const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, input.angle));
    this.aim = angle;
    if (input.type === 'shoot') this.shoot(angle);
    this.ctx.update();
  }

  view() {
    return {
      phase: this.phase,
      field: FIELD,
      launcher: LAUNCHER,
      cols: COLS,
      rowH: ROW_H,
      deathRow: DEATH_ROW,
      maxAngle: MAX_ANGLE,
      parity: this.parity,
      grid: this.grid.slice(0, DEATH_ROW + 1),
      current: this.current,
      next: this.next,
      aim: this.aim,
      last: this.last,
      missesLeft: MISSES_PER_DROP - this.misses,
      level: this.level,
      shots: this.shots,
      bestCombo: this.bestCombo,
      cleared: this.cleared,
      score: this.score,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    const v = this.view();
    // The phone only needs what's next and the aim; the board stays on the TV.
    return { phase: v.phase, current: v.current, next: v.next, aim: v.aim, maxAngle: v.maxAngle, missesLeft: v.missesLeft, score: v.score, level: v.level };
  }
}

export default {
  id: 'bubbles',
  name: 'Bubble Shooter',
  tagline: 'Aim, fire, pop three of a colour. Don\'t let the bubbles reach the bottom.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Bubbles(ctx, ctx.rng),
};
