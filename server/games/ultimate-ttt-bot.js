/**
 * The computer for Ultimate Tic-tac-toe (see `bot` in index.js): a game tree search by random games
 * (Monte Carlo tree search). It plays many quick random games from here, steering more of them down
 * the moves that have done well so far, and plays the move it tried most.
 *   easy:   a few dozen random games (and now and then any square at all);
 *   normal: several hundred;
 *   hard:   a couple of thousand.
 */
import { legalMoves, playMove } from './ultimate-ttt.js';

const pace = (rng) => 800 + rng() * 1400;
const GAMES = { easy: 30, normal: 500, hard: 2000 };

const copy = (p) => ({ cells: p.cells.slice(), boards: p.boards.slice(), next: p.next, result: p.result });

/** The move the search likes best for `me` (1 or 2) to play in `pos`. */
export function search(pos, me, count, rng) {
  const root = { move: -1, who: 3 - me, parent: null, kids: [], untried: legalMoves(pos), wins: 0, visits: 0 };
  for (let k = 0; k < count; k++) {
    let node = root;
    const p = copy(pos);
    // Down the tree by the best upper bound (UCT), then try one new move.
    while (!node.untried.length && node.kids.length) {
      const logN = Math.log(node.visits);
      let best = null;
      let bestU = -1;
      for (const c of node.kids) {
        const u = c.wins / c.visits + 1.2 * Math.sqrt(logN / c.visits);
        if (u > bestU) { bestU = u; best = c; }
      }
      node = best;
      playMove(p, node.move, node.who);
    }
    if (node.untried.length && !p.result) {
      const i = Math.floor(rng() * node.untried.length);
      const move = node.untried[i];
      node.untried[i] = node.untried[node.untried.length - 1];
      node.untried.pop();
      const who = 3 - node.who;
      playMove(p, move, who);
      const kid = { move, who, parent: node, kids: [], untried: p.result ? [] : legalMoves(p), wins: 0, visits: 0 };
      node.kids.push(kid);
      node = kid;
    }
    // A random game to the end.
    let who = 3 - node.who;
    while (!p.result) {
      const ok = legalMoves(p);
      playMove(p, ok[Math.floor(rng() * ok.length)], who);
      who = 3 - who;
    }
    for (let n = node; n; n = n.parent) {
      n.visits++;
      if (p.result === n.who) n.wins++;
      else if (p.result === 3) n.wins += 0.5;
    }
  }
  let pick = root.kids[0];
  for (const c of root.kids) if (c.visits > pick.visits) pick = c;
  return pick.move;
}

export function ultimateTttBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !GAMES[level]) return null;
  const pos = { cells: view.cells.slice(), boards: view.boards.slice(), next: view.next, result: 0 };
  const ok = legalMoves(pos);
  if (!ok.length) return null;
  const me = view.you + 1;
  const tag = view.round + ':' + (view.lastMove ? view.lastMove.n : 0);
  // A move that wins the game now, it always takes (the search can't tell it from one that wins later).
  const now = ok.find((c) => playMove(copy(pos), c, me).result === me);
  if (now !== undefined) return { type: 'place', cell: now, botDelayMs: pace(rng), botFor: tag };
  const cell = level === 'easy' && rng() < 0.25 ? ok[Math.floor(rng() * ok.length)] : search(pos, me, GAMES[level], rng);
  return { type: 'place', cell, botDelayMs: pace(rng), botFor: tag };
}
