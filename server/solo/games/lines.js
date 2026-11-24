// Color Lines. A 9 × 9 board with a few coloured balls on it. Each turn you move
// one ball to an empty square it can walk to (up, down, left, right, round the
// other balls), then three more balls drop onto random empty squares; the next
// three colours are shown ahead of time. Line up five or more of one colour,
// across, down or diagonally, and they vanish. A move that clears a line
// earns the turn back: no new balls that time. Balls that drop in and line up
// clear too. It ends when the board is full. Score: points (a line of n balls
// is worth n × (n - 3)).

export const N = 9;
export const COLOURS = 7;
export const LINE = 5;
export const START = 5;
export const DROP = 3;

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** Every cell in a line of LINE or more same-coloured balls through any of `cells`. */
export function linesThrough(board, cells) {
  const clear = new Set();
  for (const at of cells) {
    const c = board[at];
    if (c === null) continue;
    const x0 = at % N;
    const y0 = Math.floor(at / N);
    for (const [dx, dy] of DIRS) {
      const run = [at];
      for (const s of [1, -1]) {
        let x = x0 + dx * s;
        let y = y0 + dy * s;
        while (x >= 0 && x < N && y >= 0 && y < N && board[y * N + x] === c) {
          run.push(y * N + x);
          x += dx * s;
          y += dy * s;
        }
      }
      if (run.length >= LINE) run.forEach((i) => clear.add(i));
    }
  }
  return clear;
}

/** Can a ball walk from one cell to another over empty cells? */
export function reachable(board, from, to) {
  if (board[to] !== null) return false;
  const seen = new Set([from]);
  const todo = [from];
  while (todo.length) {
    const i = todo.shift();
    if (i === to) return true;
    const x = i % N;
    const y = Math.floor(i / N);
    for (const j of [x > 0 && i - 1, x < N - 1 && i + 1, y > 0 && i - N, y < N - 1 && i + N]) {
      if (j !== false && !seen.has(j) && board[j] === null) {
        seen.add(j);
        todo.push(j);
      }
    }
  }
  return false;
}

export const pointsFor = (n) => n * (n - 3);

export class Lines {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
  }

  colour() {
    return Math.floor(this.rng() * COLOURS);
  }

  /** Drops the previewed balls onto random empty squares, then shows the next ones. */
  drop() {
    const put = [];
    for (const c of this.next) {
      const empty = [];
      this.board.forEach((b, i) => b === null && empty.push(i));
      if (!empty.length) break;
      const at = empty[Math.floor(this.rng() * empty.length)];
      this.board[at] = c;
      put.push(at);
    }
    this.next = Array.from({ length: DROP }, () => this.colour());
    return put;
  }

  start() {
    this.board = Array(N * N).fill(null);
    this.score = 0;
    this.cleared = 0;
    this.next = Array.from({ length: START }, () => this.colour());
    this.drop(); // also deals the first three previews
    this.phase = 'play';
    this.ctx.update();
  }

  /** Clears any lines through these cells and scores them. Returns how many balls went. */
  sweep(cells) {
    const gone = linesThrough(this.board, cells);
    if (!gone.size) return 0;
    // Scored on the balls that went, so two lines crossing count as one big clear.
    this.score += pointsFor(gone.size);
    this.cleared += gone.size;
    gone.forEach((i) => (this.board[i] = null));
    return gone.size;
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || input.type !== 'move') return;
    const { from, to } = input;
    const cell = (i) => Number.isInteger(i) && i >= 0 && i < N * N;
    if (!cell(from) || !cell(to) || from === to || this.board[from] === null || !reachable(this.board, from, to)) return;
    this.board[to] = this.board[from];
    this.board[from] = null;
    if (!this.sweep([to])) {
      const put = this.drop();
      this.sweep(put);
      if (this.board.every((b) => b !== null)) this.phase = 'over';
    }
    this.ctx.update();
  }

  view() {
    return {
      phase: this.phase,
      n: N,
      board: this.board,
      next: this.next,
      colours: COLOURS,
      cleared: this.cleared,
      score: this.phase === 'over' ? this.score : null,
      points: this.score,
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
  id: 'lines',
  name: 'Color Lines',
  tagline: 'Slide balls round the board and line up five of a colour before it fills up.',
  category: 'puzzle',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Lines(ctx, ctx.rng),
};
