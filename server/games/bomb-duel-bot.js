/**
 * The computer opponent for Bomb Duel (see `bot` in index.js). It plays it the classic way: it
 * maps where every bomb's blast will reach and when, gets out of the way first, and only drops a
 * bomb where it can see a way out before it goes off. Otherwise it goes for power-ups and crates,
 * and (Normal, Hard) hunts you: a bomb where its blast reaches you. It reacts at human speed.
 *   easy:   slow, careless (it sometimes leaves itself no way out), just blasts crates.
 *   normal: careful, picks up power-ups, and comes after you once the crates thin out.
 *   hard:   quick, comes after you early, and bombs where you'd have no way out (or a long one).
 */
import { W, H, RULES, isPillar } from './bomb-duel.js';
import { reactionMs } from './bot-human.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const LEVEL = { easy: { careless: 0.25, hunt: 0 }, normal: { careless: 0, hunt: 0.4 }, hard: { careless: 0, hunt: 1 } };
// How promptly it presses a step of a route it's following (a novice is a touch late).
const PRESS_MS = { easy: [60, 160], normal: [30, 80], hard: [15, 45] };
const key = (x, y) => y * W + x;

export function bombDuelBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.players) return null;
  const me = view.players[view.you];
  const foe = view.players[1 - view.you];
  if (!me.alive) return null;
  // Where it plans from: the cell it's in, or (moving) the next cell centre ahead, the first
  // place it can turn.
  const moving = Boolean(view.want) && (Math.abs(me.x - Math.round(me.x)) > 0.05 || Math.abs(me.y - Math.round(me.y)) > 0.05);
  const [fx, fy] = moving ? DIRS[me.dir] || [0, 0] : [0, 0];
  const mx = moving ? (fx > 0 ? Math.ceil(me.x) : fx < 0 ? Math.floor(me.x) : Math.round(me.x)) : Math.round(me.x);
  const my = moving ? (fy > 0 ? Math.ceil(me.y) : fy < 0 ? Math.floor(me.y) : Math.round(me.y)) : Math.round(me.y);
  const crates = new Set(view.crates);
  const walls = new Set(view.walls);
  const bombs = new Set(view.bombs.map((b) => key(b.x, b.y)));
  const solid = (x, y) => isPillar(x, y) || crates.has(key(x, y)) || walls.has(key(x, y));
  const pace = reactionMs(level, rng);
  // A step along a route it's following it presses as it gets there (judged afresh then, as a
  // player does); running from a blast is a reaction to what it saw.
  const step = (dir, react) => ((view.want || null) === (dir || null) ? null
    : react ? { type: 'move', dir: dir || 'stop', botDelayMs: pace }
      : { type: 'move', dir: dir || 'stop', botDelayMs: PRESS_MS[level][0] + rng() * (PRESS_MS[level][1] - PRESS_MS[level][0]), botAnticipate: true });
  const go = (dir) => step(dir, false);
  // When each cell burns (ms from now): the bombs' crosses, set off by each other.
  const danger = dangerMap(view, solid);
  // A person keeps a cell clear of a blast (stopping takes a moment): for where it walks and
  // stands, the cells beside a blast count as in it too.
  const wide = new Map(danger);
  for (const [k, t] of danger) {
    const x = k % W;
    const y = (k - x) / W;
    for (const [dx, dy] of Object.values(DIRS)) {
      const n = key(x + dx, y + dy);
      if (!solid(x + dx, y + dy) && !(wide.get(n) <= t)) wide.set(n, t);
    }
  }
  const cellMs = 1000 / (me.speedCells || RULES.speed);
  // In danger: to the nearest safe cell it can reach in time.
  if (danger.has(key(mx, my)) || danger.has(key(Math.round(me.x), Math.round(me.y)))) {
    const way = search(mx, my, (cx, cy) => !wide.has(key(cx, cy)), solid, bombs, danger, cellMs, pace) || escape(mx, my, danger, solid, bombs, cellMs, pace); // (well clear if it can be)
    // The first move away from a bomb it's only just seen is a reaction; after that it's a route.
    const fresh = view.bombs.some((b) => RULES.fuseMs - b.left < pace + 100);
    return step(way ? way.first : null, fresh);
  }
  // Whether it's after you or the crates, decided every few seconds (not every look).
  const window = view.round + ':' + Math.floor((view.timeLeftMs || 0) / 4000);
  if (!memory.bombHunt || memory.bombHunt.window !== window) {
    memory.bombHunt = { window, on: foe.alive && rng() < L.hunt * (crates.size < 25 ? 1 : 0.5) };
  }
  // A bomb? It goes where it stands, so it's judged for the cell it'll stop in (the one it's in,
  // or the next along if it's moving): only with a way out from there, and when it'd hit a crate
  // or you. Then it stops there first, and drops it standing still.
  const centred = Math.abs(me.x - mx) < 0.12 && Math.abs(me.y - my) < 0.12;
  const bx = mx;
  const by = my;
  const range = me.range;
  const blast = cross(bx, by, range, solid);
  const hitsCrate = blast.some((k) => crates.has(k));
  const fcx = Math.round(foe.x);
  const fcy = Math.round(foe.y);
  // A bomb from (x, y) that'd leave you nowhere (or a long way) to run (Hard looks for these).
  const traps = (x, y) => {
    const b = cross(x, y, range, solid);
    if (!foe.alive || !b.includes(key(fcx, fcy))) return false;
    const after = new Map(danger);
    for (const k of b) after.set(k, Math.min(after.get(k) ?? Infinity, RULES.fuseMs));
    const out = escape(fcx, fcy, after, solid, new Set([...bombs, key(x, y)]), 1000 / (foe.speedCells || RULES.speed), 0);
    return !out || out.steps >= 3; // (no way out, or a long one)
  };
  const hitsYou = foe.alive && blast.includes(key(fcx, fcy)) && (level !== 'hard' || traps(bx, by));
  const canDrop = view.bombs.filter((b) => b.owner === view.you).length < me.bombs && !bombs.has(key(bx, by)) && !danger.has(key(bx, by));
  if (canDrop && (hitsCrate || (hitsYou && L.hunt > 0))) {
    const after = new Map(danger);
    for (const k of blast) after.set(k, Math.min(after.get(k) ?? Infinity, RULES.fuseMs));
    const safe = escape(bx, by, after, solid, new Set([...bombs, key(bx, by)]), cellMs, pace);
    if (safe || rng() < L.careless) {
      if (!centred || view.want) return go(null); // (stop in it first)
      return { type: 'bomb', botDelayMs: pace };
    }
  }
  // Where to go: a power-up, you (hunting), or the nearest spot beside a crate.
  const hunting = memory.bombHunt.on;
  const goal = (x, y) => {
    const k = key(x, y);
    if (view.powerups.some(([c]) => c === k)) return true;
    if (hunting && (level === 'hard' ? traps(x, y) : cross(x, y, range, solid).includes(key(fcx, fcy)))) return true;
    return !hunting && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => crates.has(key(x + dx, y + dy)));
  };
  // Out of danger, it never steps into a blast's way (or right beside one): those cells it treats
  // as walls until the blast has been and gone.
  const blocked = (x, y) => solid(x, y) || wide.has(key(x, y));
  const way = search(mx, my, (x, y) => goal(x, y), blocked, bombs, new Map(), cellMs, pace);
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
function escape(x, y, danger, solid, bombs, cellMs, lag = 0) {
  return search(x, y, (cx, cy) => !danger.has(key(cx, cy)), solid, bombs, danger, cellMs, lag);
}

/** A walk (breadth first) to the nearest cell where `want` holds, through cells it can pass in time. */
function search(x, y, want, solid, bombs, danger, cellMs, lag = 0) {
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
      // Don't walk into a cell that'll be burning when it gets there (counting its own reaction
      // time before it sets off, and a margin either side of the blast).
      const burns = danger.get(k);
      const arrive = lag + (c.steps + 1) * cellMs;
      if (burns !== undefined && burns <= arrive + 600 && burns + RULES.fireMs + 400 >= arrive) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny, steps: c.steps + 1, first: c.first || dir });
    }
  }
  return null;
}
