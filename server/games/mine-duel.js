// Mine Duel: one minefield, turns. Here you want the mines: open a square with a mine under it and
// it's yours (a point) and you go again. Open a safe square and it shows how many mines touch it
// (an empty one opens up its neighbours too), and it's the other's turn: so a careless dig hands
// them clues. More than half the mines wins the game. Each turn has a clock: run out and a random
// square is dug for you.

import { settingOf } from './options.js';

export const SIZE = 12;
export const MINES = 25; // (odd: no level games)
export const NEED = Math.floor(MINES / 2) + 1;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 25000, roundEndMs: 6000 };
// In a view's board: null covered, 0..8 opened (mines touching), MINE + slot claimed, MINE + 2 a
// mine nobody found (only shown once the game's over).
export const MINE = 10;

export function neighbours(cell) {
  const x = cell % SIZE;
  const y = Math.floor(cell / SIZE);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(ny * SIZE + nx);
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

export default {
  id: 'mine-duel',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Mine Duel',
  tagline: 'One minefield, and you want the mines: dig one up and go again, dig a safe square and it\'s their turn. First to 13 of the 25 mines.',
  create: (ctx) => new MineDuel(ctx),
};
