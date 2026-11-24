// Mahjong Solitaire. A pile of tiles in layers: take away matching pairs
// until none are left. A tile can be taken when nothing lies on top of it and
// its left or right side is open. Every deal can be cleared (it's dealt by
// playing the game backwards). Stuck? Undo, or shuffle what's left (30 s
// on the clock); a hint shows a pair (15 s). Score: the time to clear it
// (lower is better); giving up doesn't count.

import { lookOf } from './looks.js';

export const FACES = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🥝', '🍑', '🍍', '🌸', '🌻', '🍀', '🍄', '🌙', '⭐', '🔥', '💧', '⚡', '🎈'];
export const PENALTY = { hint: 15000, shuffle: 30000 };

/**
 * Where the tiles go, in half-tile units so a layer can sit across two rows:
 * a tile at (x, y, z) covers x..x+2 and y..y+2 on layer z.
 */
export const LAYOUT = (() => {
  const out = [];
  for (let y = 0; y <= 8; y += 2) for (let x = 0; x <= 14; x += 2) out.push({ x, y, z: 0 }); // 8 × 5
  out.push({ x: -2, y: 4, z: 0 }, { x: 16, y: 4, z: 0 }); // the wings
  for (let y = 1; y <= 7; y += 2) for (let x = 2; x <= 12; x += 2) out.push({ x, y, z: 1 }); // 6 × 4
  for (let y = 3; y <= 5; y += 2) for (let x = 4; x <= 10; x += 2) out.push({ x, y, z: 2 }); // 4 × 2
  out.push({ x: 6, y: 4, z: 3 }, { x: 8, y: 4, z: 3 }); // the top
  return out;
})();

/** Is tile i free among the tiles still there (`here[j]` true)? Nothing on top, and a side open. */
export function isFree(tiles, here, i) {
  const t = tiles[i];
  let left = false;
  let right = false;
  for (let j = 0; j < tiles.length; j++) {
    if (j === i || !here[j]) continue;
    const o = tiles[j];
    if (Math.abs(o.y - t.y) >= 2) continue;
    if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 2) return false;
    if (o.z === t.z && o.x === t.x - 2) left = true;
    if (o.z === t.z && o.x === t.x + 2) right = true;
  }
  return !(left && right);
}

/**
 * Faces for the tiles at `slots` (indexes into tiles), from `pairs` (one face
 * per pair), so that the tiles can all be taken away: take free tiles away
 * two at a time, giving each two the next face. Returns { faces: { index: face },
 * order: the pairs in the order they were taken (one way to clear it) }.
 */
export function deal(tiles, slots, pairs, rng) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const here = tiles.map((_, i) => slots.includes(i));
    const faces = {};
    const order = [];
    let ok = true;
    for (const face of shuffle(pairs, rng)) {
      const free = slots.filter((i) => here[i] && isFree(tiles, here, i));
      if (free.length < 2) {
        ok = false;
        break;
      }
      const a = free.splice(Math.floor(rng() * free.length), 1)[0];
      const b = free[Math.floor(rng() * free.length)];
      faces[a] = faces[b] = face;
      here[a] = here[b] = false;
      order.push([a, b]);
    }
    if (ok) return { faces, order };
  }
  throw new Error('Could not deal the tiles');
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Mahjong {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.look = lookOf(ctx, 'mahjong');
  }

  start() {
    // Each face four times: two pairs of it.
    const pairs = FACES.flatMap((f) => [f, f]);
    const { faces, order } = deal(LAYOUT, LAYOUT.map((_, i) => i), pairs, this.rng);
    this.tiles = LAYOUT.map((p, i) => ({ ...p, face: faces[i] }));
    this.solution = order; // one way to clear it (never sent to the screens)
    this.here = this.tiles.map(() => true);
    this.selected = null;
    this.hint = null;
    this.history = []; // the pairs taken, for undo
    this.hints = 0;
    this.shuffles = 0;
    this.nope = 0; // picks that couldn't happen, so the screens can shake
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.phase = 'play';
    this.clock();
    this.ctx.update();
  }

  /** One update a second keeps the clock moving on screen. */
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

  free(i) {
    return this.here[i] && isFree(this.tiles, this.here, i);
  }

  /** Every pair that could be taken right now. */
  pairs() {
    const free = this.tiles.map((_, i) => i).filter((i) => this.free(i));
    const out = [];
    for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (this.tiles[free[a]].face === this.tiles[free[b]].face) out.push([free[a], free[b]]);
    return out;
  }

  pick(i) {
    if (!this.free(i)) {
      this.nope++;
      return;
    }
    if (this.selected === i) {
      this.selected = null;
      return;
    }
    if (this.selected === null || this.tiles[this.selected].face !== this.tiles[i].face) {
      this.selected = i; // a different face: pick this one instead
      return;
    }
    this.here[this.selected] = this.here[i] = false;
    this.history.push([this.selected, i]);
    this.selected = null;
    this.hint = null;
    if (this.here.every((h) => !h)) {
      this.endedAt = this.ctx.now();
      this.phase = 'over';
      this.stopClock();
    }
  }

  undo() {
    const last = this.history.pop();
    if (!last) return;
    for (const i of last) this.here[i] = true;
    this.selected = null;
    this.hint = null;
  }

  /** Deal the faces still there out again over the tiles still there, so it can be cleared. */
  reshuffle() {
    const slots = this.tiles.map((_, i) => i).filter((i) => this.here[i]);
    const pairs = [];
    const seen = {};
    for (const i of slots) {
      const f = this.tiles[i].face;
      seen[f] = (seen[f] || 0) + 1;
      if (seen[f] % 2 === 0) pairs.push(f);
    }
    const { faces, order } = deal(this.tiles, slots, pairs, this.rng);
    for (const i of slots) this.tiles[i] = { ...this.tiles[i], face: faces[i] };
    this.solution = order;
    this.history = []; // the old moves no longer make sense
    this.selected = null;
    this.hint = null;
    this.shuffles++;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase !== 'play') return;
    if (input.type === 'pick') {
      const i = input.tile;
      if (!Number.isInteger(i) || i < 0 || i >= this.tiles.length || !this.here[i]) return;
      this.pick(i);
    } else if (input.type === 'undo') this.undo();
    else if (input.type === 'hint') {
      const p = this.pairs();
      if (!p.length) return;
      this.hint = p[Math.floor(this.rng() * p.length)];
      this.hints++;
    } else if (input.type === 'shuffle') this.reshuffle();
    else if (input.type === 'give-up') {
      this.phase = 'over';
      this.stopClock();
    } else return;
    this.ctx.update();
  }

  togglePause() {
    if (this.phase === 'play') {
      this.stopClock();
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
    } else if (this.phase === 'paused') {
      this.startedAt += this.ctx.now() - this.pausedAt; // the clock doesn't run while paused
      this.phase = 'play';
      this.clock();
    } else return;
    this.ctx.update();
  }

  get elapsed() {
    const end = this.endedAt !== null ? this.endedAt : this.phase === 'paused' ? this.pausedAt : this.ctx.now();
    return end - this.startedAt + this.hints * PENALTY.hint + this.shuffles * PENALTY.shuffle;
  }

  view() {
    const hidden = this.phase === 'paused'; // no thinking time for free
    const left = this.here.filter(Boolean).length;
    return {
      look: this.look,
      phase: this.phase,
      tiles: this.tiles.map((t, i) => ({ x: t.x, y: t.y, z: t.z, face: hidden ? '' : t.face, here: this.here[i], free: this.free(i) })),
      selected: this.selected,
      hint: this.hint,
      left,
      pairsOpen: this.phase === 'over' ? 0 : this.pairs().length,
      canUndo: this.history.length > 0,
      hints: this.hints,
      shuffles: this.shuffles,
      nope: this.nope,
      elapsed: this.elapsed,
      cleared: left === 0,
      score: this.phase === 'over' && left === 0 ? this.elapsed : null,
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
  id: 'mahjong',
  name: 'Mahjong Solitaire',
  tagline: 'Take matching pairs of free tiles off the pile until it’s gone.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Mahjong(ctx, ctx.rng),
};
