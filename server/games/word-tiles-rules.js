// Word Tiles' rules, for the game and its computer player: the tiles, the board's bonus squares,
// checking a play and scoring it, and finding plays.

import fs from 'node:fs';
import wordListPath from 'word-list';

export const N = 11;
export const CENTRE = 5 * N + 5;
export const RACK = 7;
export const ALL_SEVEN = 25; // the bonus for playing all seven tiles at once

// Our own tile mix (84 tiles, no blanks) and letter values.
export const COUNTS = { e: 10, a: 7, i: 7, o: 6, n: 5, r: 5, t: 5, l: 4, s: 4, u: 3, d: 3, g: 3, b: 2, c: 2, m: 2, p: 2, f: 2, h: 2, w: 2, y: 2, v: 1, k: 1, j: 1, x: 1, q: 1, z: 1 };
export const POINTS = { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 4, l: 1, m: 3, n: 1, o: 1, p: 3, q: 8, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 8 };

// The bonus squares (one quarter of the board, mirrored): 'W3', 'W2', 'L3', 'L2'.
const QUARTER = { '0,0': 'W3', '0,5': 'W3', '1,1': 'W2', '2,2': 'W2', '3,3': 'L3', '0,3': 'L2', '1,4': 'L3', '2,5': 'L2', '4,4': 'L2', '5,5': 'W2' };
export const BONUS = new Array(N * N).fill(null);
for (const [key, b] of Object.entries(QUARTER)) {
  const [r, c] = key.split(',').map(Number);
  for (const [rr, cc] of [[r, c], [c, r], [N - 1 - r, c], [r, N - 1 - c], [N - 1 - r, N - 1 - c], [c, N - 1 - r], [N - 1 - c, r], [N - 1 - c, N - 1 - r]]) BONUS[rr * N + cc] = b;
}

let WORDS = null;
/** Every word of 2 to 11 letters (the word-list package's dictionary). */
export function words() {
  if (!WORDS) {
    WORDS = new Set(fs.readFileSync(wordListPath, 'utf8').split('\n').filter((w) => w.length >= 2 && w.length <= N && /^[a-z]+$/.test(w)));
  }
  return WORDS;
}
export const isWord = (w) => words().has(w);

/** A full bag, shuffled. */
export function newBag(rng) {
  const bag = [];
  for (const [l, k] of Object.entries(COUNTS)) for (let i = 0; i < k; i++) bag.push(l);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/**
 * Checks a play: `tiles` [{ cell, letter }] on `board` (letters or null). Returns { words: [{ word,
 * cells, score }], score } or { error: why not }. `isWordFn`: the dictionary (or a stand-in).
 */
export function checkPlay(board, tiles, isWordFn = isWord) {
  if (!tiles.length) return { error: 'No tiles' };
  const cells = tiles.map((t) => t.cell);
  if (new Set(cells).size !== cells.length) return { error: 'Two tiles on one square' };
  if (cells.some((c) => c < 0 || c >= N * N || board[c])) return { error: 'That square is taken' };
  const rows = new Set(cells.map((c) => Math.floor(c / N)));
  const cols = new Set(cells.map((c) => c % N));
  if (rows.size > 1 && cols.size > 1) return { error: 'Tiles must go in one line' };
  const across = rows.size === 1 && (cols.size > 1 || hasNeighbourAcross(board, cells[0]));
  const step = across ? 1 : N;
  const placed = new Map(tiles.map((t) => [t.cell, t.letter]));
  const at = (c) => placed.get(c) || board[c];
  // No gaps along the line between the first and last tile.
  const sorted = cells.slice().sort((a, b) => a - b);
  for (let c = sorted[0]; c <= sorted[sorted.length - 1]; c += step) if (!at(c)) return { error: 'Leave no gaps' };
  const empty = board.every((x) => !x);
  if (empty && !placed.has(CENTRE)) return { error: 'The first word must cover the middle square' };
  const found = [];
  const main = wordThrough(at, sorted[0], across);
  if (main.cells.length >= 2) found.push(main);
  for (const c of cells) {
    const cross = wordThrough(at, c, !across);
    if (cross.cells.length >= 2) found.push(cross);
  }
  if (!found.length) return { error: 'A word needs two letters or more' };
  if (!empty && !found.some((w) => w.cells.some((c) => board[c]))) return { error: 'Join on to the words already down' };
  let score = 0;
  for (const w of found) {
    if (!isWordFn(w.word)) return { error: 'Not a word: ' + w.word.toUpperCase() };
    let sum = 0;
    let times = 1;
    for (const c of w.cells) {
      const fresh = placed.has(c);
      const b = fresh ? BONUS[c] : null;
      sum += POINTS[at(c)] * (b === 'L2' ? 2 : b === 'L3' ? 3 : 1);
      if (b === 'W2') times *= 2;
      if (b === 'W3') times *= 3;
    }
    w.score = sum * times;
    score += w.score;
  }
  if (tiles.length === RACK) score += ALL_SEVEN;
  return { words: found, score };
}

function hasNeighbourAcross(board, c) {
  const col = c % N;
  return (col > 0 && board[c - 1]) || (col < N - 1 && board[c + 1]);
}

/** The full run of letters through `c` (across or down): { word, cells }. */
function wordThrough(at, c, across) {
  const step = across ? 1 : N;
  const sameLine = (a, b) => (across ? Math.floor(a / N) === Math.floor(b / N) : true);
  let start = c;
  while (start - step >= 0 && sameLine(start - step, c) && at(start - step)) start -= step;
  const cells = [];
  for (let x = start; x < N * N && sameLine(x, c) && at(x); x += step) cells.push(x);
  return { word: cells.map(at).join(''), cells };
}

/**
 * Plays for `rack` on `board`, from the words in `list`: each a { tiles, score, words }. It lays
 * each word along every row and column where it fits the letters already there, uses the rack for
 * the rest, and keeps the ones that check out.
 */
export function findPlays(board, rack, list, isWordFn = isWord) {
  const out = [];
  const empty = board.every((x) => !x);
  const have = {};
  for (const l of rack) have[l] = (have[l] || 0) + 1;
  const onBoard = new Set(board.filter(Boolean));
  // Only words the rack (plus letters already down) could make.
  const usable = list.filter((w) => {
    if (w.length < 2 || w.length > N) return false;
    const need = {};
    let short = 0;
    for (const l of w) {
      need[l] = (need[l] || 0) + 1;
      if (need[l] > (have[l] || 0)) { if (empty || !onBoard.has(l)) return false; short++; }
    }
    return empty ? true : short <= 3 && (short > 0 || w.length <= RACK);
  });
  const seen = new Set();
  for (const across of [true, false]) {
    for (let line = 0; line < N; line++) {
      for (const w of usable) {
        for (let start = 0; start + w.length <= N; start++) {
          const cellAt = (k) => (across ? line * N + start + k : (start + k) * N + line);
          // The squares just before and after must be empty (or it would be a longer word).
          if (start > 0 && board[cellAt(-1)]) continue;
          if (start + w.length < N && board[cellAt(w.length)]) continue;
          const left = { ...have };
          const tiles = [];
          let ok = true;
          let touches = false;
          for (let k = 0; k < w.length; k++) {
            const c = cellAt(k);
            if (board[c]) {
              if (board[c] !== w[k]) { ok = false; break; }
              touches = true;
            } else {
              if (!left[w[k]]) { ok = false; break; }
              left[w[k]]--;
              tiles.push({ cell: c, letter: w[k] });
            }
          }
          if (!ok || !tiles.length) continue;
          if (empty ? !tiles.some((t) => t.cell === CENTRE) : !touches && !tiles.some((t) => nextTo(board, t.cell))) continue;
          const key = tiles.map((t) => t.cell + t.letter).join();
          if (seen.has(key)) continue;
          seen.add(key);
          const r = checkPlay(board, tiles, isWordFn);
          if (!r.error) out.push({ tiles, score: r.score, words: r.words.map((x) => x.word) });
        }
      }
    }
  }
  return out;
}

function nextTo(board, c) {
  const r = Math.floor(c / N);
  const col = c % N;
  return (r > 0 && board[c - N]) || (r < N - 1 && board[c + N]) || (col > 0 && board[c - 1]) || (col < N - 1 && board[c + 1]);
}
