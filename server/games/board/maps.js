// Party Board maps: graphs of spaces. Each space { x, y, type, next, ... }:
//   x / y      0..1, for drawing
//   type       start (acts as blue), blue, red, event, bonus, shop, warp (sends you to a random space)
//   next       where a step goes: one index, or two at a fork (first = default)
//   starCandidate  where the ⭐ can appear
//   h          (3D layouts) height level: 0 ground, 1 ledge, 2 top; linked spaces differ by at most 1 (stairs)
//   bridge     (3D layouts) the `next` links that cross a gap on a bridge
// A map: { name, tier: easy | medium | hard | expert, starPrice, shopMarkup, spaces }, and maybe a twist:
//   drawbridge { fork, to, span: [a, b], every }  the way from `fork` to `to` crosses a drawbridge (the
//              link a → b) that is up every other `every` rounds: then that way is shut
//   market     { factors, stars }  shop prices (× a factor) and the star price change every round
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

/** Spaces from rows [x, y, code, next...]; code 'blue*' is a star candidate. */
function graph(rows) {
  return rows.map(([x, y, code, ...next]) => {
    const sp = { x, y, type: code.replace('*', ''), next };
    if (code.endsWith('*')) sp.starCandidate = true;
    return sp;
  });
}

/** World size of the 2D board: x 0..1 spans 22 units, y 0..1 spans 13 (see board3d.js at()). */
const WORLD = { w: 22, d: 13 };

/**
 * Spaces designed in 3D world units: rows [X, Z, h, code, ...next]; a next written 'b12' crosses a
 * bridge to 12. x / y (0..1, for the 2D board) come from X / Z.
 */
function world(rows) {
  const r3 = (n) => Math.round(n * 1000) / 1000;
  return rows.map(([X, Z, h, code, ...links]) => {
    const next = links.map((n) => (typeof n === 'string' ? Number(n.slice(1)) : n));
    const sp = { x: r3(X / WORLD.w + 0.5), y: r3(Z / WORLD.d + 0.5), h, type: code.replace('*', ''), next };
    const bridge = links.filter((n) => typeof n === 'string').map((n) => Number(n.slice(1)));
    if (bridge.length) sp.bridge = bridge;
    if (code.endsWith('*')) sp.starCandidate = true;
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
  [0.46, 0.08, 'red', 9], [0.59, 0.08, 'warp', 10], [0.72, 0.08, 'blue', 11], [0.85, 0.08, 'bonus', 12],
  [0.93, 0.2, 'blue', 13], [0.93, 0.36, 'red', 14], [0.93, 0.52, 'blue*', 15, 28], [0.93, 0.68, 'event', 16],
  [0.93, 0.84, 'blue', 17], [0.8, 0.92, 'blue', 18], [0.67, 0.92, 'red', 19], [0.54, 0.92, 'warp', 20],
  [0.41, 0.92, 'blue*', 21], [0.28, 0.92, 'shop', 22], [0.17, 0.92, 'red', 0],
  [0.22, 0.32, 'red', 24], [0.37, 0.4, 'event', 25], [0.52, 0.48, 'blue', 26], [0.67, 0.48, 'red', 27], [0.8, 0.44, 'blue', 13],
  [0.8, 0.66, 'red', 29], [0.66, 0.74, 'blue', 18],
]);

// 👻 Haunted Maze (hard): a side loop at 5 that sends you back before it,
// forks at 12 and 18, two pipes that pull you back, and stars far out.
const HAUNTED = graph([
  [0.5, 0.92, 'start', 1], [0.38, 0.92, 'blue', 2], [0.26, 0.92, 'red', 3], [0.14, 0.92, 'blue', 4],
  [0.06, 0.8, 'event', 5], [0.06, 0.65, 'red', 6, 23], [0.06, 0.5, 'blue', 7], [0.06, 0.35, 'shop', 8],
  [0.06, 0.2, 'red', 9], [0.14, 0.08, 'blue*', 10], [0.28, 0.08, 'red', 11], [0.42, 0.08, 'warp', 12],
  [0.56, 0.08, 'blue', 13, 26], [0.7, 0.08, 'red', 14], [0.84, 0.08, 'bonus', 15], [0.94, 0.2, 'blue*', 16],
  [0.94, 0.35, 'red', 17], [0.94, 0.5, 'event', 18], [0.94, 0.65, 'blue', 19, 30], [0.94, 0.8, 'red', 20],
  [0.86, 0.92, 'blue*', 21], [0.74, 0.92, 'warp', 22], [0.62, 0.92, 'red', 0],
  [0.2, 0.7, 'blue', 24], [0.3, 0.6, 'red', 25], [0.2, 0.5, 'event', 3],
  [0.5, 0.25, 'red', 27], [0.5, 0.42, 'blue*', 28], [0.5, 0.58, 'red', 29], [0.62, 0.7, 'blue', 22],
  [0.82, 0.7, 'red', 31], [0.72, 0.58, 'blue', 29],
]);

// 🌋 Volcano Peak (expert), on three levels: a front ledge (with basalt pillars over a lava gap),
// stairs up both sides to a mid ledge and the back plateau under the volcano. Forks: at 2 the inner
// route climbs the left plateau and crosses the arch bridge; at 11 a shortcut over the right ledge;
// at 20 down through the crystal cave; at 31 (on the bridge) a side path up to the back. Mostly red.
const VOLCANO = world([
  [-9.4, 5.2, 0, 'start', 1], [-7.3, 5.2, 0, 'red', 2], [-5.2, 5.2, 0, 'blue', 3, 28], [-3.1, 5.2, 0, 'red', 4],
  [-1.0, 5.2, 0, 'event', 'b5'], [1.1, 5.2, 0, 'red', 'b6'], [3.2, 5.2, 0, 'blue*', 7], [5.3, 5.2, 0, 'warp', 8],
  [7.4, 5.2, 0, 'red', 9], [9.5, 5.0, 0, 'shop', 10],
  [9.7, 3.0, 0, 'red', 11], [9.7, 1.0, 1, 'blue', 12, 35], [9.7, -1.0, 1, 'red', 13], [9.7, -3.1, 2, 'bonus', 14],
  [9.4, -5.2, 2, 'red', 15],
  [7.3, -5.4, 2, 'blue*', 16], [5.2, -5.4, 2, 'red', 17], [3.1, -5.4, 2, 'red', 18], [1.0, -5.4, 2, 'warp', 19],
  [-1.1, -5.4, 2, 'event', 20], [-3.2, -5.4, 2, 'blue', 21, 38], [-5.3, -5.4, 2, 'blue*', 22], [-7.4, -5.4, 2, 'red', 23],
  [-9.4, -5.2, 2, 'blue', 24],
  [-9.7, -3.1, 2, 'red', 25], [-9.7, -1.0, 1, 'red', 26], [-9.7, 1.0, 1, 'warp', 27], [-9.7, 3.1, 0, 'blue', 0],
  [-5.6, 3.2, 0, 'red', 29], [-4.4, 1.3, 1, 'blue*', 30], [-2.5, 0.3, 1, 'red', 'b31'], [0.2, 0.3, 1, 'event', 'b32', 41],
  [2.9, 0.3, 1, 'red', 33], [4.6, 1.9, 0, 'shop', 34], [6.3, 3.4, 0, 'red', 8],
  [7.6, -0.6, 1, 'red', 36], [6.1, -2.0, 1, 'blue', 37], [4.7, -3.5, 2, 'red', 17],
  [-3.6, -3.4, 2, 'red', 39], [-5.6, -2.5, 1, 'blue*', 40], [-7.5, -1.3, 1, 'red', 26],
  [0.4, -1.8, 1, 'red', 42], [0.5, -3.6, 2, 'blue', 18],
]);

// 🌉 Sky Bridges (medium): islands in the sky round the edge; at 2 a short cut across the middle
// crosses a drawbridge (22 → 23) that is down for two rounds, then up for two (the long way round).
const SKYBRIDGES = graph([
  [0.08, 0.88, 'start', 1], [0.08, 0.72, 'blue', 2], [0.08, 0.56, 'blue*', 3, 21], [0.08, 0.4, 'shop', 4],
  [0.08, 0.24, 'event', 5], [0.18, 0.1, 'blue', 6], [0.32, 0.1, 'red', 7], [0.46, 0.1, 'blue*', 8],
  [0.6, 0.1, 'bonus', 9], [0.74, 0.1, 'red', 10], [0.88, 0.1, 'blue', 11], [0.92, 0.26, 'blue*', 12],
  [0.92, 0.42, 'event', 13], [0.92, 0.58, 'red', 14], [0.92, 0.74, 'blue', 15], [0.86, 0.9, 'warp', 16],
  [0.72, 0.9, 'blue*', 17], [0.58, 0.9, 'red', 18], [0.44, 0.9, 'event', 19], [0.3, 0.9, 'blue', 20],
  [0.18, 0.9, 'red', 0],
  [0.22, 0.5, 'blue', 22], [0.36, 0.5, 'red', 23], [0.5, 0.5, 'blue*', 24], [0.64, 0.5, 'event', 25], [0.78, 0.5, 'blue', 13],
]);

// 🛒 Market Square (hard): a town square with two shops; at 5 the market street cuts through
// the middle (with the second shop), and at 21 a lane runs back down to the start. Prices change
// every round (see `market`).
const MARKET = graph([
  [0.5, 0.92, 'start', 1], [0.36, 0.92, 'blue', 2], [0.22, 0.92, 'red', 3], [0.08, 0.84, 'shop', 4],
  [0.08, 0.66, 'blue*', 5], [0.08, 0.48, 'red', 6, 19], [0.08, 0.3, 'event', 7], [0.12, 0.12, 'blue', 8],
  [0.26, 0.08, 'red', 9], [0.4, 0.08, 'blue*', 10], [0.54, 0.08, 'warp', 11], [0.68, 0.08, 'red', 12],
  [0.82, 0.08, 'bonus', 13], [0.92, 0.2, 'blue', 14], [0.92, 0.38, 'red', 15], [0.92, 0.56, 'blue*', 16],
  [0.92, 0.74, 'event', 17], [0.84, 0.9, 'red', 18], [0.66, 0.92, 'blue*', 0],
  [0.24, 0.5, 'blue', 20], [0.38, 0.4, 'shop', 21], [0.52, 0.4, 'red', 22, 24], [0.66, 0.4, 'blue*', 23],
  [0.78, 0.5, 'event', 15],
  [0.52, 0.58, 'red', 25], [0.52, 0.76, 'blue', 0],
]);

export const MAPS = {
  island: { name: '🏝️ Party Island', tier: 'easy', starPrice: 20, shopMarkup: 1, spaces: loop(ring(), ISLAND) },
  lagoons: { name: '🌊 Twin Lagoons', tier: 'easy', starPrice: 20, shopMarkup: 1, spaces: LAGOONS },
  pipes: { name: '🔧 Pipe Works', tier: 'medium', starPrice: 20, shopMarkup: 1, spaces: PIPES },
  haunted: { name: '👻 Haunted Maze', tier: 'hard', starPrice: 25, shopMarkup: 1, spaces: HAUNTED },
  volcano: { name: '🌋 Volcano Peak', tier: 'expert', starPrice: 30, shopMarkup: 1.5, spaces: VOLCANO },
  skybridges: { name: '🌉 Sky Bridges', tier: 'medium', starPrice: 20, shopMarkup: 1, spaces: SKYBRIDGES, drawbridge: { fork: 2, to: 21, span: [22, 23], every: 2 } },
  market: { name: '🛒 Market Square', tier: 'hard', starPrice: 25, shopMarkup: 1, spaces: MARKET, market: { factors: [0.5, 0.75, 1, 1.25, 1.5, 2], stars: [15, 20, 25, 30, 35] } },
};

/** Everything wrong with a map (an empty list: it's fine). */
export function validateMap(map) {
  const s = map.spaces;
  const out = [];
  const ok = (i) => Number.isInteger(i) && i >= 0 && i < s.length;
  const edges = (i) => s[i].next.filter(ok);
  s.forEach((sp, i) => {
    if (!Array.isArray(sp.next) || sp.next.length < 1) out.push(`space ${i}: no way on`);
    else if (sp.next.length > 2) out.push(`space ${i}: a fork has exactly 2 ways on`);
    (sp.next || []).forEach((n) => {
      if (!ok(n)) out.push(`space ${i}: bad link to ${n}`);
      else if (n === i) out.push(`space ${i}: links to itself`);
    });
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
  // Twists.
  const d = map.drawbridge;
  if (d) {
    if (!ok(d.fork) || s[d.fork].next.length !== 2 || !s[d.fork].next.includes(d.to)) out.push('drawbridge: not on a fork');
    else if (!Array.isArray(d.span) || !ok(d.span[0]) || !s[d.span[0]].next.includes(d.span[1])) out.push('drawbridge: its span is not a link');
    if (!Number.isInteger(d.every) || d.every < 1) out.push('drawbridge: rounds up / down must be a whole number');
  }
  const mk = map.market;
  if (mk) {
    if (!Array.isArray(mk.factors) || !mk.factors.length || mk.factors.some((f) => !(f > 0))) out.push('market: price factors must be above 0');
    if (!Array.isArray(mk.stars) || !mk.stars.length || mk.stars.some((n) => !Number.isInteger(n) || n < 1)) out.push('market: star prices must be whole coins');
  }
  // 3D layouts: one level per stair, bridges only on real links, no paths crossing.
  if (s.some((sp) => sp.h !== undefined)) {
    s.forEach((sp, i) => {
      if (![0, 1, 2].includes(sp.h)) return out.push(`space ${i}: height level must be 0, 1 or 2`);
      sp.next.forEach((n) => { if ([0, 1, 2].includes(s[n].h) && Math.abs(sp.h - s[n].h) > 1) out.push(`space ${i}: too steep to ${n}`); });
      (sp.bridge || []).forEach((n) => { if (!sp.next.includes(n)) out.push(`space ${i}: bridge to ${n} isn't a link`); });
    });
    const links = s.flatMap((sp, i) => sp.next.map((n) => [i, n]));
    // A bridge may pass over a path that's wholly below it.
    const isBridge = (a, b) => (s[a].bridge || []).includes(b);
    const over = (a, b, c, d) => isBridge(a, b) && Math.min(s[a].h, s[b].h) > Math.max(s[c].h, s[d].h);
    const P = (i) => ({ X: s[i].x * WORLD.w, Z: s[i].y * WORLD.d });
    const side = (a, b, c) => Math.sign((b.X - a.X) * (c.Z - a.Z) - (b.Z - a.Z) * (c.X - a.X));
    links.forEach(([a, b], k) => links.slice(k + 1).forEach(([c, d]) => {
      if (new Set([a, b, c, d]).size < 4 || over(a, b, c, d) || over(c, d, a, b)) return;
      const [A, B, C, D] = [P(a), P(b), P(c), P(d)];
      if (side(C, D, A) !== side(C, D, B) && side(A, B, C) !== side(A, B, D)) out.push(`paths ${a}-${b} and ${c}-${d} cross`);
    }));
  }
  return out;
}
