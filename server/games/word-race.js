// Word Race (Boggle for two). Both players get the same 4x4 grid of letters
// and race to find words by tracing paths of touching tiles (across, down or
// diagonally, each tile at most once per word). Longer words score more.
// When the time's up, words you BOTH found cancel out, so rare finds win.
// Best of 3 rounds.
//
// The server checks every word from the path that was traced, against a
// ~275k-word dictionary (the word-list package).

import fs from 'node:fs';
import wordListPath from 'word-list';

export const SIZE = 4;
export const WIN_SCORE = 2; // rounds needed: best of 3
export const MAX_ROUNDS = 5; // drawn rounds can stretch a match; after this, most rounds won takes it
export const MIN_LETTERS = 3;
export const MIN_GRID_WORDS = 40; // reroll grids poorer than this
export const TIMING = { countdownMs: 3000, playMs: 90000, revealMs: 12000 };

// The 16 classic Boggle dice. 'Q' is the "Qu" face.
const DICE = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS', 'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW', 'EIOSST', 'ELRTTY', 'HIMNUQ', 'HLNNRZ',
];

/** Boggle scoring by word length. */
export function wordPoints(word) {
  const n = word.length;
  if (n < MIN_LETTERS) return 0;
  if (n <= 4) return 1;
  if (n === 5) return 2;
  if (n === 6) return 3;
  if (n === 7) return 5;
  return 11;
}

// ---- dictionary ---------------------------------------------------------------

let WORDS = null; // sorted, lower case, 3..17 letters

export function dictionary() {
  if (!WORDS) {
    WORDS = fs.readFileSync(wordListPath, 'utf8')
      .split('\n')
      .filter((w) => w.length >= MIN_LETTERS && w.length <= SIZE * SIZE + 1 && /^[a-z]+$/.test(w))
      .sort();
  }
  return WORDS;
}

/** Index of the first word >= s in the sorted list. */
function lowerBound(words, s) {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function isWord(w) {
  const words = dictionary();
  return words[lowerBound(words, w)] === w;
}

function isPrefix(p) {
  const words = dictionary();
  const w = words[lowerBound(words, p)];
  return w !== undefined && w.startsWith(p);
}

// ---- grid -----------------------------------------------------------------------

export function neighbours(i) {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
  }
  return out;
}

/** The letters a tile adds to a word ('Q' spells "qu"). */
const tileText = (face) => (face === 'Q' ? 'qu' : face.toLowerCase());

/** Every dictionary word in a grid (a plain depth-first search with prefix pruning). */
export function solve(grid) {
  const found = new Set();
  const used = new Array(grid.length).fill(false);
  function walk(i, sofar) {
    const word = sofar + tileText(grid[i]);
    if (!isPrefix(word)) return;
    if (word.length >= MIN_LETTERS && isWord(word)) found.add(word);
    used[i] = true;
    for (const n of neighbours(i)) if (!used[n]) walk(n, word);
    used[i] = false;
  }
  for (let i = 0; i < grid.length; i++) walk(i, '');
  return found;
}

export function rollGrid(rng = Math.random) {
  const dice = DICE.slice();
  for (let i = dice.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dice[i], dice[j]] = [dice[j], dice[i]];
  }
  return dice.map((d) => d[Math.floor(rng() * 6)]);
}

/** The word a traced path spells, or null if the path isn't a valid trace. */
export function spell(grid, path) {
  if (!Array.isArray(path) || path.length < 2 || path.length > grid.length) return null;
  const seen = new Set();
  let word = '';
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (!Number.isInteger(i) || i < 0 || i >= grid.length || seen.has(i)) return null;
    if (k > 0 && !neighbours(path[k - 1]).includes(i)) return null;
    seen.add(i);
    word += tileText(grid[i]);
  }
  return word;
}

// ---- game -------------------------------------------------------------------------

export class WordRace {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.draw = false;
    this.newRound();
  }

  newRound() {
    this.round++;
    let grid;
    let all;
    for (let tries = 0; tries < 30; tries++) {
      grid = rollGrid(this.rng);
      all = solve(grid);
      if (all.size >= MIN_GRID_WORDS) break;
    }
    this.grid = grid;
    this.possible = all.size;
    this.words = [[], []]; // per player: words found, in order
    this.feedback = [null, null]; // last answer to each player's attempt
    this.seq = 0;
    this.result = null;
    this.runPhase('countdown', TIMING.countdownMs, () => this.runPhase('play', TIMING.playMs, () => this.endRound()));
  }

  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.onPhaseEnd = onEnd;
    this.ctx.update();
    this.scheduleStep();
  }

  scheduleStep() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleStep();
      } else {
        this.onPhaseEnd();
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  endRound() {
    // Words both players found cancel out.
    const sets = this.words.map((ws) => new Set(ws));
    const tally = this.words.map((ws, slot) =>
      ws.map((w) => {
        const shared = sets[1 - slot].has(w);
        return { word: w, points: shared ? 0 : wordPoints(w), shared };
      }),
    );
    const points = tally.map((t) => t.reduce((s, x) => s + x.points, 0));
    const winner = points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1;
    if (winner !== null) this.scores[winner]++;
    this.result = { tally, points, winner };
    if (winner !== null && this.scores[winner] >= WIN_SCORE) return this.finish(winner);
    if (this.round >= MAX_ROUNDS) {
      const [a, b] = this.scores;
      return this.finish(a === b ? null : a > b ? 0 : 1);
    }
    this.runPhase('reveal', TIMING.revealMs, () => this.newRound());
  }

  finish(winner) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.winner = winner;
    this.draw = winner === null;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'word' || this.phase !== 'play') return;
    const word = spell(this.grid, input.path);
    if (word === null) return;
    let reply;
    if (word.length < MIN_LETTERS) reply = { ok: false, reason: 'short' };
    else if (this.words[slot].includes(word)) reply = { ok: false, reason: 'again' };
    else if (!isWord(word)) reply = { ok: false, reason: 'unknown' };
    else {
      this.words[slot].push(word);
      reply = { ok: true, points: wordPoints(word) };
    }
    this.feedback[slot] = Object.assign({ word, seq: ++this.seq }, reply);
    this.ctx.update();
  }

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  common() {
    const revealing = this.phase === 'reveal' || this.phase === 'over';
    return {
      phase: this.phase,
      round: this.round,
      size: SIZE,
      grid: this.phase === 'countdown' ? null : this.grid,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      playMs: TIMING.playMs,
      counts: this.words.map((w) => w.length),
      possible: this.possible,
      result: revealing ? this.result : null,
      scores: this.scores,
      winScore: WIN_SCORE,
      winner: this.winner,
      draw: this.draw,
    };
  }

  hostView() {
    return Object.assign(this.common(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.common(), {
      you: slot,
      yourWords: this.words[slot].map((w) => ({ word: w, points: wordPoints(w) })),
      feedback: this.feedback[slot],
    });
  }
}

export default {
  id: 'word-race',
  name: 'Word Race',
  tagline: 'Same letter grid, 90 seconds: swipe words on your phone. Words you both find cancel out, so go rare. Best of 3.',
  create: (ctx) => new WordRace(ctx),
};
