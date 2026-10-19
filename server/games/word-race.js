// Word Race (Boggle for two). Both players get the same 4x4 grid of letters
// and race to find words by tracing paths of touching tiles (across, down or
// diagonally, each tile at most once per word). Longer words score more.
// When the time's up, words you BOTH found cancel out, so rare finds win.
// Before the first round either player can pick the grid size (4x4 to 6x6),
// the time per round and the match length; the room remembers the choice.
//
// The server checks every word from the path that was traced, against a
// ~275k-word dictionary (the word-list package).

import fs from 'node:fs';
import wordListPath from 'word-list';
import { defaultsOf, loadSettings, applySetting } from './options.js';

export const SIZE = 4; // the default grid
export const MIN_LETTERS = 3;
export const TIMING = { countdownMs: 3000, playMs: 90000, revealMs: 12000 }; // playMs: the default round time

/** What the players can choose in the setup screen; the first value of each is the default. */
export const OPTIONS = {
  size: [4, 5, 6], // grid is size x size
  time: [90, 60, 120, 180], // seconds per round
  rounds: [3, 1, 5], // best of
};
export const DEFAULTS = defaultsOf(OPTIONS);
export const MIN_GRID_WORDS = { 4: 40, 5: 100, 6: 150 }; // reroll grids poorer than this

/** Rounds needed to win a best-of-n match, and when drawn rounds stop it. */
export const winScoreFor = (rounds) => Math.ceil(rounds / 2);
export const maxRoundsFor = (rounds) => rounds + 2;
export const WIN_SCORE = winScoreFor(DEFAULTS.rounds);
export const MAX_ROUNDS = maxRoundsFor(DEFAULTS.rounds);

// The 16 classic Boggle dice. 'Q' is the "Qu" face.
const DICE = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS', 'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW', 'EIOSST', 'ELRTTY', 'HIMNUQ', 'HLNNRZ',
];
// The 25 Big Boggle dice, for 5x5. 6x6 adds 11 of the classic dice to these.
const BIG_DICE = [
  'AAAFRS', 'AAEEEE', 'AAFIRS', 'ADENNN', 'AEEEEM', 'AEEGMU', 'AEGMNN', 'AFIRSY', 'BJKQXZ',
  'CCENST', 'CEIILT', 'CEILPT', 'CEIPST', 'DDHNOT', 'DHHLOR', 'DHLNOR', 'DHLNOR', 'EIIITT',
  'EMOTTT', 'ENSSSU', 'FIPRSY', 'GORRVW', 'IPRRRY', 'NOOTUW', 'OOOTTU',
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

let WORDS = null; // sorted, lower case, 3+ letters

export function dictionary() {
  if (!WORDS) {
    WORDS = fs.readFileSync(wordListPath, 'utf8')
      .split('\n')
      .filter((w) => w.length >= MIN_LETTERS && /^[a-z]+$/.test(w))
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

/** The side of a square grid. */
const sideOf = (grid) => Math.round(Math.sqrt(grid.length));

export function neighbours(i, size = SIZE) {
  const r = Math.floor(i / size);
  const c = i % size;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) out.push(rr * size + cc);
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
  const size = sideOf(grid);
  const near = grid.map((_, i) => neighbours(i, size));
  function walk(i, sofar) {
    const word = sofar + tileText(grid[i]);
    if (!isPrefix(word)) return;
    if (word.length >= MIN_LETTERS && isWord(word)) found.add(word);
    used[i] = true;
    for (const n of near[i]) if (!used[n]) walk(n, word);
    used[i] = false;
  }
  for (let i = 0; i < grid.length; i++) walk(i, '');
  return found;
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function rollGrid(size = SIZE, rng = Math.random) {
  let dice = DICE.slice();
  if (size === 5) dice = BIG_DICE.slice();
  if (size === 6) dice = BIG_DICE.concat(shuffle(DICE.slice(), rng).slice(0, 11));
  return shuffle(dice, rng).map((d) => d[Math.floor(rng() * 6)]);
}

/** The word a traced path spells, or null if the path isn't a valid trace. */
export function spell(grid, path) {
  if (!Array.isArray(path) || path.length < 2 || path.length > grid.length) return null;
  const size = sideOf(grid);
  const seen = new Set();
  let word = '';
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (!Number.isInteger(i) || i < 0 || i >= grid.length || seen.has(i)) return null;
    if (k > 0 && !neighbours(path[k - 1], size).includes(i)) return null;
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
    this.settings = loadSettings(ctx, OPTIONS); // what the room picked last time, else the defaults
  }

  /** The setup screen: pick the grid size, time and match length. */
  start() {
    this.stopTimer();
    this.phase = 'setup';
    this.phaseEnds = null;
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.draw = false;
    this.grid = null;
    this.possible = 0;
    this.words = [[], []];
    this.feedback = [null, null];
    this.result = null;
    this.ctx.update();
  }

  begin() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.draw = false;
    this.newRound();
  }

  get winScore() {
    return winScoreFor(this.settings.rounds);
  }

  newRound() {
    this.round++;
    const size = this.settings.size;
    let grid;
    let all;
    for (let tries = 0; tries < 30; tries++) {
      grid = rollGrid(size, this.rng);
      all = solve(grid);
      if (all.size >= MIN_GRID_WORDS[size]) break;
    }
    this.grid = grid;
    this.possible = all.size;
    this.words = [[], []]; // per player: words found, in order
    this.feedback = [null, null]; // last answer to each player's attempt
    this.seq = 0;
    this.result = null;
    this.runPhase('countdown', TIMING.countdownMs, () => this.runPhase('play', this.settings.time * 1000, () => this.endRound()));
  }

  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.onPhaseEnd = onEnd;
    this.ctx.update();
    this.scheduleStep();
  }

  stopTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
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
    if (winner !== null && this.scores[winner] >= this.winScore) return this.finish(winner);
    if (this.round >= maxRoundsFor(this.settings.rounds)) {
      const [a, b] = this.scores;
      return this.finish(a === b ? null : a > b ? 0 : 1);
    }
    this.runPhase('reveal', TIMING.revealMs, () => this.newRound());
  }

  finish(winner) {
    this.stopTimer();
    this.winner = winner;
    this.draw = winner === null;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (this.phase === 'setup') {
      if (input.type === 'setting' && applySetting(this.ctx, OPTIONS, this.settings, input.key, input.value)) this.ctx.update();
      if (input.type === 'go') this.begin();
      return;
    }
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.begin(); // same settings
      if (input.type === 'setup') this.start();
      return;
    }
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
      size: this.settings.size,
      settings: this.settings,
      options: OPTIONS,
      grid: this.phase === 'countdown' || this.phase === 'setup' ? null : this.grid,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      playMs: this.settings.time * 1000,
      counts: this.words.map((w) => w.length),
      possible: this.possible,
      result: revealing ? this.result : null,
      scores: this.scores,
      winScore: this.winScore,
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
  phoneOnly: true, // you swipe words on the phone
  music: 'thinking',
  name: 'Word Race',
  tagline: 'Same letter grid, against the clock: swipe words on your phone. Words you both find cancel out, so go rare. Pick the grid size, time and rounds.',
  create: (ctx) => new WordRace(ctx),
};
