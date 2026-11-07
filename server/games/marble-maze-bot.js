/**
 * The computer teammate for Marble Maze (see `bot` in index.js). It tilts its half of the board
 * (left-right or forwards-back; in Shared, both, as a helping hand) the way a person does: it
 * picks the way through the maze (round the walls, well clear of the holes), looks a few cells
 * along it, and tilts towards that point, easing off as the marble picks up speed. It sees the
 * marble a moment late (a reaction time), and its hand isn't perfectly steady.
 *   easy:   late, a bit wobbly, and lets the marble roll too fast past the holes.
 *   normal: steady.
 *   hard:   quick and steady (it rarely drops one).
 */
import { reactionMs } from './bot-human.js';

// gain: how hard it tilts for a difference in speed; speed: how fast it lets the marble roll.
const LEVEL = {
  easy: { gain: 0.7, speed: 2.9, wobble: 0.15, lag: 1.3, ahead: 2 },
  normal: { gain: 0.9, speed: 2.4, wobble: 0.08, lag: 1, ahead: 2 },
  hard: { gain: 1.1, speed: 2.6, wobble: 0.04, lag: 0.8, ahead: 2 },
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const BELT = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };

/**
 * Steps from every open cell to `to` (the goal, or the button while its gate is shut), round walls,
 * holes and a shut gate, dearer next to a hole and against a belt.
 */
function costMap(map, to = 'G', gateOpen = true) {
  const h = map.length;
  const w = map[0].length;
  const at = (x, y) => (map[y] || '')[x];
  const nearHole = (x, y) => DIRS.some(([dx, dy]) => at(x + dx, y + dy) === 'O') || [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'O');
  const cost = Array.from({ length: h }, () => new Array(w).fill(Infinity));
  let goal = null;
  map.forEach((r, y) => [...r].forEach((c, x) => { if (c === to) goal = [x, y]; }));
  if (!goal) return cost;
  // (a small Dijkstra: the maps are tiny)
  cost[goal[1]][goal[0]] = 0;
  const open = [goal];
  while (open.length) {
    open.sort((a, b) => cost[b[1]][b[0]] - cost[a[1]][a[0]]);
    const [x, y] = open.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const c = at(nx, ny);
      if (!c || c === '#' || c === 'O' || (c === 'D' && !gateOpen)) continue;
      // (walking back from the goal: going nx,ny -> x,y against its belt is hard work)
      const belt = BELT[c];
      const against = !belt ? 0 : belt[0] === -dx && belt[1] === -dy ? 0 : belt[0] === dx && belt[1] === dy ? 8 : 2;
      const step = 1 + (nearHole(nx, ny) ? 3 : 0) + against;
      if (cost[y][x] + step < cost[ny][nx]) {
        cost[ny][nx] = cost[y][x] + step;
        open.push([nx, ny]);
      }
    }
  }
  return cost;
}

export function marbleMazeBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || !view.level || !view.marble) return null;
  // Falling, between mazes, or the countdown: hands off the board.
  if (view.phase !== 'play') return view.phase === 'over' ? null : { type: 'move', x: 0, y: 0, botDelayMs: 150 };
  const map = view.level.map;
  // A shut gate: the button first.
  const hasButton = map.some((r) => r.includes('b'));
  const to = hasButton && !view.gateOpen ? 'b' : 'G';
  if (!memory.marble || memory.marble.map !== map || memory.marble.to !== to) memory.marble = { map, to, cost: costMap(map, to, !hasButton || view.gateOpen) };
  const { cost } = memory.marble;
  const m = view.marble;
  // The point to head for: a few cells down the cheapest way from here.
  let cx = Math.floor(m.x);
  let cy = Math.floor(m.y);
  for (let k = 0; k < L.ahead; k++) {
    let best = null;
    for (const [dx, dy] of DIRS) {
      const c = (cost[cy + dy] || [])[cx + dx];
      if (c !== undefined && c < cost[cy][cx] && (!best || c < best.c)) best = { x: cx + dx, y: cy + dy, c };
    }
    if (!best) break;
    cx = best.x;
    cy = best.y;
  }
  // A sliding block on the row ahead: wait on this side until it's gone past.
  for (const b of view.movers || []) {
    if (cy === b.y && Math.floor(m.y) !== b.y && Math.abs(b.x + 0.5 - (cx + 0.5)) < 2.6) {
      cx = Math.floor(m.x);
      cy = Math.floor(m.y);
    }
  }
  const tx = cx + 0.5;
  const ty = cy + 0.5;
  // A speed to roll at towards it: gently near a hole, freer in the open; then tilt to get that
  // speed (it slows down for the turns, as you do).
  const holes = [];
  map.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'O') holes.push([x + 0.5, y + 0.5]); }));
  const near = Math.min(9, ...holes.map(([hx, hy]) => Math.hypot(hx - m.x, hy - m.y)));
  const cap = L.speed * (near < 1.6 ? 0.45 : near < 2.6 ? 0.7 : 1);
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = Math.min(cap, d * 2.2);
  const wob = () => (rng() * 2 - 1) * L.wobble;
  const x = Math.max(-1, Math.min(1, ((dx / d) * want - m.vx) * L.gain + wob()));
  const y = Math.max(-1, Math.min(1, ((dy / d) * want - m.vy) * L.gain + wob()));
  const axis = view.axis || 'both';
  const r2 = (n) => Math.round(n * 100) / 100;
  // Shared: a hand, not the whole board, and it gives way when you're tilting harder than it
  // (the board's lean beyond its own share is yours).
  let share = 0.7;
  if (axis === 'both' && memory.marbleSent) {
    const yours = Math.hypot(view.tilt.x - memory.marbleSent.x, view.tilt.y - memory.marbleSent.y);
    if (yours > 0.3) share = 0.25;
  }
  const move = axis === 'x' ? { x: r2(x), y: 0 } : axis === 'y' ? { x: 0, y: r2(y) } : { x: r2(x * share), y: r2(y * share) };
  memory.marbleSent = move;
  return { type: 'move', ...move, botDelayMs: reactionMs(level, rng) * 0.6 * L.lag };
}
