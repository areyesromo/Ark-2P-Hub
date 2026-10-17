// Party Board maps: graphs of spaces. Each space { x, y, type, next, ... }:
//   x / y      0..1, for drawing
//   type       start (acts as blue), blue, red, event, bonus, shop, warp
//   next       where a step goes: one index, or two at a fork (first = default)
//   warp       for type 'warp': landing there moves you to this index
//   starCandidate  where the ⭐ can appear
// A map: { name, tier: easy | medium | hard | expert, starPrice, shopMarkup, spaces }.
// validateMap() checks a map has no dead ends or bad links (test/board-maps.test.js).

/** The 28 squares around a 10 × 6 grid's edge, clockwise from the top left. */
function ring() {
  const cells = [];
  for (let c = 0; c < 10; c++) cells.push([c, 0]);
  for (let r = 1; r < 5; r++) cells.push([9, r]);
  for (let c = 9; c >= 0; c--) cells.push([c, 5]);
  for (let r = 4; r >= 1; r--) cells.push([0, r]);
  return cells.map(([c, r]) => ({ x: Math.round((0.06 + c * 0.0978) * 1000) / 1000, y: Math.round((0.1 + r * 0.16) * 1000) / 1000 }));
}

const ISLAND = [
  'start', 'blue', 'blue*', 'red', 'event', 'blue', 'shop', 'blue*', 'blue', 'red',
  'bonus', 'blue', 'blue*', 'red', 'event', 'blue', 'blue', 'red', 'shop', 'blue*',
  'blue', 'red', 'bonus', 'blue', 'event', 'blue*', 'red', 'blue',
];

/** Spaces from type codes ('blue*': a star candidate), linked in a loop. */
function loop(points, codes) {
  return points.map((p, i) => {
    const t = codes[i];
    const sp = { ...p, type: t.replace('*', ''), next: [(i + 1) % points.length] };
    if (t.endsWith('*')) sp.starCandidate = true;
    return sp;
  });
}

/** Spaces from rows [x, y, code, next..., { warp }?]; code 'blue*' is a star candidate. */
function graph(rows) {
  return rows.map(([x, y, code, ...rest]) => {
    const opts = typeof rest[rest.length - 1] === 'object' ? rest.pop() : {};
    const sp = { x, y, type: code.replace('*', ''), next: rest };
    if (code.endsWith('*')) sp.starCandidate = true;
    if (opts.warp !== undefined) sp.warp = opts.warp;
    return sp;
  });
}

// 🌊 Twin Lagoons (easy): at 7 the path splits: a long safe way round the
// top-right (blue, the bonus) or a short cut through the lagoon (red, an event).
const LAGOONS = graph([
  [0.08, 0.85, 'start', 1], [0.08, 0.68, 'blue', 2], [0.08, 0.51, 'blue*', 3], [0.08, 0.34, 'event', 4],
  [0.08, 0.17, 'blue', 5], [0.2, 0.1, 'shop', 6], [0.32, 0.1, 'blue', 7], [0.44, 0.1, 'blue', 8, 14],
  [0.56, 0.1, 'blue', 9], [0.68, 0.1, 'blue*', 10], [0.8, 0.1, 'bonus', 11], [0.92, 0.17, 'blue', 12],
  [0.92, 0.34, 'blue*', 13], [0.92, 0.51, 'blue', 17],
  [0.5, 0.3, 'red', 15], [0.61, 0.42, 'event', 16], [0.74, 0.55, 'red', 17],
  [0.92, 0.68, 'blue', 18], [0.84, 0.85, 'red', 19], [0.72, 0.85, 'blue*', 20], [0.6, 0.85, 'event', 21],
  [0.48, 0.85, 'blue', 22], [0.36, 0.85, 'red', 23], [0.22, 0.85, 'blue', 0],
]);

// 🔧 Pipe Works (medium): forks at 4 and 14; the pipe at 9 shoots you ahead to
// 17, the one at 19 sends you back to the start.
const PIPES = graph([
  [0.07, 0.88, 'start', 1], [0.07, 0.72, 'blue', 2], [0.07, 0.56, 'blue*', 3], [0.07, 0.4, 'shop', 4],
  [0.07, 0.24, 'blue', 5, 23], [0.07, 0.08, 'blue', 6], [0.2, 0.08, 'event', 7], [0.33, 0.08, 'blue*', 8],
  [0.46, 0.08, 'red', 9], [0.59, 0.08, 'warp', 10, { warp: 17 }], [0.72, 0.08, 'blue', 11], [0.85, 0.08, 'bonus', 12],
  [0.93, 0.2, 'blue', 13], [0.93, 0.36, 'red', 14], [0.93, 0.52, 'blue*', 15, 28], [0.93, 0.68, 'event', 16],
  [0.93, 0.84, 'blue', 17], [0.8, 0.92, 'blue', 18], [0.67, 0.92, 'red', 19], [0.54, 0.92, 'warp', 20, { warp: 1 }],
  [0.41, 0.92, 'blue*', 21], [0.28, 0.92, 'shop', 22], [0.17, 0.92, 'red', 0],
  [0.22, 0.32, 'red', 24], [0.37, 0.4, 'event', 25], [0.52, 0.48, 'blue', 26], [0.67, 0.48, 'red', 27], [0.8, 0.44, 'blue', 13],
  [0.8, 0.66, 'red', 29], [0.66, 0.74, 'blue', 18],
]);

// 👻 Haunted Maze (hard): a side loop at 5 that sends you back before it,
// forks at 12 and 18, two pipes that pull you back, and stars far out.
const HAUNTED = graph([
  [0.5, 0.92, 'start', 1], [0.38, 0.92, 'blue', 2], [0.26, 0.92, 'red', 3], [0.14, 0.92, 'blue', 4],
  [0.06, 0.8, 'event', 5], [0.06, 0.65, 'red', 6, 23], [0.06, 0.5, 'blue', 7], [0.06, 0.35, 'shop', 8],
  [0.06, 0.2, 'red', 9], [0.14, 0.08, 'blue*', 10], [0.28, 0.08, 'red', 11], [0.42, 0.08, 'warp', 12, { warp: 3 }],
  [0.56, 0.08, 'blue', 13, 26], [0.7, 0.08, 'red', 14], [0.84, 0.08, 'bonus', 15], [0.94, 0.2, 'blue*', 16],
  [0.94, 0.35, 'red', 17], [0.94, 0.5, 'event', 18], [0.94, 0.65, 'blue', 19, 30], [0.94, 0.8, 'red', 20],
  [0.86, 0.92, 'blue*', 21], [0.74, 0.92, 'warp', 22, { warp: 12 }], [0.62, 0.92, 'red', 0],
  [0.2, 0.7, 'blue', 24], [0.3, 0.6, 'red', 25], [0.2, 0.5, 'event', 3],
  [0.5, 0.25, 'red', 27], [0.5, 0.42, 'blue*', 28], [0.5, 0.58, 'red', 29], [0.62, 0.7, 'blue', 22],
  [0.82, 0.7, 'red', 31], [0.72, 0.58, 'blue', 29],
]);

// 🌋 Volcano Peak (expert): forks at 2, 9, 14 and 19, three pipes that drop
// you back down, and mostly red slopes.
const VOLCANO = graph([
  [0.06, 0.9, 'start', 1], [0.18, 0.9, 'red', 2], [0.3, 0.9, 'blue', 3, 24], [0.42, 0.9, 'red', 4],
  [0.54, 0.9, 'event', 5], [0.66, 0.9, 'red', 6], [0.78, 0.9, 'blue*', 7], [0.92, 0.9, 'warp', 8, { warp: 1 }],
  [0.94, 0.74, 'red', 9], [0.94, 0.58, 'shop', 10, 27], [0.94, 0.42, 'red', 11], [0.94, 0.26, 'blue', 12],
  [0.94, 0.1, 'red', 13], [0.8, 0.08, 'bonus', 14], [0.66, 0.08, 'red', 15, 30], [0.52, 0.08, 'blue*', 16],
  [0.38, 0.08, 'red', 17], [0.24, 0.08, 'warp', 18, { warp: 2 }], [0.08, 0.1, 'red', 19], [0.06, 0.26, 'blue', 20, 32],
  [0.06, 0.42, 'red', 21], [0.06, 0.58, 'event', 22], [0.06, 0.74, 'blue*', 23], [0.14, 0.8, 'red', 0],
  [0.36, 0.75, 'red', 25], [0.48, 0.7, 'blue', 26], [0.6, 0.72, 'warp', 8, { warp: 0 }],
  [0.8, 0.6, 'red', 28], [0.7, 0.5, 'event', 29], [0.6, 0.4, 'red', 16],
  [0.6, 0.22, 'red', 31], [0.45, 0.3, 'blue*', 18],
  [0.2, 0.4, 'red', 33], [0.3, 0.55, 'blue', 22],
]);

export const MAPS = {
  island: { name: '🏝️ Party Island', tier: 'easy', starPrice: 20, shopMarkup: 1, spaces: loop(ring(), ISLAND) },
  lagoons: { name: '🌊 Twin Lagoons', tier: 'easy', starPrice: 20, shopMarkup: 1, spaces: LAGOONS },
  pipes: { name: '🔧 Pipe Works', tier: 'medium', starPrice: 20, shopMarkup: 1, spaces: PIPES },
  haunted: { name: '👻 Haunted Maze', tier: 'hard', starPrice: 25, shopMarkup: 1, spaces: HAUNTED },
  volcano: { name: '🌋 Volcano Peak', tier: 'expert', starPrice: 30, shopMarkup: 1.5, spaces: VOLCANO },
};

/** Everything wrong with a map (an empty list: it's fine). */
export function validateMap(map) {
  const s = map.spaces;
  const out = [];
  const ok = (i) => Number.isInteger(i) && i >= 0 && i < s.length;
  const edges = (i) => s[i].next.filter(ok).concat(s[i].type === 'warp' && ok(s[i].warp) ? [s[i].warp] : []);
  s.forEach((sp, i) => {
    if (!Array.isArray(sp.next) || sp.next.length < 1) out.push(`space ${i}: no way on`);
    else if (sp.next.length > 2) out.push(`space ${i}: a fork has exactly 2 ways on`);
    (sp.next || []).forEach((n) => {
      if (!ok(n)) out.push(`space ${i}: bad link to ${n}`);
      else if (n === i) out.push(`space ${i}: links to itself`);
    });
    if (sp.type === 'warp' && (!ok(sp.warp) || sp.warp === i)) out.push(`space ${i}: bad warp target ${sp.warp}`);
    if (!(sp.x >= 0 && sp.x <= 1 && sp.y >= 0 && sp.y <= 1)) out.push(`space ${i}: off the board`);
  });
  if (out.length) return out;
  const reach = (from, step) => {
    const seen = new Set([from]);
    const todo = [from];
    while (todo.length) for (const n of step(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
    return seen;
  };
  const fromStart = reach(0, edges);
  s.forEach((_, i) => {
    if (!fromStart.has(i)) out.push(`space ${i}: can't be reached`);
    if (!reach(i, edges).has(0)) out.push(`space ${i}: can't get back to the start`);
  });
  const count = (t) => s.filter((sp) => sp.type === t).length;
  const stars = s.filter((sp) => sp.starCandidate);
  if (stars.length < 4 || stars.length > 6 || stars.some((sp) => sp.type !== 'blue')) out.push('4-6 star spaces, all blue');
  if (count('shop') < 1) out.push('no shop');
  if (count('event') < 2) out.push('fewer than 2 events');
  if (count('bonus') < 1) out.push('no bonus space');
  if (new Set(s.map((sp) => sp.x + ',' + sp.y)).size !== s.length) out.push('two spaces in one spot');
  return out;
}
