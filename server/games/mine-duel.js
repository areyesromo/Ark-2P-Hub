// Mine Duel: one minefield, turns. Here you want the mines: open a square with a mine under it and
// it's yours (a point) and you go again. Open a safe square and it shows how many mines touch it
// (an empty one opens up its neighbours too), and it's the other's turn: so a careless dig hands
// them clues. More than half the mines wins the game. Each turn has a clock: run out and a random
// square is dug for you.
//
// In the 1 player lobby it's Minesweeper (soloMinesweeper, the Minesweeper class below): the same
// kind of field, the other goal. Uncover every square that isn't a mine; flag the ones you're sure of.
// The first square you open is always safe, and opening a number whose mines are all flagged opens
// the rest round it ("chording"). Three fields. Score: the time to clear it, only if you do.

import { settingOf } from './options.js';

export const SIZE = 12;
export const MINES = 25; // (odd: no level games)
export const NEED = Math.floor(MINES / 2) + 1;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 25000, roundEndMs: 6000 };
// In a view's board: null covered, 0..8 opened (mines touching), MINE + slot claimed, MINE + 2 a
// mine nobody found (only shown once the game's over).
export const MINE = 10;

/** The cells around one on a w × h board (the duel's is SIZE × SIZE). */
export function neighbours(cell, w = SIZE, h = SIZE) {
  const x = cell % w;
  const y = Math.floor(cell / w);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
  }
  return out;
}

export class MineDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.starter = null;
    this.newRound();
  }

  newRound() {
    this.clearTimer();
    this.round++;
    const cells = [...Array(SIZE * SIZE).keys()];
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    this.mines = cells.slice(0, MINES).sort((a, b) => a - b);
    this.counts = new Array(SIZE * SIZE).fill(0);
    for (const m of this.mines) for (const n of neighbours(m)) this.counts[n]++;
    this.board = new Array(SIZE * SIZE).fill(null);
    this.found = [0, 0];
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null;
    this.result = null;
    this.moveNo = 0;
    this.phase = 'play';
    this.startTurn();
  }

  // ---- clock --------------------------------------------------------------------

  startTurn() {
    this.clearTimer();
    if (!this.clock) {
      this.turnEnds = null;
      return this.ctx.update();
    }
    this.turnEnds = this.ctx.now() + TIMING.turnMs;
    this.after = 'tick';
    this.ctx.update();
    this.scheduleTick();
  }

  scheduleTick() {
    this.clearTimer();
    const left = this.turnEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      if (this.turnEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleTick();
      } else {
        const covered = this.board.map((v, c) => (v === null ? c : -1)).filter((c) => c >= 0);
        this.dig(this.turn, covered[Math.floor(this.rng() * covered.length)]);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.turnEnds) {
      this.turnEnds += downMs;
      this.scheduleTick();
    } else if (this.phase === 'roundEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.roundEndMs);
    }
  }

  // ---- digging --------------------------------------------------------------------

  dig(slot, cell) {
    this.moveNo++;
    if (this.mines.includes(cell)) {
      this.board[cell] = MINE + slot;
      this.found[slot]++;
      this.lastMove = { cell, mine: true, by: slot, n: this.moveNo, opened: [cell] };
      if (this.found[slot] >= NEED) return this.endRound(slot);
      return this.startTurn(); // (a mine: you go again)
    }
    // Open it, and every empty square's neighbours with it.
    const opened = [];
    const todo = [cell];
    while (todo.length) {
      const c = todo.pop();
      if (this.board[c] !== null) continue;
      this.board[c] = this.counts[c];
      opened.push(c);
      if (this.counts[c] === 0) for (const n of neighbours(c)) if (this.board[n] === null && !this.mines.includes(n)) todo.push(n);
    }
    this.lastMove = { cell, mine: false, by: slot, n: this.moveNo, opened };
    this.turn = 1 - slot;
    this.startTurn();
  }

  endRound(winner) {
    this.clearTimer();
    this.result = { winner, found: this.found.slice() };
    this.scores[winner]++;
    this.turnEnds = null;
    if (this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'dig' || this.phase !== 'play' || slot !== this.turn) return;
    const cell = input.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || this.board[cell] !== null) return;
    this.dig(slot, cell);
  }

  // ---- views ------------------------------------------------------------------------

  view() {
    // The mines nobody found show only once the game is over.
    const board = this.phase === 'play' ? this.board : this.board.map((v, c) => (v === null && this.mines.includes(c) ? MINE + 2 : v));
    return {
      phase: this.phase,
      round: this.round,
      size: SIZE,
      mines: MINES,
      need: NEED,
      board,
      found: this.found,
      turn: this.turn,
      lastMove: this.lastMove,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.phase === 'play' && this.turnEnds ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot });
  }
}

/** 1 player: the fields to clear. */
export const SIZES = {
  easy: { name: 'Easy', w: 9, h: 9, mines: 10 },
  medium: { name: 'Medium', w: 16, h: 16, mines: 40 },
  hard: { name: 'Hard', w: 30, h: 16, mines: 99 },
};

/** 1 player: Minesweeper (see the top of this file). Its own class: the same board, a different goal. */
export class Minesweeper {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const size = settingOf(ctx, 'size', 'easy');
    this.size = SIZES[size] ? size : 'easy';
    this.timer = null;
  }

  get cfg() {
    return SIZES[this.size];
  }

  start() {
    const { w, h } = this.cfg;
    this.mines = null; // Set of cell indexes, laid on the first open
    this.open = new Set();
    this.flags = new Set();
    this.boom = null; // the mine that went off
    this.startedAt = null;
    this.endedAt = null;
    this.won = false;
    this.phase = 'play';
    this.n = w * h;
    // One update a second keeps the clock moving on screen between moves.
    this.clock();
    this.ctx.update();
  }

  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      if (this.startedAt !== null) this.ctx.update();
      this.clock();
    }, 1000);
  }

  neighbours(i) {
    return neighbours(i, this.cfg.w, this.cfg.h);
  }

  /** Lay the mines anywhere but the first cell opened and its neighbours. */
  layMines(first) {
    const keepClear = new Set([first, ...this.neighbours(first)]);
    // On a tiny board there may not be room to keep all the neighbours clear: then only the cell itself.
    const pool = [...Array(this.n).keys()].filter((i) => (this.n - keepClear.size >= this.cfg.mines ? !keepClear.has(i) : i !== first));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.mines = new Set(pool.slice(0, this.cfg.mines));
  }

  count(i) {
    return this.neighbours(i).filter((j) => this.mines.has(j)).length;
  }

  /** Open a cell; a 0 opens its neighbours too (flood fill). */
  reveal(i) {
    if (this.open.has(i) || this.flags.has(i)) return;
    if (this.mines.has(i)) {
      this.boom = i;
      return this.end(false);
    }
    const stack = [i];
    while (stack.length) {
      const c = stack.pop();
      if (this.open.has(c) || this.flags.has(c)) continue;
      this.open.add(c);
      if (this.count(c) === 0) for (const j of this.neighbours(c)) if (!this.open.has(j)) stack.push(j);
    }
    if (this.open.size === this.n - this.cfg.mines) this.end(true);
  }

  end(won) {
    this.won = won;
    this.endedAt = this.ctx.now();
    this.phase = 'over';
    if (won) for (const m of this.mines) this.flags.add(m);
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    const i = input.cell;
    if (!Number.isInteger(i) || i < 0 || i >= this.n) return;
    if (input.type === 'flag') {
      if (this.open.has(i)) return;
      if (this.flags.has(i)) this.flags.delete(i);
      else this.flags.add(i);
    } else if (input.type === 'open') {
      if (!this.mines) {
        this.layMines(i);
        this.startedAt = this.ctx.now();
      }
      if (this.open.has(i)) {
        // Chording: as many flags around a number as it says opens everything else around it.
        const around = this.neighbours(i);
        if (around.filter((j) => this.flags.has(j)).length !== this.count(i)) return;
        for (const j of around) if (this.phase === 'play') this.reveal(j);
      } else {
        this.reveal(i);
      }
    } else {
      return;
    }
    this.ctx.update();
  }

  get elapsed() {
    if (this.startedAt === null) return 0;
    return (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
  }

  /**
   * The board as one character per cell: '#' covered, 'F' flagged, '0'-'8'
   * open. Mines only show once it's over: '*' a mine, 'X' the one that went
   * off, 'W' a flag that was wrong.
   */
  board() {
    let s = '';
    const over = this.phase === 'over';
    for (let i = 0; i < this.n; i++) {
      const mine = over && this.mines && this.mines.has(i);
      if (this.open.has(i)) s += String(this.count(i));
      else if (over && i === this.boom) s += 'X';
      else if (this.flags.has(i)) s += over && !mine ? 'W' : 'F';
      else s += mine ? '*' : '#';
    }
    return s;
  }

  view() {
    const { w, h, mines, name } = this.cfg;
    return {
      solo: true, // (the screens: Minesweeper's, not Mine Duel's)
      phase: this.phase,
      w,
      h,
      mines,
      flags: this.flags.size,
      board: this.board(),
      elapsed: this.elapsed,
      started: this.startedAt !== null,
      won: this.won,
      // Only a cleared field counts, and the time is the score (lower is better).
      score: this.phase === 'over' && this.won ? this.elapsed : null,
      variant: name,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

/** The 1 player mode, Minesweeper: played as a solo game (see server/solo/). */
export const soloMinesweeper = {
  id: 'mine-duel',
  name: 'Minesweeper',
  tagline: 'Clear the field without setting off a mine. Numbers count the mines next door.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Minesweeper(ctx, ctx.rng),
};

export default {
  id: 'mine-duel',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Mine Duel',
  tagline: 'One minefield, and you want the mines: dig one up and go again, dig a safe square and it\'s their turn. First to 13 of the 25 mines.',
  create: (ctx) => new MineDuel(ctx),
};
