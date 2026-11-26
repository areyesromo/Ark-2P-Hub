// Peg Solitaire. Jump a peg over a neighbour (across or down) into an empty hole just beyond it;
// the peg jumped over comes off. Keep going until no jump is left. The fewer pegs left the better:
// one is a win, and one in the middle is a perfect game. The classic English board (33 holes,
// the middle one empty), the European one (37 holes), and some small warm-ups on the English board.
// Score: the pegs left (fewer is better), per board.

import { settingOf } from './options.js';

// 'o' a peg, '.' an empty hole, ' ' no hole. The English board and the warm-ups solve to one peg in
// the middle (the tests check); the European one is a stiffer test, started one hole down from the top.
export const BOARDS = {
  cross: { name: 'Cross (a warm-up)', rows: ['  ...  ', '  .o.  ', '..ooo..', '...o...', '...o...', '  ...  ', '  ...  '] },
  plus: { name: 'Plus (a warm-up)', rows: ['  ...  ', '  .o.  ', '...o...', '.ooooo.', '...o...', '  .o.  ', '  ...  '] },
  arrow: { name: 'Arrow', rows: ['  .o.  ', '  ooo  ', '.ooooo.', '...o...', '...o...', '  ooo  ', '  ooo  '] },
  pyramid: { name: 'Pyramid', rows: ['  ...  ', '  .o.  ', '..ooo..', '.ooooo.', 'ooooooo', '  ...  ', '  ...  '] },
  english: { name: 'English (33 holes)', rows: ['  ooo  ', '  ooo  ', 'ooooooo', 'ooo.ooo', 'ooooooo', '  ooo  ', '  ooo  '] },
  european: { name: 'European (37 holes)', rows: ['  ooo  ', ' oo.oo ', 'ooooooo', 'ooooooo', 'ooooooo', ' ooooo ', '  ooo  '] },
};
export const ORDER = ['english', 'cross', 'plus', 'arrow', 'pyramid', 'european'];
const SIZE = 7;
const CENTRE = 24; // the middle of the 7 × 7
const HINT_BUDGET = 60000;

/** A board's holes (squares that exist) and pegs, as 49-square lists. */
export function parseBoard(rows) {
  const holes = [];
  const pegs = new Array(SIZE * SIZE).fill(false);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ' ') return;
    holes.push(y * SIZE + x);
    if (ch === 'o') pegs[y * SIZE + x] = true;
  }));
  return { holes, pegs };
}

/** Every jump on a board: [from, over, to] (all three holes, in a straight line). */
export function jumpsOf(holes) {
  const has = new Set(holes);
  const out = [];
  for (const a of holes) {
    const x = a % SIZE;
    const y = Math.floor(a / SIZE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = x + dx;
      const by = y + dy;
      const cx = x + 2 * dx;
      const cy = y + 2 * dy;
      if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) continue;
      const b = by * SIZE + bx;
      const c = cy * SIZE + cx;
      if (has.has(b) && has.has(c)) out.push([a, b, c]);
    }
  }
  return out;
}

export const legal = (pegs, jumps) => jumps.filter(([a, b, c]) => pegs[a] && pegs[b] && !pegs[c]);

/**
 * A way down to one peg (in the middle if `centre`), as a list of jumps, or null; `budget` caps the
 * positions looked at ({ exhausted: true } on the result's object when it ran out).
 * Positions found to be dead ends are remembered, so the search doesn't go down them twice.
 */
export function solve(pegs, jumps, centre, budget = 400000) {
  const board = pegs.slice();
  let left = board.filter(Boolean).length;
  // A position's key: the pegs as a number (the 49 squares fit in a double exactly).
  let key = 0;
  const bit = (i) => 2 ** i;
  board.forEach((p, i) => { if (p) key += bit(i); });
  const dead = new Set();
  const path = [];
  const state = { looked: 0, exhausted: false };
  const go = () => {
    if (left === 1) return !centre || board[CENTRE];
    if (dead.has(key)) return false;
    if (++state.looked > budget) { state.exhausted = true; return false; }
    for (const j of jumps) {
      const [a, b, c] = j;
      if (!board[a] || !board[b] || board[c]) continue;
      board[a] = board[b] = false;
      board[c] = true;
      key += bit(c) - bit(a) - bit(b);
      left--;
      path.push(j);
      if (go()) return true;
      path.pop();
      left++;
      key -= bit(c) - bit(a) - bit(b);
      board[a] = board[b] = true;
      board[c] = false;
      if (state.exhausted) return false;
    }
    dead.add(key);
    return false;
  };
  const ok = go();
  return { path: ok ? path : null, exhausted: state.exhausted };
}

export class Peg {
  constructor(ctx) {
    this.ctx = ctx;
    const b = settingOf(ctx, 'board', 'english');
    this.boardId = BOARDS[b] ? b : 'english';
  }

  start() {
    const { holes } = parseBoard(BOARDS[this.boardId].rows);
    this.holes = holes;
    this.jumps = jumpsOf(holes);
    this.restart();
  }

  restart() {
    this.pegs = parseBoard(BOARDS[this.boardId].rows).pegs;
    this.history = [];
    this.last = null;
    this.hints = 0;
    this.hint = null; // a suggested jump [from, over, to]
    this.hintNo = 0;
    this.stuck = false; // the last hint found no way down to one peg from here
    this.busy = false; // the last hint ran out of time to look (a big board early on)
    this.phase = 'play';
    this.ctx.update();
  }

  get left() {
    return this.pegs.filter(Boolean).length;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'undo' && this.history.length && (this.phase === 'play' || this.phase === 'over')) {
      // (also after the last jump: one more go from just before it)
      const [a, b, c] = this.history.pop();
      this.pegs[a] = this.pegs[b] = true;
      this.pegs[c] = false;
      this.last = this.history[this.history.length - 1] || null;
      this.phase = 'play';
      this.hint = null;
      return this.ctx.update();
    }
    if (this.phase !== 'play') return;
    if (input.type === 'jump') {
      const j = legal(this.pegs, this.jumps).find(([a, , c]) => a === input.from && c === input.to);
      if (!j) return;
      const [a, b, c] = j;
      this.pegs[a] = this.pegs[b] = false;
      this.pegs[c] = true;
      this.history.push(j);
      this.last = j;
      this.hint = null;
      this.stuck = this.busy = false;
      if (!legal(this.pegs, this.jumps).length) this.phase = 'over';
    } else if (input.type === 'restart' && this.history.length) {
      return this.restart();
    } else if (input.type === 'hint') {
      // A jump on a way to one peg in the middle, else to one peg anywhere.
      // (a small budget, so the hub never stalls looking: about a fifth of a second)
      let s = solve(this.pegs, this.jumps, true, HINT_BUDGET);
      if (!s.path) s = solve(this.pegs, this.jumps, false, HINT_BUDGET);
      this.hints++;
      this.hintNo++;
      this.hint = s.path ? s.path[0] : null;
      this.stuck = !s.path && !s.exhausted;
      this.busy = !s.path && s.exhausted;
    } else return;
    this.ctx.update();
  }

  view() {
    const over = this.phase === 'over';
    const left = this.left;
    return {
      phase: this.phase,
      board: this.boardId,
      boardName: BOARDS[this.boardId].name,
      holes: this.holes,
      pegs: this.pegs,
      centre: CENTRE,
      jumps: this.phase === 'play' ? legal(this.pegs, this.jumps).map(([a, , c]) => [a, c]) : [],
      last: this.last,
      left,
      start: parseBoard(BOARDS[this.boardId].rows).pegs.filter(Boolean).length,
      hint: this.hint,
      hintNo: this.hintNo,
      hints: this.hints,
      stuck: this.stuck,
      busy: this.busy,
      canUndo: this.history.length > 0,
      perfect: over && left === 1 && this.pegs[CENTRE],
      won: over,
      score: over ? left : null,
      variant: BOARDS[this.boardId].name.replace(/ \(.*\)$/, ''),
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
  id: 'peg',
  name: 'Peg Solitaire',
  tagline: 'Jump pegs over each other to take them off. Finish with one, in the middle for a perfect game.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'pegs' },
  create: (ctx) => new Peg(ctx),
};
