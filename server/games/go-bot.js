/**
 * The computer for Go (see `bot` in index.js). It plays many quick random games from the board as
 * it stands and keeps count, for each empty point, of how often the games where it played there
 * were games it won. The best point is its move.
 *   easy:   a hundred or so random games, and now and then it just plays anywhere.
 *   normal: several hundred; resigns a hopeless game.
 *   hard:   over a thousand, and it reads the fights a move deep: it takes stones that are in
 *           atari (one liberty left), saves its own, and won't put a group in atari itself.
 * It passes when the game is settled (and it's ahead, or nothing it could play would help).
 */
import { neighboursOf, play, isEye, groupAt, randomGame, areaScore, removeDead } from './go-engine.js';

const GAMES = { easy: 100, normal: 500, hard: 1200 };
const pace = (rng) => 900 + rng() * 1300;

export function goBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !GAMES[level]) return null;
  const n = view.size;
  const nb = neighboursOf(n);
  const me = view.you === view.black ? 1 : 2;
  const komi = view.komi;
  const tag = view.round + ':' + view.moves + ':' + (view.lastMove ? view.lastMove.n : 0);
  const say = (move) => ({ ...move, botDelayMs: pace(rng), botFor: tag });
  const board = Int8Array.from(view.board);

  // The moves worth trying: legal, and not filling one of our own eyes.
  const legal = [];
  const tmp = { ko: -1 };
  for (let c = 0; c < board.length; c++) {
    if (board[c] || isEye(board, n, nb, c, me)) continue;
    const b = Int8Array.from(board);
    if (play(b, nb, c, me, view.ko, tmp) >= 0) legal.push(c);
  }

  // They passed and we'd win the count as it stands: pass too.
  const theyPassed = view.lastMove && view.lastMove.cell === -1 && view.lastMove.by !== view.you;
  if (theyPassed || !legal.length) {
    const { board: settled } = removeDead(view.board, n, me, rng, 60);
    const [b, w] = areaScore(settled, n, nb);
    const lead = me === 1 ? b - (w + komi) : w + komi - b;
    if (lead > 0 || !legal.length) return say({ type: 'pass' });
  }

  if (level === 'easy' && rng() < 0.2) return say({ type: 'place', cell: legal[Math.floor(rng() * legal.length)] });

  // Random games: who won, and who played each point first.
  const won = new Float64Array(board.length);
  const tried = new Float64Array(board.length);
  let wins = 0;
  const first = new Map();
  for (let g = 0; g < GAMES[level]; g++) {
    first.clear();
    const end = randomGame(board, n, me, view.ko, rng, first);
    const [b, w] = areaScore(end, n, nb);
    const win = me === 1 ? b > w + komi : w + komi > b;
    if (win) wins++;
    for (const [c, colour] of first) {
      if (colour !== me) continue;
      tried[c]++;
      if (win) won[c]++;
    }
  }
  const overall = wins / GAMES[level];
  if (level !== 'easy' && overall < 0.03 && view.moves > n * n * 0.6) return say({ type: 'resign' });

  const stones = [];
  let best = null;
  for (const c of legal) {
    let value = tried[c] ? won[c] / tried[c] : 0;
    if (level === 'hard') value += tactics(board, nb, c, me, stones);
    if (!best || value > best[0]) best = [value, c];
  }
  // Nothing helps any more (every move loses or wins alike) and the board's full of territory: pass.
  if (overall > 0.97 && theyPassed) return say({ type: 'pass' });
  return say({ type: 'place', cell: best[1] });
}

/** Hard's look at the fight around `c`: take stones in atari, save our own, don't self-atari. */
function tactics(board, nb, c, me, stones) {
  let bonus = 0;
  const enemy = 3 - me;
  for (const m of nb[c]) {
    if (!board[m]) continue;
    const libs = groupAt(board, nb, m, stones);
    if (board[m] === enemy && libs === 1) bonus += 0.2 + 0.02 * stones.length; // takes them
    if (board[m] === me && libs === 1) bonus += 0.15 + 0.02 * stones.length; // saves ours (if it adds liberties)
  }
  // Self-atari: after playing, our group has a single liberty (and took nothing).
  const b = Int8Array.from(board);
  const took = play(b, nb, c, me, -1, { ko: -1 });
  if (took === 0 && groupAt(b, nb, c, stones) === 1 && stones.length > 1) bonus -= 0.3;
  return bonus;
}
