// The rules of chess, for the game (chess.js) and its computer player (chess-bot.js). A position is
// { board, turn, castle, ep, half }: board is 64 squares (index rank * 8 + file, rank 0 white's back
// row), each '' or a piece letter, upper case white (PNBRQK) and lower case black; turn 'w' or 'b';
// castle the rights left ('KQkq' or fewer); ep the en passant square or -1; half the moves since a
// capture or pawn move (the fifty-move rule).

const N = [-17, -15, -10, -6, 6, 10, 15, 17];
const KING = [-9, -8, -7, -1, 1, 7, 8, 9];
const DIAG = [-9, -7, 7, 9];
const LINE = [-8, -1, 1, 8];

export const fileOf = (sq) => sq & 7;
export const rankOf = (sq) => sq >> 3;
export const isWhite = (p) => p !== '' && p === p.toUpperCase();
export const colourOf = (p) => (p === '' ? null : isWhite(p) ? 'w' : 'b');
export const NAMES = 'abcdefgh';
export const square = (sq) => NAMES[fileOf(sq)] + (rankOf(sq) + 1);

/** A position from FEN (the board, the side to move, castling, en passant, the halfmove clock). */
export function fromFen(fen) {
  const [rows, turn, castle, ep, half] = fen.split(' ');
  const board = new Array(64).fill('');
  rows.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else board[(7 - i) * 8 + f++] = ch;
    }
  });
  return { board, turn, castle: castle === '-' ? '' : castle, ep: ep === '-' ? -1 : NAMES.indexOf(ep[0]) + (Number(ep[1]) - 1) * 8, half: Number(half) || 0 };
}

export function startPosition() {
  const back = 'RNBQKBNR';
  const board = new Array(64).fill('');
  for (let f = 0; f < 8; f++) {
    board[f] = back[f];
    board[8 + f] = 'P';
    board[48 + f] = 'p';
    board[56 + f] = back[f].toLowerCase();
  }
  return { board, turn: 'w', castle: 'KQkq', ep: -1, half: 0 };
}

/** Whether `side` ('w' or 'b') attacks square `sq`. */
export function attacked(board, sq, side) {
  const own = (p) => p !== '' && colourOf(p) === side;
  const is = (p, t) => own(p) && p.toLowerCase() === t;
  // Pawns.
  const back = side === 'w' ? -8 : 8;
  for (const df of [-1, 1]) {
    const from = sq + back + df;
    if (from >= 0 && from < 64 && Math.abs(fileOf(from) - fileOf(sq)) === 1 && is(board[from], 'p')) return true;
  }
  for (const d of N) {
    const t = sq + d;
    if (t >= 0 && t < 64 && Math.abs(fileOf(t) - fileOf(sq)) <= 2 && is(board[t], 'n')) return true;
  }
  for (const d of KING) {
    const t = sq + d;
    if (t >= 0 && t < 64 && Math.abs(fileOf(t) - fileOf(sq)) <= 1 && is(board[t], 'k')) return true;
  }
  for (const [dirs, kinds] of [[DIAG, 'bq'], [LINE, 'rq']]) {
    for (const d of dirs) {
      let t = sq;
      for (;;) {
        const n = t + d;
        if (n < 0 || n > 63 || Math.abs(fileOf(n) - fileOf(t)) > 1) break;
        t = n;
        const p = board[t];
        if (p === '') continue;
        if (own(p) && kinds.includes(p.toLowerCase())) return true;
        break;
      }
    }
  }
  return false;
}

export function kingSquare(board, side) {
  return board.indexOf(side === 'w' ? 'K' : 'k');
}

export const inCheck = (pos, side = pos.turn) => attacked(pos.board, kingSquare(pos.board, side), side === 'w' ? 'b' : 'w');

/** Every move the side to move could make, ignoring whether it leaves its own king in check. */
function pseudo(pos) {
  const { board, turn } = pos;
  const out = [];
  const mine = (p) => p !== '' && colourOf(p) === turn;
  const theirs = (p) => p !== '' && colourOf(p) !== turn;
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!mine(p)) continue;
    const kind = p.toLowerCase();
    if (kind === 'p') {
      const up = turn === 'w' ? 8 : -8;
      const last = turn === 'w' ? 7 : 0;
      const add = (to) => {
        if (rankOf(to) === last) for (const promo of ['q', 'r', 'b', 'n']) out.push({ from, to, promo });
        else out.push({ from, to });
      };
      const one = from + up;
      if (one >= 0 && one < 64 && board[one] === '') {
        add(one);
        const startRank = turn === 'w' ? 1 : 6;
        if (rankOf(from) === startRank && board[one + up] === '') out.push({ from, to: one + up });
      }
      for (const df of [-1, 1]) {
        const to = from + up + df;
        if (to < 0 || to > 63 || Math.abs(fileOf(to) - fileOf(from)) !== 1) continue;
        if (theirs(board[to])) add(to);
        else if (to === pos.ep) out.push({ from, to, ep: true });
      }
    } else if (kind === 'n' || kind === 'k') {
      for (const d of kind === 'n' ? N : KING) {
        const to = from + d;
        if (to < 0 || to > 63 || Math.abs(fileOf(to) - fileOf(from)) > (kind === 'n' ? 2 : 1)) continue;
        if (!mine(board[to])) out.push({ from, to });
      }
      if (kind === 'k') {
        const enemy = turn === 'w' ? 'b' : 'w';
        const home = turn === 'w' ? 4 : 60;
        const [kSide, qSide] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (from === home && !attacked(board, home, enemy)) {
          if (pos.castle.includes(kSide) && board[home + 1] === '' && board[home + 2] === '' && !attacked(board, home + 1, enemy) && !attacked(board, home + 2, enemy)) out.push({ from, to: home + 2, castle: 'k' });
          if (pos.castle.includes(qSide) && board[home - 1] === '' && board[home - 2] === '' && board[home - 3] === '' && !attacked(board, home - 1, enemy) && !attacked(board, home - 2, enemy)) out.push({ from, to: home - 2, castle: 'q' });
        }
      }
    } else {
      const dirs = kind === 'b' ? DIAG : kind === 'r' ? LINE : DIAG.concat(LINE);
      for (const d of dirs) {
        let t = from;
        for (;;) {
          const n = t + d;
          if (n < 0 || n > 63 || Math.abs(fileOf(n) - fileOf(t)) > 1) break;
          t = n;
          if (mine(board[t])) break;
          out.push({ from, to: t });
          if (board[t] !== '') break;
        }
      }
    }
  }
  return out;
}

/** The position after a move (the move must come from legalMoves). */
export function makeMove(pos, m) {
  const board = pos.board.slice();
  const p = board[m.from];
  const kind = p.toLowerCase();
  const captured = m.ep ? board[m.to + (pos.turn === 'w' ? -8 : 8)] : board[m.to];
  board[m.to] = m.promo ? (pos.turn === 'w' ? m.promo.toUpperCase() : m.promo) : p;
  board[m.from] = '';
  if (m.ep) board[m.to + (pos.turn === 'w' ? -8 : 8)] = '';
  if (m.castle) {
    const rookFrom = m.castle === 'k' ? m.from + 3 : m.from - 4;
    const rookTo = m.castle === 'k' ? m.from + 1 : m.from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = '';
  }
  let castle = pos.castle;
  const strip = (chars) => { for (const c of chars) castle = castle.replace(c, ''); };
  if (kind === 'k') strip(pos.turn === 'w' ? 'KQ' : 'kq');
  for (const [sq, c] of [[0, 'Q'], [7, 'K'], [56, 'q'], [63, 'k']]) if (m.from === sq || m.to === sq) strip(c);
  const ep = kind === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return { board, turn: pos.turn === 'w' ? 'b' : 'w', castle, ep, half: kind === 'p' || captured ? 0 : pos.half + 1, captured };
}

export function legalMoves(pos) {
  return pseudo(pos).filter((m) => !inCheck(makeMove(pos, m), pos.turn));
}

/** A key for spotting a repeated position. */
export const keyOf = (pos) => pos.board.map((p) => p || '.').join('') + pos.turn + pos.castle + pos.ep;

/** Neither side has enough left to mate (king alone, or with one minor piece). */
export function insufficient(board) {
  const rest = board.filter((p) => p !== '' && p.toLowerCase() !== 'k');
  if (!rest.length) return true;
  return rest.length === 1 && 'nb'.includes(rest[0].toLowerCase());
}

/** The move in algebraic notation (Nf3, exd5, O-O, e8=Q+, Qxf7#). */
export function san(pos, m, legal = legalMoves(pos)) {
  const p = pos.board[m.from];
  const kind = p.toLowerCase();
  let s;
  if (m.castle) s = m.castle === 'k' ? 'O-O' : 'O-O-O';
  else {
    const capture = pos.board[m.to] !== '' || m.ep;
    if (kind === 'p') s = (capture ? NAMES[fileOf(m.from)] + 'x' : '') + square(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    else {
      const twins = legal.filter((o) => o.to === m.to && o.from !== m.from && pos.board[o.from] === p);
      let dis = '';
      if (twins.length) {
        if (!twins.some((o) => fileOf(o.from) === fileOf(m.from))) dis = NAMES[fileOf(m.from)];
        else if (!twins.some((o) => rankOf(o.from) === rankOf(m.from))) dis = String(rankOf(m.from) + 1);
        else dis = square(m.from);
      }
      s = kind.toUpperCase() + dis + (capture ? 'x' : '') + square(m.to);
    }
  }
  const after = makeMove(pos, m);
  if (inCheck(after)) s += legalMoves(after).length ? '+' : '#';
  return s;
}
