/**
 * The computer for Hidden Ranks (see `bot` in index.js). It knows what you know: its own ranks, any
 * of yours shown in a fight, which of yours have moved (so aren't bombs or the flag), and what
 * you've lost. From that it works out what each hidden piece of yours could be.
 *   easy:   sets out at random and wanders forward, attacking any hidden piece it bumps into (it
 *           does steer clear of pieces it has seen are stronger).
 *   normal: hides its flag on the back row behind bombs; attacks pieces it knows it can beat, and
 *           a hidden one when, against all you have left, that's worth it on average; steps away
 *           from known danger.
 *   hard:   reads the hidden pieces closer: one that has moved isn't a bomb or the flag, and the
 *           unmoved pieces on your back row are where it looks for the flag. It keeps
 *           its 10 away from pieces that could be the spy, and guards against your next attack.
 */
import { N, ARMY, VALUE, LAKES, fight, movable, homeRows } from './hidden-ranks.js';

const pace = (rng) => 1000 + rng() * 1500;
const FLAG = 60; // what taking the flag is worth to the reckoning

/** An arrangement for `s`: ranks for its home cells in order (front row first for player 1). */
function arrange(s, level, rng) {
  const ranks = ARMY.slice();
  for (let i = ranks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
  }
  if (level === 'easy') return ranks;
  // Home cells in order: player 1 (bottom) front row 0-7, back row 8-15; player 2 back 0-7, front 8-15.
  const back = s === 0 ? 8 : 0;
  const front = s === 0 ? 0 : 8;
  const out = new Array(16).fill(null);
  const col = Math.floor(rng() * N);
  out[back + col] = 'F';
  // Bombs round the flag: either side, and in front.
  const spots = [back + col - 1, back + col + 1, front + col].filter((i, k) => (k === 0 ? col > 0 : k === 1 ? col < N - 1 : true));
  let bombs = 3;
  for (const i of spots) { if (bombs) { out[i] = 'B'; bombs--; } }
  const rest = ranks.filter((r) => r !== 'F' && r !== 'B');
  for (let k = 0; k < bombs; k++) rest.push('B');
  // Hard puts its scouts in front, to run out and look.
  if (level === 'hard') rest.sort((a, b) => (a === 2 ? -1 : 0) - (b === 2 ? -1 : 0));
  const free = [];
  for (let i = 0; i < 16; i++) if (out[i] === null) free.push(i);
  free.sort((a, b) => (level === 'hard' ? (a >= front && a < front + 8 ? -1 : 1) - (b >= front && b < front + 8 ? -1 : 1) : rng() - 0.5));
  free.forEach((i, k) => { out[i] = rest[k]; });
  return out;
}

/** What each hidden piece of theirs could be: rank → chance. `plain`: just what they have left (Normal). */
function chances(view, me, piece, cell, plain) {
  const o = 1 - me;
  const pool = ARMY.slice();
  for (const r of view.taken[o]) pool.splice(pool.indexOf(r), 1);
  view.board.forEach((p) => { if (p && p.s === o && p.rank !== null) pool.splice(pool.indexOf(p.rank), 1); });
  let options = piece.moved && !plain ? pool.filter(movable) : pool;
  if (!options.length) options = pool;
  const weight = {};
  for (const r of options) weight[r] = (weight[r] || 0) + 1;
  // An unmoved piece on their back row is likelier to be the flag or a bomb.
  const backRow = homeRows(o)[o === 0 ? 1 : 0];
  if (!plain && !piece.moved && Math.floor(cell / N) === backRow) { if (weight.F) weight.F *= 3; if (weight.B) weight.B *= 1.5; }
  const total = Object.values(weight).reduce((a, b) => a + b, 0);
  const out = {};
  for (const r of Object.keys(weight)) out[r] = weight[r] / total;
  return out;
}

const rankOf = (r) => (r === 'B' || r === 'F' ? r : Number(r));

/** The reckoning of `mine` (a rank) attacking a piece of theirs: gain less loss, on average. */
function attackWorth(view, me, mine, piece, cell, plain) {
  if (piece.rank !== null) return worthAgainst(mine, piece.rank);
  let sum = 0;
  for (const [r, p] of Object.entries(chances(view, me, piece, cell, plain))) sum += p * worthAgainst(mine, rankOf(r));
  return sum;
}

function worthAgainst(mine, theirs) {
  const result = fight(mine, theirs);
  const gain = theirs === 'F' ? FLAG : VALUE[theirs];
  if (result === 'a') return gain;
  if (result === 'd') return -VALUE[mine];
  return gain - VALUE[mine];
}

/**
 * Hard's look at your reply: after its move, your most damaging attack on one of its pieces (each
 * attacker's rank by its chances), as an expected loss.
 */
function worstReply(view, me, board) {
  let worst = 0;
  board.forEach((e, cell) => {
    if (!e || e.s === me || !movable(e.rank === null ? 2 : e.rank)) return;
    const r0 = Math.floor(cell / N);
    const c0 = cell % N;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r0 + dr;
      const cc = c0 + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const mine = board[rr * N + cc];
      if (!mine || mine.s !== me) continue;
      const dist = e.rank !== null ? { [e.rank]: 1 } : chances(view, me, { ...e, moved: true }, cell);
      let loss = 0;
      for (const [r, pr] of Object.entries(dist)) {
        const a = rankOf(r);
        if (!movable(a)) continue;
        const res = fight(a, mine.rank);
        loss += pr * (res === 'a' ? (mine.rank === 'F' ? FLAG : VALUE[mine.rank]) : res === 'both' ? VALUE[mine.rank] - VALUE[a] : -VALUE[a]);
      }
      if (loss > worst) worst = loss;
    }
  });
  return worst;
}

export function hiddenRanksBot(view, level, rng = Math.random, _retries = 0, memory = {}) {
  if (!view || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const say = (move) => ({ ...move, botDelayMs: pace(rng), botFor: view.round + ':' + view.phase + ':' + (view.lastMove ? view.lastMove.n : 0) + ':' + (memory.arranged === view.round) });
  if (view.phase === 'deploy') {
    if (view.ready[me]) return null;
    if (memory.arranged !== view.round) {
      memory.arranged = view.round;
      return say({ type: 'arrange', ranks: arrange(me, level, rng) });
    }
    return say({ type: 'ready' });
  }
  if (view.phase !== 'play' || view.turn !== me || !view.moves.length) return null;
  const board = view.board;
  const forward = me === 0 ? -1 : 1; // player 1 heads up the board
  const enemyNear = (cell) => {
    const out = [];
    const r = Math.floor(cell / N);
    const c = cell % N;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const q = board[rr * N + cc];
      if (q && q.s !== me) out.push([rr * N + cc, q]);
    }
    return out;
  };
  let best = null;
  for (const [from, to] of view.moves) {
    const p = board[from];
    const q = board[to];
    let value;
    if (level === 'easy') value = (q ? (q.rank !== null ? worthAgainst(p.rank, q.rank) : 2) : 0) + (Math.floor(to / N) - Math.floor(from / N)) * forward + rng() * 3;
    else {
      if (q) {
        value = attackWorth(view, me, p.rank, q, to, level === 'normal');
      } else {
        // A step: forward is good (scouts and low pieces lead), danger next to it is bad.
        value = 0.15 * (Math.floor(to / N) - Math.floor(from / N)) * forward * (VALUE[p.rank] <= 4 ? 1.5 : 1);
        for (const [cell, e] of enemyNear(to)) {
          if (e.rank !== null && e.rank !== 'B' && fight(e.rank, p.rank) === 'a') value -= VALUE[p.rank] * 0.9;
          else if (level === 'hard' && e.rank === null && e.moved) {
            // An unknown that might take us: its chances against this piece.
            let risk = 0;
            for (const [r, pr] of Object.entries(chances(view, me, e, cell))) if (movable(rankOf(r)) && fight(rankOf(r), p.rank) === 'a') risk += pr;
            value -= risk * VALUE[p.rank] * 0.6;
          }
        }
      }
      // Hard: the 10 stays clear of anything that might be the spy.
      if (level === 'hard' && p.rank === 10) {
        for (const [cell, e] of enemyNear(to)) if (e.rank === null && e.moved && (chances(view, me, e, cell)[1] || 0) > 0.15) value -= 3;
      }
      if (LAKES.includes(to)) value -= 100;
      if (level === 'hard') {
        // The board after the move (a won attack leaves ours there; a lost one takes it off).
        const after = board.slice();
        after[from] = null;
        if (!q) after[to] = p;
        else if (q.rank !== null) { const res = fight(p.rank, q.rank); after[to] = res === 'a' ? p : res === 'd' ? q : null; }
        else after[to] = p; // (hoping)
        value -= worstReply(view, me, after);
      }
    }
    value += rng() * 0.05;
    if (!best || value > best[0]) best = [value, from, to];
  }
  return say({ type: 'move', from: best[1], to: best[2] });
}
