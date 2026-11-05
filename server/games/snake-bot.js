/**
 * The computer opponent for Snake Battle (see `bot` in index.js). Each step it looks at the three
 * ways it can go: never into a wall or a body when it has a way out, the one with the most room
 * left (a flood fill), and the nearest food it can get to first.
 *   easy:   avoids what's right in front of it, heads for food, and is sometimes late to turn.
 *   normal: checks it won't box itself in.
 *   hard:   quick, goes for food it can reach before you, and keeps away from your head.
 */
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const REACT = { easy: [50, 140], normal: [25, 55], hard: [10, 25] };

export function snakeBot(view, level, rng = Math.random) {
  if (!view || !REACT[level] || view.phase !== 'play' || !view.snakes) return null;
  const me = view.snakes[view.you];
  const them = view.snakes[1 - view.you];
  if (!me || me.crashed) return null;
  const { w, h } = view.grid;
  const blocked = new Uint8Array(w * h);
  // Bodies (a tail moves on, so its last cell is free next step).
  for (const s of view.snakes) s.body.forEach(([x, y], i) => { if (i < s.body.length - 1) blocked[y * w + x] = 1; });
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !blocked[y * w + x];
  const [hx, hy] = me.body[0];
  const theirHead = them && !them.crashed ? them.body[0] : null;
  const food = view.food || [];
  const options = [];
  for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
    if (dir === OPPOSITE[view.dir]) continue;
    const nx = hx + dx;
    const ny = hy + dy;
    if (!free(nx, ny)) { options.push({ dir, score: -1e9 }); continue; }
    let score = 0;
    if (level !== 'easy') {
      const room = flood(blocked, w, h, nx, ny, me.body.length * 2 + 10);
      score += room < me.body.length + 2 ? room * 50 - 1e6 : Math.min(room, 60) * 4; // don't box yourself in
    }
    // The nearest food (Hard: one it gets to before you).
    let best = Infinity;
    for (const [fx, fy] of food) {
      const d = Math.abs(fx - nx) + Math.abs(fy - ny);
      if (level === 'hard' && theirHead && Math.abs(fx - theirHead[0]) + Math.abs(fy - theirHead[1]) < d) continue;
      best = Math.min(best, d);
    }
    if (best < Infinity) score -= best * 10;
    if (level === 'hard' && theirHead && Math.abs(theirHead[0] - nx) + Math.abs(theirHead[1] - ny) <= 1) score -= 5000; // a head-on
    if (dir === view.dir) score += 1; // (no needless wiggling)
    options.push({ dir, score: score + rng() * (level === 'easy' ? 15 : 0.5) });
  }
  const best = options.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.dir === view.dir) return null;
  const [lo, hi] = REACT[level];
  return { type: 'turn', dir: best.dir, botDelayMs: lo + rng() * (hi - lo) };
}

/** How many cells can be reached from (x, y), up to `cap`. */
export function flood(blocked, w, h, x, y, cap) {
  const seen = new Uint8Array(w * h);
  const stack = [y * w + x];
  seen[y * w + x] = 1;
  let n = 0;
  while (stack.length && n < cap) {
    const k = stack.pop();
    n++;
    const cx = k % w;
    const cy = (k - cx) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = cx + dx;
      const ay = cy + dy;
      if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
      const j = ay * w + ax;
      if (seen[j] || blocked[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return n;
}
