// Traffic Jam's boards: a 6 × 6 car park of cars (two squares) and trucks (three) that only move
// forwards and backwards along their own row or column. The red car sits in the exit row (the
// third from the top) and has to reach the gap on the right-hand side. A move is one vehicle
// sliding any distance along its lane.
//
// A board is text, six rows of six: '.' empty, 'r' the red car, any other letter a vehicle (its
// squares in a line across or down tell its way).

export const SIZE = 6;
export const EXIT_ROW = 2;

/** A board's text as vehicles: [{ id, x, y, len, across }], the red car first. */
export function parseBoard(rows) {
  const cells = {};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    (cells[ch] = cells[ch] || []).push([x, y]);
  }));
  const ids = Object.keys(cells).sort((a, b) => (a === 'r' ? -1 : b === 'r' ? 1 : a < b ? -1 : 1));
  return ids.map((id) => {
    const sq = cells[id];
    const across = sq.every(([, y]) => y === sq[0][1]);
    return { id, x: Math.min(...sq.map((s) => s[0])), y: Math.min(...sq.map((s) => s[1])), len: sq.length, across };
  });
}

/** Vehicles back to text. */
export function boardText(cars) {
  const grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill('.'));
  for (const c of cars) for (let k = 0; k < c.len; k++) grid[c.across ? c.y : c.y + k][c.across ? c.x + k : c.x] = c.id;
  return grid.map((r) => r.join(''));
}

/** Which vehicle (its index) sits on each square, -1 for none. pos: each vehicle's place along its lane. */
export function occupancy(cars, pos) {
  const grid = new Array(SIZE * SIZE).fill(-1);
  cars.forEach((c, i) => {
    for (let k = 0; k < c.len; k++) {
      const x = c.across ? pos[i] + k : c.x;
      const y = c.across ? c.y : pos[i] + k;
      grid[y * SIZE + x] = i;
    }
  });
  return grid;
}

/** Each vehicle's place along its lane (x for those going across, y for those going down). */
export const placesOf = (cars) => cars.map((c) => (c.across ? c.x : c.y));

/** The places vehicle i can slide to from here: [lowest, highest] along its lane. */
export function rangeOf(cars, pos, i, grid = occupancy(cars, pos)) {
  const c = cars[i];
  const at = (p) => (c.across ? c.y * SIZE + p : p * SIZE + c.x);
  let lo = pos[i];
  while (lo > 0 && grid[at(lo - 1)] === -1) lo--;
  let hi = pos[i];
  while (hi + c.len < SIZE && grid[at(hi + c.len)] === -1) hi++;
  return [lo, hi];
}

export const solvedAt = (cars, pos) => pos[0] + cars[0].len === SIZE;

/**
 * The fewest moves from `pos` to the red car at the exit, by a breadth-first search over every
 * position the vehicles can reach. Returns { moves, first } (first: [vehicle, place], the first
 * move of a shortest way) or null when there's no way out. `limit` caps the positions it looks at.
 */
export function solve(cars, pos, limit = 300000) {
  const key = (p) => p.join(',');
  if (solvedAt(cars, pos)) return { moves: 0, first: null };
  const seen = new Map([[key(pos), null]]);
  let frontier = [pos];
  let depth = 0;
  while (frontier.length && seen.size < limit) {
    depth++;
    const next = [];
    for (const p of frontier) {
      const grid = occupancy(cars, p);
      for (let i = 0; i < cars.length; i++) {
        const [lo, hi] = rangeOf(cars, p, i, grid);
        for (let to = lo; to <= hi; to++) {
          if (to === p[i]) continue;
          const q = p.slice();
          q[i] = to;
          const k = key(q);
          if (seen.has(k)) continue;
          seen.set(k, key(p) + '|' + i + ':' + to);
          if (solvedAt(cars, q)) {
            // Walk back to the first move.
            let at = k;
            let move = null;
            while (seen.get(at)) {
              const [prev, m] = seen.get(at).split('|');
              move = m.split(':').map(Number);
              at = prev;
            }
            return { moves: depth, first: move };
          }
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * A random board with a way out, or null: the red car in the exit row, then `count` more cars and
 * trucks wherever they fit (none across in the exit row, so the red car's way stays a puzzle).
 */
export function randomBoard(rng, count) {
  const grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill('.'));
  const redX = Math.floor(rng() * 3);
  grid[EXIT_ROW][redX] = grid[EXIT_ROW][redX + 1] = 'r';
  const letters = 'abcdefghijklmnopq';
  let placed = 0;
  for (let tries = 0; placed < count && tries < 200; tries++) {
    const len = rng() < 0.3 ? 3 : 2;
    const across = rng() < 0.5;
    const x = Math.floor(rng() * (across ? SIZE - len + 1 : SIZE));
    const y = Math.floor(rng() * (across ? SIZE : SIZE - len + 1));
    if (across && y === EXIT_ROW) continue;
    const squares = Array.from({ length: len }, (_, k) => (across ? [x + k, y] : [x, y + k]));
    if (squares.some(([sx, sy]) => grid[sy][sx] !== '.')) continue;
    for (const [sx, sy] of squares) grid[sy][sx] = letters[placed];
    placed++;
  }
  return grid.map((r) => r.join(''));
}

/**
 * Every position the vehicles can reach from `pos`, and the one farthest from the red car's way
 * out: { moves, pos } (the hardest start for these vehicles), or null when they can't get out or
 * there are more than `cap` positions. `most`: stop at a start this many moves out.
 */
export function hardestFrom(cars, pos, cap = 200000, most = Infinity) {
  const key = (p) => p.join(',');
  const states = new Map([[key(pos), pos]]);
  const adj = new Map();
  let frontier = [pos];
  while (frontier.length) {
    if (states.size > cap) return null;
    const next = [];
    for (const p of frontier) {
      const list = [];
      const grid = occupancy(cars, p);
      for (let i = 0; i < cars.length; i++) {
        const [lo, hi] = rangeOf(cars, p, i, grid);
        for (let to = lo; to <= hi; to++) {
          if (to === p[i]) continue;
          const q = p.slice();
          q[i] = to;
          const k = key(q);
          list.push(k);
          if (!states.has(k)) {
            states.set(k, q);
            next.push(q);
          }
        }
      }
      adj.set(key(p), list);
    }
    frontier = next;
  }
  // Moves from the way out, back over every position (a slide can always slide back).
  const dist = new Map();
  let ring = [];
  for (const [k, p] of states) if (solvedAt(cars, p)) { dist.set(k, 0); ring.push(k); }
  if (!ring.length) return null;
  let far = ring[0];
  while (ring.length) {
    const next = [];
    for (const k of ring) {
      for (const j of adj.get(k)) {
        if (dist.has(j)) continue;
        dist.set(j, dist.get(k) + 1);
        next.push(j);
        far = j;
        if (dist.get(j) >= most) return { moves: dist.get(j), pos: states.get(j) };
      }
    }
    ring = next;
  }
  return { moves: dist.get(far), pos: states.get(far) };
}
