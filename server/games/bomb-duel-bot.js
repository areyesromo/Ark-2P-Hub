/**
 * The computer opponent for Bomb Duel (see `bot` in index.js). It plays it the classic way: it
 * maps where every bomb's blast will reach and when, gets out of the way first, and only drops a
 * bomb where it can see a way out before it goes off. Otherwise it goes for power-ups and crates,
 * and (Normal, Hard) hunts you: a bomb where its blast reaches you. It reacts at human speed.
 *   easy:   slow, careless (it sometimes leaves itself no way out), just blasts crates.
 *   normal: careful, picks up power-ups, and comes after you once the crates thin out.
 *   hard:   quick, comes after you early, and bombs where you can't easily get out.
 */
import { W, H, RULES, isPillar } from './bomb-duel.js';
import { reactionMs } from './bot-human.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const LEVEL = { easy: { careless: 0.25, hunt: 0 }, normal: { careless: 0, hunt: 0.4 }, hard: { careless: 0, hunt: 1 } };
const key = (x, y) => y * W + x;

export function bombDuelBot(view, level, rng = Math.random) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.players) return null;
  const me = view.players[view.you];
  const foe = view.players[1 - view.you];
  if (!me.alive) return null;
  const mx = Math.round(me.x);
  const my = Math.round(me.y);
  const crates = new Set(view.crates);
  const walls = new Set(view.walls);
  const bombs = new Set(view.bombs.map((b) => key(b.x, b.y)));
  const solid = (x, y) => isPillar(x, y) || crates.has(key(x, y)) || walls.has(key(x, y));
  const pace = reactionMs(level, rng);
  const go = (dir) => ((view.want || null) === (dir || null) ? null : { type: 'move', dir: dir || 'stop', botDelayMs: pace });
  // When each cell burns (ms from now): the bombs' crosses, set off by each other.
  const danger = dangerMap(view, solid);
  const cellMs = 1000 / (me.speedCells || RULES.speed);
  // In danger: to the nearest safe cell it can reach in time.
  if (danger.has(key(mx, my))) {
    const way = escape(mx, my, danger, solid, bombs, cellMs);
    return go(way ? way.first : null);
  }
  // A bomb here? Only with a way out, and when it'd hit a crate or you.
  const range = me.range;
  const blast = cross(mx, my, range, solid);
  const hitsCrate = blast.some((k) => crates.has(k));
  const hitsYou = foe.alive && blast.includes(key(Math.round(foe.x), Math.round(foe.y)));
  const canDrop = view.bombs.filter((b) => b.owner === view.you).length < me.bombs && !bombs.has(key(mx, my));
  if (canDrop && (hitsCrate || (hitsYou && L.hunt > 0))) {
    const after = new Map(danger);
    for (const k of blast) after.set(k, Math.min(after.get(k) ?? Infinity, RULES.fuseMs));
    const safe = escape(mx, my, after, solid, new Set([...bombs, key(mx, my)]), cellMs);
    if (safe || rng() < L.careless) return { type: 'bomb', botDelayMs: pace };
  }
  // Where to go: a power-up, you (hunting), or the nearest spot beside a crate.
  const crateLeft = crates.size;
  const hunting = foe.alive && rng() < L.hunt * (crateLeft < 25 ? 1 : 0.5);
  const goal = (x, y) => {
    const k = key(x, y);
    if (view.powerups.some(([c]) => c === k)) return true;
    if (hunting && cross(x, y, range, solid).includes(key(Math.round(foe.x), Math.round(foe.y)))) return true;
    return !hunting && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => crates.has(key(x + dx, y + dy)));
  };
  const way = search(mx, my, (x, y, steps) => goal(x, y) && !(danger.get(key(x, y)) < (steps + 1) * cellMs), solid, bombs, danger, cellMs);
  if (way && way.first) return go(way.first);
  return go(null);
}

/** The cells a blast from (x, y) of `range` reaches: a cross, stopped by pillars, crates, walls. */
function cross(x, y, range, solid) {
  const out = [key(x, y)];
  for (const [dx, dy] of Object.values(DIRS)) {
    for (let i = 1; i <= range; i++) {
      const cx = x + dx * i;
      const cy = y + dy * i;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H || isPillar(cx, cy)) break;
      out.push(key(cx, cy));
      if (solid(cx, cy)) break; // (a crate or wall takes the blast)
    }
  }
  return out;
}

/** cell -> ms until it burns (fire now is 0), with bombs setting each other off. */
function dangerMap(view, solid) {
  const at = new Map();
  for (const k of view.fire) at.set(k, 0);
  const bombs = view.bombs.map((b) => ({ ...b, t: b.left }));
  // Chains: a bomb in another's blast goes off with it (a few passes settle it).
  for (let pass = 0; pass < 3; pass++) {
    for (const b of bombs) {
      const range = view.players[b.owner] ? view.players[b.owner].range : 2;
      for (const k of cross(b.x, b.y, range, solid)) {
        const other = bombs.find((o) => key(o.x, o.y) === k);
        if (other && other.t > b.t) other.t = b.t;
      }
    }
  }
  for (const b of bombs) {
    const range = view.players[b.owner] ? view.players[b.owner].range : 2;
    for (const k of cross(b.x, b.y, range, solid)) at.set(k, Math.min(at.get(k) ?? Infinity, b.t));
  }
  return at;
}

/** The nearest cell no blast will reach, that it can get to in time: { first: direction }. */
function escape(x, y, danger, solid, bombs, cellMs) {
  return search(x, y, (cx, cy) => !danger.has(key(cx, cy)), solid, bombs, danger, cellMs);
}

/** A walk (breadth first) to the nearest cell where `want` holds, through cells it can pass in time. */
function search(x, y, want, solid, bombs, danger, cellMs) {
  const seen = new Set([key(x, y)]);
  const queue = [{ x, y, steps: 0, first: null }];
  for (let q = 0; q < queue.length && q < 400; q++) {
    const c = queue[q];
    if (c.steps > 0 && want(c.x, c.y, c.steps)) return c;
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      const k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || solid(nx, ny) || bombs.has(k)) continue;
      // Don't walk into a cell that'll be burning when it gets there (with a little to spare).
      const burns = danger.get(k);
      const arrive = (c.steps + 1) * cellMs;
      if (burns !== undefined && burns <= arrive + 400 && burns + 600 >= arrive) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny, steps: c.steps + 1, first: c.first || dir });
    }
  }
  return null;
}
