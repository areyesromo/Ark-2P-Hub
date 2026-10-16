// Connect Four. Players take turns dropping a disc into one of 7 columns; the
// first to line up four (across, down or diagonally) wins the round. A full
// board is a drawn round. Who starts swaps every round; first to WIN_SCORE
// rounds wins the match. Each move has a clock: run out and a random column
// is played for you.

export const COLS = 7;
export const ROWS = 6;
export const WIN_SCORE = 3;
export const TIMING = { turnMs: 20000, roundEndMs: 3500 };

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** The four (or more) cells through (col, row) that belong to `who`, or null. */
export function findLine(board, col, row) {
  const who = board[row][col];
  if (!who) return null;
  const at = (c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? board[r][c] : 0);
  for (const [dc, dr] of DIRS) {
    const line = [[col, row]];
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (at(c, r) === who) {
        line.push([c, r]);
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  return null;
}

export class ConnectFour {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.starter = null;
    this.newRound();
  }

  newRound() {
    this.round++;
    // Row 0 is the bottom. 0 = empty, 1 = player 1, 2 = player 2.
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null;
    this.line = null;
    this.result = null;
    this.moves = 0;
    this.phase = 'play';
    this.startTurn();
  }

  // ---- clock ------------------------------------------------------------------

  startTurn() {
    this.turnEnds = this.ctx.now() + TIMING.turnMs;
    this.ctx.update();
    this.scheduleTick();
  }

  /** Push the clock every second; play a random column when it runs out. */
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
        const open = this.openColumns();
        this.drop(this.turn, open[Math.floor(this.rng() * open.length)]);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  openColumns() {
    const open = [];
    for (let c = 0; c < COLS; c++) if (!this.board[ROWS - 1][c]) open.push(c);
    return open;
  }

  // ---- moves --------------------------------------------------------------------

  drop(slot, col) {
    let row = 0;
    while (row < ROWS && this.board[row][col]) row++;
    if (row >= ROWS) return false;
    this.board[row][col] = slot + 1;
    this.moves++;
    this.lastMove = { col, row, by: slot };
    const line = findLine(this.board, col, row);
    if (line) return this.endRound(slot, line);
    if (this.moves === ROWS * COLS) return this.endRound(null, null);
    this.turn = 1 - slot;
    this.startTurn();
    return true;
  }

  endRound(winner, line) {
    this.clearTimer();
    this.line = line;
    this.result = { winner, draw: winner === null };
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= WIN_SCORE) {
      this.winner = winner;
      this.phase = 'over';
      this.ctx.update();
      return true;
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.newRound();
    }, TIMING.roundEndMs);
    return true;
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'drop' || this.phase !== 'play' || slot !== this.turn) return;
    const col = input.col;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return;
    this.drop(slot, col);
  }

  // ---- views ----------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      round: this.round,
      cols: COLS,
      rows: ROWS,
      board: this.board,
      turn: this.turn,
      lastMove: this.lastMove,
      line: this.line,
      result: this.result,
      scores: this.scores,
      winScore: WIN_SCORE,
      timeLeftMs: this.phase === 'play' ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      turnMs: TIMING.turnMs,
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
  id: 'connect-four',
  name: 'Connect Four',
  tagline: 'Drop discs, line up four in a row before your rival does. Tap a column on your phone. First to 3.',
  create: (ctx) => new ConnectFour(ctx),
};
