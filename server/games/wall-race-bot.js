/**
 * The computer for Wall Race (see `bot` in index.js). It measures the race: how many steps each of
 * you has left by the shortest way round the walls. A good move makes yours shorter or theirs
 * longer, and the walls worth trying are the ones across your shortest way.
 *   easy:   walks its shortest way, and now and then drops a wall somewhere in yours.
 *   normal: weighs every step and every wall across your way, and takes the one that leaves it
 *           furthest ahead in the race.
 *   hard:   the same, but before choosing it looks at your best reply to each move.
 */
import { distance, pawnMoves, wallOk } from './wall-race.js';

const pace = (rng) => 900 + rng() * 1500;

/** One shortest way from `cell` to the goal row: the squares on it. */
function pathCells(n, h, v, cell, goal) {
  const from = new Map([[cell, -1]]);
  const queue = [cell];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (Math.floor(c / n) === goal) {
      const out = [];
      for (let p = c; p !== -1; p = from.get(p)) out.push(p);
      return out;
    }
    for (const m of pawnMoves(n, h, v, [c, -1], 0)) if (!from.has(m)) { from.set(m, c); queue.push(m); }
  }
  return [cell];
}

/** Walls touching `cells` (a shortest way) that may be placed: { dir, k }. */
function wallsAcross(s, cells) {
  const { n, h, v, pawns, goals } = s;
  const m = n - 1;
  const seen = new Set();
  const out = [];
  for (const c of cells) {
    const x = c % n;
    const y = Math.floor(c / n);
    for (const [cx, cy] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) {
      if (cx < 0 || cy < 0 || cx >= m || cy >= m) continue;
      for (const dir of ['h', 'v']) {
        const key = dir + (cy * m + cx);
        if (seen.has(key)) continue;
        seen.add(key);
        if (wallOk(n, h, v, pawns, goals, dir, cy * m + cx)) out.push({ dir, k: cy * m + cx });
      }
    }
  }
  return out;
}

/** The race for `me`: their steps left less ours (walls in hand count a little). */
function score(s, me) {
  const mine = distance(s.n, s.h, s.v, s.pawns[me], s.goals[me]);
  const theirs = distance(s.n, s.h, s.v, s.pawns[1 - me], s.goals[1 - me]);
  if (mine === 0) return 1000;
  if (theirs === 0) return -1000;
  return theirs - mine + 0.3 * (s.walls[me] - s.walls[1 - me]);
}

/** Every move worth trying for `who`: their steps, and (with walls left) walls across the other's way. */
function moves(s, who) {
  const out = pawnMoves(s.n, s.h, s.v, s.pawns, who).map((cell) => ({ type: 'step', cell }));
  if (s.walls[who] > 0) {
    const way = pathCells(s.n, s.h, s.v, s.pawns[1 - who], s.goals[1 - who]);
    for (const w of wallsAcross(s, way.slice(0, 6))) out.push({ type: 'wall', ...w });
  }
  return out;
}

function apply(s, who, mv) {
  const t = { ...s, pawns: s.pawns.slice(), walls: s.walls.slice() };
  if (mv.type === 'step') t.pawns[who] = mv.cell;
  else {
    t[mv.dir] = s[mv.dir].slice();
    t[mv.dir][mv.k] = who + 1;
    t.walls[who]--;
  }
  return t;
}

export function wallRaceBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const s = { n: view.size, h: view.h, v: view.v, pawns: view.pawns, goals: view.goals, walls: view.wallsLeft };
  const tag = view.round + ':' + (view.lastMove ? view.lastMove.n : 0);
  const done = (mv) => ({ ...mv, botDelayMs: pace(rng), botFor: tag });
  if (level === 'easy') {
    if (s.walls[me] > 0 && rng() < 0.15) {
      const way = pathCells(s.n, s.h, s.v, s.pawns[1 - me], s.goals[1 - me]);
      const w = wallsAcross(s, way);
      if (w.length) return done({ type: 'wall', ...w[Math.floor(rng() * w.length)] });
    }
    const way = pathCells(s.n, s.h, s.v, s.pawns[me], s.goals[me]);
    const next = way[way.length - 2];
    const steps = pawnMoves(s.n, s.h, s.v, s.pawns, me);
    return done({ type: 'step', cell: steps.includes(next) ? next : steps[Math.floor(rng() * steps.length)] });
  }
  let best = null;
  for (const mv of moves(s, me)) {
    const t = apply(s, me, mv);
    let value = score(t, me);
    if (level === 'hard' && value > -1000 && value < 1000) {
      // Their best reply.
      let worst = Infinity;
      for (const reply of moves(t, 1 - me)) {
        const r = score(apply(t, 1 - me, reply), me);
        if (r < worst) worst = r;
        if (worst <= -1000) break;
      }
      value = worst;
    }
    // Ties: a step beats a wall (walls are precious), then a little chance.
    const key = value + (mv.type === 'step' ? 0.05 : 0) + rng() * 0.01;
    if (!best || key > best[0]) best = [key, mv];
  }
  return done(best[1]);
}
