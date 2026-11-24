// Dog Park's boards: an n × n park split into n coloured areas, and maybe a few
// trees (no dog can sit on a tree). One dog per row, per column and per area,
// and no two dogs touching, not even corner to corner. Every board made here has
// exactly one answer, so it can always be solved by thinking, never by guessing.
//
// How a board is made: put n dogs down legally (that's the answer), grow the
// areas outwards from the dogs, then look for a second answer. While there is
// one, move a square that second answer uses into a neighbouring area, which
// breaks it without touching the real answer. Repeat until it's the only one.

/** A board: { n, regions } where regions[y * n + x] is the area's number, -1 for a tree or -2 for water. */

const neighbours4 = (i, n) => {
  const x = i % n;
  const y = Math.floor(i / n);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
};

/**
 * Walks every answer of a board, calling found(cells) for each (cells: the dogs' squares,
 * top row first). found returns true to stop. Returns how many it saw.
 *
 * It works like a person would: each step it takes the row, column or area with the
 * fewest squares still open and tries each of them, so a forced dog goes in at once and
 * a dead end shows up early.
 */
export function search(n, regions, found, stats) {
  const size = n * n;
  const blocked = new Int16Array(size); // how many placed dogs rule each square out
  for (let i = 0; i < size; i++) if (regions[i] < 0) blocked[i] = 1;
  const doneRow = new Uint8Array(n);
  const doneCol = new Uint8Array(n);
  const doneArea = new Uint8Array(n);
  const dogs = [];
  const nearby = [];
  for (let i = 0; i < size; i++) {
    const x = i % n;
    const y = Math.floor(i / n);
    const list = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < n && yy < n) list.push(yy * n + xx);
      }
    }
    nearby.push(list);
  }
  // A dog rules out its row, its column, its area and the squares round it.
  const mark = (cell, by) => {
    const x = cell % n;
    const y = Math.floor(cell / n);
    const a = regions[cell];
    for (let i = 0; i < size; i++) {
      if (Math.floor(i / n) === y || i % n === x || regions[i] === a) blocked[i] += by;
    }
    for (const j of nearby[cell]) {
      const jx = j % n;
      const jy = Math.floor(j / n);
      if (jy !== y && jx !== x && regions[j] !== a) blocked[j] += by;
    }
  };
  const rowOpen = new Int16Array(n);
  const colOpen = new Int16Array(n);
  const areaOpen = new Int16Array(n);
  let count = 0;
  let stop = false;
  const go = () => {
    if (stats) stats.steps++;
    if (dogs.length === n) {
      count++;
      const cells = dogs.slice().sort((a, b) => a - b);
      if (found && found(cells)) stop = true;
      return;
    }
    rowOpen.fill(0);
    colOpen.fill(0);
    areaOpen.fill(0);
    for (let i = 0; i < size; i++) {
      if (blocked[i]) continue;
      rowOpen[Math.floor(i / n)]++;
      colOpen[i % n]++;
      areaOpen[regions[i]]++;
    }
    // The tightest unit still to fill; one with nothing open means a dead end.
    let kind = -1;
    let unit = -1;
    let least = Infinity;
    for (let k = 0; k < n; k++) {
      if (!doneRow[k] && rowOpen[k] < least) [kind, unit, least] = [0, k, rowOpen[k]];
      if (!doneCol[k] && colOpen[k] < least) [kind, unit, least] = [1, k, colOpen[k]];
      if (!doneArea[k] && areaOpen[k] < least) [kind, unit, least] = [2, k, areaOpen[k]];
    }
    if (least === 0) return;
    const options = [];
    for (let i = 0; i < size; i++) {
      if (blocked[i]) continue;
      if ((kind === 0 && Math.floor(i / n) === unit) || (kind === 1 && i % n === unit) || (kind === 2 && regions[i] === unit)) options.push(i);
    }
    for (const cell of options) {
      if (stop) return;
      const y = Math.floor(cell / n);
      const x = cell % n;
      const a = regions[cell];
      dogs.push(cell);
      doneRow[y] = doneCol[x] = doneArea[a] = 1;
      mark(cell, 1);
      go();
      mark(cell, -1);
      doneRow[y] = doneCol[x] = doneArea[a] = 0;
      dogs.pop();
    }
  };
  go();
  return count;
}

/** How many answers a board has, counting no further than `limit`. */
export function countAnswers(n, regions, limit = 2) {
  let c = 0;
  search(n, regions, () => ++c >= limit);
  return Math.min(c, limit);
}

/** How hard a board is for the solver: the steps it takes to be sure of the answer. */
export function difficulty(n, regions) {
  const stats = { steps: 0 };
  search(n, regions, null, stats);
  return stats.steps;
}

/** The board's answer (the dogs' squares), or null when there isn't one. */
export function answerOf(n, regions) {
  let out = null;
  search(n, regions, (cells) => {
    out = cells;
    return true;
  });
  return out;
}

/** Is an area still in one piece (squares joined side to side)? */
function joined(n, regions, area) {
  const cells = [];
  for (let i = 0; i < regions.length; i++) if (regions[i] === area) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const todo = [cells[0]];
  while (todo.length) {
    const i = todo.pop();
    for (const j of neighbours4(i, n)) {
      if (regions[j] === area && !seen.has(j)) {
        seen.add(j);
        todo.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/** n dogs placed legally: one per row and column, none touching. Column per row. */
function placeDogs(n, rng) {
  const cols = [];
  const used = new Set();
  const go = (y) => {
    if (y === n) return true;
    const order = [...Array(n).keys()].sort(() => rng() - 0.5);
    for (const x of order) {
      if (used.has(x) || (y > 0 && Math.abs(x - cols[y - 1]) <= 1)) continue;
      cols[y] = x;
      used.add(x);
      if (go(y + 1)) return true;
      used.delete(x);
    }
    return false;
  };
  go(0);
  return cols.map((x, y) => y * n + x);
}

/**
 * A new board with exactly one answer: { n, regions, answer }.
 * trees: how many trees to plant (squares no area gets); pond: [w, h] of water somewhere.
 */
export function makeBoard(n, rng = Math.random, { trees = 0, pond = null } = {}) {
  for (;;) {
    const answer = placeDogs(n, rng);
    const dogs = new Set(answer);
    const regions = new Array(n * n).fill(null);
    // The pond: a block of water somewhere no dog of the answer sits.
    if (pond) {
      const [w, h] = pond;
      const spots = [];
      for (let y = 1; y + h < n; y++) {
        for (let x = 1; x + w < n; x++) {
          const cells = [];
          for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push((y + dy) * n + x + dx);
          if (!cells.some((c) => dogs.has(c))) spots.push(cells);
        }
      }
      if (!spots.length) continue;
      for (const c of spots[Math.floor(rng() * spots.length)]) regions[c] = -2;
    }
    // Trees, on squares the answer doesn't use.
    const free = [...Array(n * n).keys()].filter((i) => !dogs.has(i) && regions[i] === null).sort(() => rng() - 0.5);
    for (const i of free.slice(0, trees)) regions[i] = -1;
    answer.forEach((cell, area) => (regions[cell] = area));
    // Grow every area a square at a time, a random area each step, so they come out in all shapes.
    for (;;) {
      const options = [];
      for (let i = 0; i < regions.length; i++) {
        if (regions[i] === null || regions[i] < 0) continue;
        for (const j of neighbours4(i, n)) if (regions[j] === null) options.push([j, regions[i]]);
      }
      if (!options.length) break;
      const [j, area] = options[Math.floor(rng() * options.length)];
      regions[j] = area;
    }
    // A square no area could reach (walled in by trees) becomes a tree too.
    for (let i = 0; i < regions.length; i++) if (regions[i] === null) regions[i] = -1;
    if (refine(n, regions, answer, rng)) return { n, regions, answer };
  }
}

/** Breaks every other answer by moving squares between areas. False if it gets stuck. */
function refine(n, regions, answer, rng) {
  const dogs = new Set(answer);
  for (let round = 0; round < 400; round++) {
    let other = null;
    search(n, regions, (cells) => {
      if (cells.some((c, i) => c !== answer[i])) {
        other = cells;
        return true;
      }
      return false;
    });
    if (!other) return true;
    // The squares that second answer uses and the real one doesn't: move one of them to another area.
    const moves = [];
    for (const c of other) {
      if (dogs.has(c)) continue;
      for (const j of neighbours4(c, n)) {
        const to = regions[j];
        if (to >= 0 && to !== regions[c] && !moves.some(([cc, t]) => cc === c && t === to)) moves.push([c, to]);
      }
    }
    moves.sort(() => rng() - 0.5);
    let moved = false;
    for (const [c, to] of moves) {
      const from = regions[c];
      regions[c] = to;
      if (joined(n, regions, from)) {
        moved = true;
        break;
      }
      regions[c] = from;
    }
    if (!moved) return false;
  }
  return false;
}
