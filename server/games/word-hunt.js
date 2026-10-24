// Word Hunt (a word search race). One grid of letters with words hidden in it,
// in straight lines, and one list of the words to find, the same for both
// players. Mark a word from its first letter to its last: it's yours, in your
// colour, and your rival can't have it. Find more than half and the grid is
// yours. The small grid hides them across and down, the medium one diagonally
// too, and the large one in every direction, backwards as well. First to the
// chosen number of grids wins.

import { settingOf } from './options.js';
import { WORDS } from './word-hunt-words.js';

const ACROSS_DOWN = [[1, 0], [0, 1]];
const DIAGONAL = [...ACROSS_DOWN, [1, 1], [1, -1]];
const ALL = [...DIAGONAL, [-1, 0], [0, -1], [-1, -1], [-1, 1]];

// An odd number of words, so a finished grid always has a winner.
export const SIZES = {
  small: { name: '8 × 8', n: 8, words: 7, dirs: ACROSS_DOWN },
  medium: { name: '10 × 10', n: 10, words: 9, dirs: DIAGONAL },
  large: { name: '12 × 12', n: 12, words: 11, dirs: ALL },
};
export const WIN_SCORE = 2;
export const TIMING = {
  countdownMs: 3000,
  gridMs: 180000, // a grid nobody can finish: the one with more words takes it
  resultMs: 5000,
};
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'; // the fill (no Q, X or Z: they'd stand out)

/** The cells on the straight line from a to b on an n-wide grid (across, down or diagonal), or null. */
export function line(n, a, b) {
  const [ax, ay, bx, by] = [a % n, Math.floor(a / n), b % n, Math.floor(b / n)];
  const dx = Math.sign(bx - ax);
  const dy = Math.sign(by - ay);
  if (a === b || (dx && dy && Math.abs(bx - ax) !== Math.abs(by - ay))) return null;
  const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  const out = [];
  for (let k = 0; k <= len; k++) out.push((ay + dy * k) * n + ax + dx * k);
  return out;
}

export class WordHunt {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const size = settingOf(ctx, 'size', 'medium');
    this.size = Object.prototype.hasOwnProperty.call(SIZES, size) ? size : 'medium';
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.timer = null;
  }

  pick(list) {
    return list[Math.floor(this.rng() * list.length)];
  }

  /** A grid with the words hidden in it: { grid: letters, placed: [{ word, a, b }] }, retrying until they all fit. */
  make() {
    const { n, words, dirs } = SIZES[this.size];
    const pool = WORDS.filter((w) => w.length <= n);
    for (;;) {
      const grid = Array(n * n).fill('');
      const placed = [];
      let tries = 0;
      while (placed.length < words && tries++ < 2000) {
        const word = this.pick(pool).toUpperCase();
        if (placed.some((p) => p.word.includes(word) || word.includes(p.word))) continue;
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
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.draw = false;
    this.totalWords = [0, 0];
    this.nextGrid();
  }

  nextGrid() {
    this.round++;
    const { grid, placed } = this.make();
    this.grid = grid;
    this.placed = placed;
    this.found = []; // { word, a, b, slot } in the order found
    this.nope = [0, 0]; // marks that weren't a word left to find, so that player's screen can shake
    this.result = null;
    this.phase = 'countdown';
    this.schedule(() => this.play(), TIMING.countdownMs);
    this.ctx.update();
  }

  play() {
    this.phase = 'play';
    this.endsAt = this.ctx.now() + TIMING.gridMs;
    this.schedule(() => this.finishGrid(), TIMING.gridMs);
    this.ctx.update();
  }

  wordsOf(slot) {
    return this.found.filter((f) => f.slot === slot).length;
  }

  mark(slot, a, b) {
    // A hidden word not found yet, marked either way round.
    const hit = this.placed.find((p) => !this.found.some((f) => f.word === p.word) && ((p.a === a && p.b === b) || (p.a === b && p.b === a)));
    if (!hit) {
      this.nope[slot]++;
      return;
    }
    this.found.push({ ...hit, slot });
    this.totalWords[slot]++;
    // More than half is out of reach for the other player: no need to play the rest.
    if (this.wordsOf(slot) > this.placed.length / 2 || this.found.length === this.placed.length) this.finishGrid();
  }

  finishGrid() {
    const [a, b] = [this.wordsOf(0), this.wordsOf(1)];
    const winner = a === b ? null : a > b ? 0 : 1;
    if (winner !== null) this.scores[winner]++;
    // What's left unfound shows at the end of the grid.
    this.result = { winner, words: [a, b], missed: this.placed.filter((p) => !this.found.some((f) => f.word === p.word)).map((p) => ({ word: p.word, a: p.a, b: p.b })) };
    const champ = this.scores.findIndex((s) => s >= this.winScore);
    if (champ !== -1) {
      this.cancel();
      this.phase = 'over';
      this.winner = champ;
      return;
    }
    this.phase = 'result';
    this.schedule(() => this.nextGrid(), TIMING.resultMs);
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'mark' || this.phase !== 'play') return;
    const n = SIZES[this.size].n;
    const ok = (i) => Number.isInteger(i) && i >= 0 && i < n * n;
    if (!ok(input.a) || !ok(input.b) || !line(n, input.a, input.b)) return;
    this.mark(slot, input.a, input.b);
    this.ctx.update();
  }

  schedule(fn, ms) {
    this.cancel();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
      this.ctx.update();
    }, ms);
  }

  cancel() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  view() {
    const n = SIZES[this.size].n;
    const shown = this.phase !== 'countdown';
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      n,
      sizeName: SIZES[this.size].name,
      grid: shown ? this.grid.join('') : null,
      // The words to find (in a steady order) and who found each; where the rest are stays hidden.
      words: shown ? this.placed.map((p) => p.word).sort().map((w) => {
        const f = this.found.find((x) => x.word === w);
        return { word: w, by: f ? f.slot : null };
      }) : [],
      found: this.found.map((f) => ({ a: f.a, b: f.b, slot: f.slot })),
      counts: [this.wordsOf(0), this.wordsOf(1)],
      timeLeft: this.phase === 'play' ? Math.max(0, this.endsAt - this.ctx.now()) : 0,
      gridMs: TIMING.gridMs,
      nope: this.nope,
      result: this.result,
      winner: this.winner,
      totalWords: this.totalWords,
    };
  }

  hostView() {
    return { ...this.view(), players: this.ctx.players };
  }

  playerView(slot) {
    return { ...this.view(), you: slot };
  }
}

export default {
  id: 'word-hunt',
  music: 'thinking',
  name: 'Word Hunt',
  tagline: 'One word search, two hunters: mark a hidden word first and it\'s yours. Find more than half to take the grid.',
  create: (ctx) => new WordHunt(ctx, ctx.rng),
};
