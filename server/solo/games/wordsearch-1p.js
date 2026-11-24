// Word Search. Words are hidden in a grid of letters, in straight lines. Find
// each one and mark it from its first letter to its last. The small grid hides
// them across and down, the medium one diagonally too, and the large one in
// every direction, backwards as well. Score: the time to find them all (lower
// is better), per size.

import { settingOf } from './options.js';
import { WORDS } from './word-search-words.js';

const ACROSS_DOWN = [[1, 0], [0, 1]];
const DIAGONAL = [...ACROSS_DOWN, [1, 1], [1, -1]];
const ALL = [...DIAGONAL, [-1, 0], [0, -1], [-1, -1], [-1, 1]];

export const SIZES = {
  small: { name: '8 × 8', n: 8, words: 6, dirs: ACROSS_DOWN },
  medium: { name: '10 × 10', n: 10, words: 8, dirs: DIAGONAL },
  large: { name: '12 × 12', n: 12, words: 10, dirs: ALL },
};
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'; // the fill (no Q, X or Z: they'd stand out)

export class WordSearch {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const size = settingOf(ctx, 'size', 'small');
    this.size = Object.prototype.hasOwnProperty.call(SIZES, size) ? size : 'small';
    this.timer = null;
  }

  pick(list) {
    return list[Math.floor(this.rng() * list.length)];
  }

  /** A grid with the words hidden in it: { grid: letters, placed: [{ word, a, b }] }, retrying until they all fit. */
  make() {
    const { n, words, dirs } = SIZES[this.size];
    for (;;) {
      const grid = Array(n * n).fill('');
      const placed = [];
      const pool = WORDS.filter((w) => w.length <= n);
      let tries = 0;
      while (placed.length < words && tries++ < 2000) {
        const word = this.pick(pool).toUpperCase();
        if (placed.some((p) => p.word === word || p.word.includes(word) || word.includes(p.word))) continue;
        const [dx, dy] = this.pick(dirs);
        const x = Math.floor(this.rng() * n);
        const y = Math.floor(this.rng() * n);
        const ex = x + dx * (word.length - 1);
        const ey = y + dy * (word.length - 1);
        if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
        // Crossing another word is fine where the letters agree.
        let fits = true;
        for (let k = 0; k < word.length && fits; k++) {
          const c = grid[(y + dy * k) * n + x + dx * k];
          if (c && c !== word[k]) fits = false;
        }
        if (!fits) continue;
        for (let k = 0; k < word.length; k++) grid[(y + dy * k) * n + x + dx * k] = word[k];
        placed.push({ word, a: y * n + x, b: ey * n + ex });
      }
      if (placed.length < words) continue;
      for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = this.pick(LETTERS);
      return { grid, placed };
    }
  }

  start() {
    const { grid, placed } = this.make();
    this.grid = grid;
    this.placed = placed;
    this.found = []; // { word, a, b } in the order found
    this.nope = 0; // marks that weren't a hidden word, so the screens can shake
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

  /** The letters on the straight line from a to b, or null if a and b aren't on one. */
  read(a, b) {
    const n = SIZES[this.size].n;
    const [ax, ay, bx, by] = [a % n, Math.floor(a / n), b % n, Math.floor(b / n)];
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    if (len === 0 || (dx && dy && Math.abs(bx - ax) !== Math.abs(by - ay)) || ((!dx || !dy) && ax !== bx && ay !== by)) return null;
    let out = '';
    for (let k = 0; k <= len; k++) out += this.grid[(ay + dy * k) * n + ax + dx * k];
    return out;
  }

  mark(a, b) {
    const letters = this.read(a, b);
    // A hidden word, read either way along the line, not found yet.
    const hit = letters && this.placed.find((p) => !this.found.some((f) => f.word === p.word) && ((p.a === a && p.b === b) || (p.a === b && p.b === a)));
    if (!hit) {
      this.nope++;
      return;
    }
    this.found.push(hit);
    if (this.found.length === this.placed.length) {
      this.endedAt = this.ctx.now();
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'mark' || this.phase !== 'play') return;
    const n = SIZES[this.size].n;
    const ok = (i) => Number.isInteger(i) && i >= 0 && i < n * n;
    if (!ok(input.a) || !ok(input.b)) return;
    this.mark(input.a, input.b);
    this.ctx.update();
  }

  get elapsed() {
    return (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
  }

  view() {
    const n = SIZES[this.size].n;
    return {
      phase: this.phase,
      n,
      grid: this.grid.join(''),
      // The words to find (in a steady order), and where the found ones are; the rest stay hidden.
      words: this.placed.map((p) => p.word).sort().map((w) => ({ word: w, found: this.found.some((f) => f.word === w) })),
      found: this.found.map((f) => ({ a: f.a, b: f.b })),
      nope: this.nope,
      elapsed: this.elapsed,
      score: this.phase === 'over' ? this.elapsed : null,
      variant: SIZES[this.size].name,
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
  id: 'wordsearch-1p',
  name: 'Word Search 1P',
  tagline: 'Find the hidden words in the grid of letters. Across, down, diagonal, even backwards.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new WordSearch(ctx, ctx.rng),
};
