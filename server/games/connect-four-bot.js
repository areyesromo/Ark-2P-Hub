/**
 * The computer opponent for Connect Four (see `bot` in index.js): it looks a few moves ahead
 * (alpha-beta) and scores a board by its open lines of two and three.
 *   easy:   one move ahead, and a third of the time just any column.
 *   normal: three moves ahead (it takes a win and blocks yours).
 *   hard:   six moves ahead, and it likes the middle columns.
 */
const DEPTH = { easy: 1, normal: 3, hard: 6 };
const WIN = 1e6;

export function connectFourBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !DEPTH[level]) return null;
  const { cols, rows } = view;
  const board = view.board.map((r) => r.slice());
  const me = view.you + 1;
  const open = order(cols).filter((c) => !board[rows - 1][c]);
  if (!open.length) return null;
  const pace = 700 + rng() * 900;
  if (level === 'easy' && rng() < 0.33) return { type: 'drop', col: open[Math.floor(rng() * open.length)], botDelayMs: pace };
  let best = null;
  let bestScore = -Infinity;
  for (const c of open) {
    const r = drop(board, c, me, rows);
    const score = wins(board, c, r, cols, rows) ? WIN : -negamax(board, DEPTH[level] - 1, 3 - me, -Infinity, Infinity, cols, rows, level);
    board[r][c] = 0;
    const s = score + rng() * 0.5; // (ties: any of them)
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return { type: 'drop', col: best, botDelayMs: pace };
}

/** Columns from the middle out: good moves first, so alpha-beta cuts more. */
function order(cols) {
  const mid = (cols - 1) / 2;
  return [...Array(cols).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
}

function drop(board, c, who, rows) {
  let r = 0;
  while (r < rows && board[r][c]) r++;
  board[r][c] = who;
  return r;
}

function wins(board, c, r, cols, rows) {
  const who = board[r][c];
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let n = 1;
    for (const s of [1, -1]) {
      let x = c + dc * s;
      let y = r + dr * s;
      while (x >= 0 && y >= 0 && x < cols && y < rows && board[y][x] === who) { n++; x += dc * s; y += dr * s; }
    }
    if (n >= 4) return true;
  }
  return false;
}

/** The best `who` can make of this board, looking `depth` moves on. */
function negamax(board, depth, who, alpha, beta, cols, rows, level) {
  const open = order(cols).filter((c) => !board[rows - 1][c]);
  if (!open.length) return 0;
  if (depth <= 0) return evaluate(board, who, cols, rows, level);
  let best = -Infinity;
  for (const c of open) {
    const r = drop(board, c, who, rows);
    const score = wins(board, c, r, cols, rows) ? WIN + depth : -negamax(board, depth - 1, 3 - who, -beta, -alpha, cols, rows, level);
    board[r][c] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Every line of four: worth more the more of yours (and none of theirs) it holds. */
function evaluate(board, who, cols, rows, level) {
  let score = 0;
  const other = 3 - who;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (level === 'hard' && board[r][c]) score += (board[r][c] === who ? 1 : -1) * (3 - Math.abs(c - (cols - 1) / 2));
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const ec = c + dc * 3;
        const er = r + dr * 3;
        if (ec < 0 || ec >= cols || er < 0 || er >= rows) continue;
        let mine = 0;
        let theirs = 0;
        for (let i = 0; i < 4; i++) {
          const x = board[r + dr * i][c + dc * i];
          if (x === who) mine++;
          else if (x === other) theirs++;
        }
        if (mine && !theirs) score += mine === 3 ? 50 : mine === 2 ? 10 : 1;
        else if (theirs && !mine) score -= theirs === 3 ? 60 : theirs === 2 ? 10 : 1;
      }
    }
  }
  return score;
}
