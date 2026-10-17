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

export const MAPS = {
  island: { name: '🏝️ Party Island', tier: 'easy', starPrice: 20, shopMarkup: 1, spaces: loop(ring(), ISLAND) },
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
