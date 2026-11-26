// Slitherlink's boards: a w × h grid of squares between dots, some with a number. The answer is one
// closed loop along the lines between dots, never crossing or touching itself; each number says how
// many of its square's four sides the loop uses.
//
// How a board is made: grow a random blob of squares (in one piece, with no holes), so its outline
// is one loop; number every square by its sides on the loop; then take numbers away, in a random
// order, as long as the board still solves by reasoning alone (the rules a person uses: a square's
// number, two lines at every dot or none, and no small loop closing early). So every board has
// exactly one answer and never needs a guess.
//
// Lines: across ones first (row by row, w of them on each of the h + 1 rows of dots), then the
// down ones (w + 1 on each of the h rows of squares).

export const OFF = 0;
export const ON = 1;
const UNKNOWN = -1;

/** The line numbers round a board: { cellEdges[c] (top, bottom, left, right), dotEdges[d], ends[e] (its two dots) }. */
export function geometry(w, h) {
  const H = (w) * (h + 1);
  const hEdge = (x, y) => y * w + x;
  const vEdge = (x, y) => H + y * (w + 1) + x;
  const edges = H + h * (w + 1);
  const cellEdges = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cellEdges.push([hEdge(x, y), hEdge(x, y + 1), vEdge(x, y), vEdge(x + 1, y)]);
  const dot = (x, y) => y * (w + 1) + x;
  const dotEdges = Array.from({ length: (w + 1) * (h + 1) }, () => []);
  const ends = new Array(edges);
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x < w; x++) {
      const e = hEdge(x, y);
      ends[e] = [dot(x, y), dot(x + 1, y)];
      dotEdges[dot(x, y)].push(e);
      dotEdges[dot(x + 1, y)].push(e);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x <= w; x++) {
      const e = vEdge(x, y);
      ends[e] = [dot(x, y), dot(x, y + 1)];
      dotEdges[dot(x, y)].push(e);
      dotEdges[dot(x, y + 1)].push(e);
    }
  }
  return { w, h, edges, cellEdges, dotEdges, ends };
}

/**
 * Solves by reasoning alone. clues: a number per square (-1 none). Returns { lines (1 on, 0 off,
 * -1 still unknown), solved, broken }.
 */
export function logicSolve(geo, clues) {
  const { edges, cellEdges, dotEdges, ends } = geo;
  const s = new Array(edges).fill(UNKNOWN);
  const set = (e, v) => {
    if (s[e] === v) return false;
    if (s[e] !== UNKNOWN) throw new Error('broken');
    s[e] = v;
    return true;
  };
  try {
    for (let changed = true; changed;) {
      changed = false;
      clues.forEach((k, c) => {
        if (k < 0) return;
        const es = cellEdges[c];
        const on = es.filter((e) => s[e] === ON).length;
        const unk = es.filter((e) => s[e] === UNKNOWN);
        if (on > k || on + unk.length < k) throw new Error('broken');
        if (on === k) for (const e of unk) changed = set(e, OFF) || changed;
        else if (on + unk.length === k) for (const e of unk) changed = set(e, ON) || changed;
      });
      for (const es of dotEdges) {
        const on = es.filter((e) => s[e] === ON).length;
        const unk = es.filter((e) => s[e] === UNKNOWN);
        if (on > 2 || (on === 1 && !unk.length)) throw new Error('broken');
        if (on === 2) for (const e of unk) changed = set(e, OFF) || changed;
        else if (on === 1 && unk.length === 1) changed = set(unk[0], ON) || changed;
        else if (on === 0 && unk.length === 1) changed = set(unk[0], OFF) || changed;
      }
      // No small loop: an unknown line joining the two ends of one stretch of line closes a loop,
      // so it's off (unless that loop would be every line there is, the finish).
      const { stretch, total } = stretches(geo, s);
      for (let e = 0; e < edges; e++) {
        if (s[e] !== UNKNOWN) continue;
        const [a, b] = ends[e];
        const sa = stretch.get(a);
        if (sa === undefined || sa !== stretch.get(b)) continue;
        if (sa.size < total) changed = set(e, OFF) || changed;
      }
    }
  } catch {
    return { lines: s, solved: false, broken: true };
  }
  const solved = !s.includes(UNKNOWN) && oneLoop(geo, s) && clues.every((k, c) => k < 0 || cellEdges[c].filter((e) => s[e] === ON).length === k);
  return { lines: s, solved, broken: false };
}

/** The stretches of line so far: each loose end's dot → the stretch (a Set of its lines); and how many lines are on. */
function stretches(geo, s) {
  const { edges, dotEdges, ends } = geo;
  const stretch = new Map();
  const seen = new Uint8Array(edges);
  let total = 0;
  for (let e = 0; e < edges; e++) if (s[e] === ON) total++;
  for (let e = 0; e < edges; e++) {
    if (s[e] !== ON || seen[e]) continue;
    const set = new Set();
    const todo = [e];
    seen[e] = 1;
    const tips = [];
    while (todo.length) {
      const f = todo.pop();
      set.add(f);
      for (const d of ends[f]) {
        const next = dotEdges[d].filter((g) => s[g] === ON && g !== f);
        if (!next.length) tips.push(d);
        for (const g of next) if (!seen[g]) { seen[g] = 1; todo.push(g); }
      }
    }
    for (const d of tips) stretch.set(d, set);
  }
  return { stretch, total };
}

/** Whether the lines that are on make one closed loop. */
export function oneLoop(geo, s) {
  const { edges, dotEdges, ends } = geo;
  const on = [];
  for (let e = 0; e < edges; e++) if (s[e] === ON) on.push(e);
  if (!on.length) return false;
  for (const es of dotEdges) {
    const k = es.filter((e) => s[e] === ON).length;
    if (k !== 0 && k !== 2) return false;
  }
  const seen = new Set([on[0]]);
  const todo = [on[0]];
  while (todo.length) {
    const f = todo.pop();
    for (const d of ends[f]) for (const g of dotEdges[d]) if (s[g] === ON && !seen.has(g)) { seen.add(g); todo.push(g); }
  }
  return seen.size === on.length;
}

/** A random blob of squares, in one piece and with no holes (so its outline is one loop). */
export function blob(w, h, rng, share = 0.5) {
  const inside = new Uint8Array(w * h);
  const want = Math.round(w * h * share);
  const nb = (c) => {
    const x = c % w;
    const y = Math.floor(c / w);
    return [x > 0 && c - 1, x < w - 1 && c + 1, y > 0 && c - w, y < h - 1 && c + w].filter((v) => v !== false);
  };
  // The outside (and any square not in the blob) all joined up, through the border: no holes.
  const noHoles = () => {
    const seen = new Uint8Array(w * h);
    const todo = [];
    for (let c = 0; c < w * h; c++) {
      const x = c % w;
      const y = Math.floor(c / w);
      if (!inside[c] && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) { seen[c] = 1; todo.push(c); }
    }
    while (todo.length) for (const d of nb(todo.pop())) if (!inside[d] && !seen[d]) { seen[d] = 1; todo.push(d); }
    for (let c = 0; c < w * h; c++) if (!inside[c] && !seen[c]) return false;
    return true;
  };
  const start = Math.floor(h / 2) * w + Math.floor(w / 2);
  inside[start] = 1;
  let count = 1;
  for (let tries = 0; count < want && tries < w * h * 40; tries++) {
    const list = [];
    for (let c = 0; c < w * h; c++) if (inside[c]) for (const d of nb(c)) if (!inside[d]) list.push(d);
    const c = list[Math.floor(rng() * list.length)];
    inside[c] = 1;
    if (noHoles()) count++;
    else inside[c] = 0;
  }
  return inside;
}

/** A board: { w, h, clues (a number per square, -1 none), answer (the loop's lines, 1 or 0) }. */
export function makeBoard(w, h, rng) {
  const geo = geometry(w, h);
  const inside = blob(w, h, rng, 0.45 + rng() * 0.15);
  const answer = new Array(geo.edges).fill(OFF);
  geo.cellEdges.forEach((es, c) => {
    const x = c % w;
    const y = Math.floor(c / w);
    const other = [y > 0 ? c - w : -1, y < h - 1 ? c + w : -1, x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1];
    es.forEach((e, k) => {
      const out = other[k] < 0 ? 0 : inside[other[k]];
      if (inside[c] !== out) answer[e] = ON;
    });
  });
  const clues = geo.cellEdges.map((es) => es.filter((e) => answer[e] === ON).length);
  const order = clues.map((_, c) => c).map((c) => [rng(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  for (const c of order) {
    const k = clues[c];
    clues[c] = -1;
    if (!logicSolve(geo, clues).solved) clues[c] = k;
  }
  return { w, h, clues, answer };
}
