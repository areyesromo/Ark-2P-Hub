/**
 * The computer teammate for Dungeon Duo (see `bot` in index.js): the Fighter or the Healer,
 * whichever you aren't. It plays its part the way a friend on the sofa does:
 *   - a downed partner comes first: it goes and stands by you to bring you back;
 *   - the Healer drops its circle when either of you is hurt (and you're close), and keeps its
 *     distance from enemies, firing bolts; the Fighter closes in and swings, and raises its shield
 *     against bones and the Warden's charge;
 *   - it gets out of the Warden's slam ring and out of the way of its charge;
 *   - then the floor: a key it can reach, the door it opens, holding a pressure plate while you
 *     wait at the gate (and the plate on the far side for you), and the stairs (it waits for you
 *     there). Raised spikes it waits out.
 * It sees things a reaction time late and moves with a person's wobble.
 *   easy:   slow to react, swings and shoots less often, and wanders a little.
 *   normal: steady.
 *   hard:   quick, and dodges the Warden early.
 */
import { HEROES, WARDEN } from './dungeon-duo.js';
import { reactionMs } from './bot-human.js';

const LEVEL = {
  easy: { lag: 1.3, attack: 0.55, wobble: 0.25, dodge: 0.6 },
  normal: { lag: 1, attack: 0.85, wobble: 0.12, dodge: 0.85 },
  hard: { lag: 0.8, attack: 1, wobble: 0.05, dodge: 1 },
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SOLID = new Set(['#', 'D', 'I', '>', '<']);

/** A walk (breadth first) over the floor's tiles from (x, y): { dist, prev }. */
function walkFrom(map, x, y, gateOpen, spikesUp) {
  const pass = (c) => c !== undefined && !SOLID.has(c) && (c !== 'G' || gateOpen) && (c !== '^' || !spikesUp);
  const start = x + ',' + y;
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const queue = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = nx + ',' + ny;
      if (dist.has(k) || !pass((map[ny] || '')[nx])) continue;
      dist.set(k, dist.get(cx + ',' + cy) + 1);
      prev.set(k, [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  return { dist, prev, start };
}

/** The next tile on the way to (tx, ty), or null if it can't get there. */
function nextTile(w, tx, ty) {
  let k = tx + ',' + ty;
  if (!w.dist.has(k)) return null;
  let p = w.prev.get(k);
  if (!p) return [tx, ty];
  while (p && p.join() !== w.start) {
    k = p.join();
    p = w.prev.get(k);
  }
  return k.split(',').map(Number);
}

export function dungeonDuoBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || !view.heroes) return null;
  const me = view.heroes[view.you];
  const mate = view.heroes[1 - view.you];
  // Between floors, on a retry, or down: hands off the controls (so it doesn't walk off later).
  if (view.phase !== 'play' || me.downed) return view.phase === 'over' ? null : { type: 'move', x: 0, y: 0, special: false, botDelayMs: 200 };
  const map = view.map;
  const tileAt = (x, y) => (map[Math.floor(y)] || '')[Math.floor(x)];
  const cell = (b) => [Math.floor(b.x), Math.floor(b.y)];
  const [mx, my] = cell(me);
  const pace = reactionMs(level, rng) * L.lag;
  const r2 = (n) => Math.round(n * 100) / 100;
  const wob = () => (rng() * 2 - 1) * L.wobble;
  // (its hand wobbles: the way it walks is a little off, by a small turn)
  const turn = (x, y, k = 1) => {
    const a = wob();
    return { x: r2((x * Math.cos(a) - y * Math.sin(a)) * k), y: r2((x * Math.sin(a) + y * Math.cos(a)) * k) };
  };
  const onIce = tileAt(me.x, me.y) === '~';
  const steer = (dx, dy, extra = {}) => {
    const d = Math.hypot(dx, dy) || 1;
    let [sx, sy] = [dx / d, dy / d];
    if (onIce) {
      // On ice: steer against the slide (aim for a gentle speed the right way, and correct for the drift).
      const want = Math.min(1.6, d * 1.5);
      sx = sx * want + (sx * want - (me.vx || 0));
      sy = sy * want + (sy * want - (me.vy || 0));
      const n = Math.hypot(sx, sy);
      if (n > 1) [sx, sy] = [sx / n, sy / n];
    }
    return { type: 'move', ...turn(sx, sy), ...extra, botDelayMs: pace * (onIce ? 0.4 : 0.6) };
  };
  const stop = (extra = {}) => ({ type: 'move', x: 0, y: 0, ...extra, botDelayMs: pace * 0.6 });
  const fighter = me.role === 'fighter';
  const shield = (on) => fighter && on !== me.blocking;
  // (routes go over the spikes: it waits at their edge while they're up, rather than giving up)
  const walk = walkFrom(map, mx, my, view.gateOpen, false);
  /** Walk towards (x, y) (a point), round walls; null if there's no way there. */
  const goTo = (x, y, extra = {}) => {
    const [tx, ty] = [Math.floor(x), Math.floor(y)];
    if (tx === mx && ty === my) return Math.hypot(x - me.x, y - me.y) < 0.15 ? stop(extra) : steer(x - me.x, y - me.y, extra);
    const next = nextTile(walk, tx, ty);
    if (!next) return null;
    // (a raised spike tile next: wait for it to go down)
    if ((map[next[1]] || '')[next[0]] === '^' && view.spikesUp && tileAt(me.x, me.y) !== '^') return stop(extra); // (already on them: keep going)
    return steer(next[0] + 0.5 - me.x, next[1] + 0.5 - me.y, extra);
  };

  // 1. The Warden's moves: out of the slam ring, out of the charge's lane.
  const warden = view.enemies.find((e) => e.kind === 'warden');
  // (whether it reacts to a warning in time is decided once a warning)
  const tele = warden && warden.tele ? warden.tele.kind + ':' + warden.id + ':' + (memory.dungeonTeles || 0) : null;
  if (!tele && memory.dungeonTele) memory.dungeonTeles = (memory.dungeonTeles || 0) + 1;
  if (tele && (!memory.dungeonTele || memory.dungeonTele.key !== tele)) memory.dungeonTele = { key: tele, dodge: rng() < L.dodge };
  if (!tele) memory.dungeonTele = null;
  if (warden && warden.tele && memory.dungeonTele.dodge) {
    if (warden.tele.kind === 'slam' && Math.hypot(me.x - warden.x, me.y - warden.y) < WARDEN.slamR + 0.6) {
      return steer(me.x - warden.x, me.y - warden.y, shield(false) ? { special: false } : {});
    }
    if (warden.tele.kind === 'charge') {
      const { dx, dy, len } = warden.tele;
      const ax = me.x - warden.x;
      const ay = me.y - warden.y;
      const along = ax * dx + ay * dy;
      const side = ax * -dy + ay * dx;
      if (along > 0 && along < len + 1 && Math.abs(side) < 1.3) {
        // In its lane: the Fighter can take it on the shield (it stuns the Warden); the Healer steps aside.
        if (fighter && level !== 'easy') return { type: 'move', x: r2(-dx * 0.3), y: r2(-dy * 0.3), special: true, botDelayMs: pace * 0.6 }; // (facing it: the shield's at the front)
        const s = side >= 0 ? 1 : -1;
        return steer(-dy * s, dx * s);
      }
    }
  }

  // 2. A downed partner: go and stand beside them.
  if (mate.downed) return goTo(mate.x, mate.y, shield(false) ? { special: false } : {}) || stop();

  // 3. The Healer's circle: someone hurt, the two of you close, and it's ready.
  if (!fighter && me.healIn === 0 && (me.hp <= me.max / 2 || (mate.hp <= mate.max / 2 && Math.hypot(mate.x - me.x, mate.y - me.y) < 1.5))) {
    return { type: 'special', on: true, botDelayMs: pace };
  }
  if (!fighter && me.healIn === 0 && mate.hp <= mate.max / 2) {
    const w = goTo(mate.x, mate.y);
    if (w) return w;
  }

  // 4. A fight: the nearest enemy it can see, close enough to matter.
  const seen = view.enemies
    .map((e) => ({ e, d: Math.hypot(e.x - me.x, e.y - me.y) }))
    .filter(({ e, d }) => d < (e.kind === 'warden' ? 14 : 6.5) && walk.dist.has(cell(e).join()))
    .sort((a, b) => a.d - b.d);
  // Bones flying at it: up with the shield (the Fighter).
  const before = memory.dungeonBones || [];
  memory.dungeonBones = view.bones.map((b) => Math.hypot(b.x - me.x, b.y - me.y));
  const bi = view.bones.findIndex((b, i) => memory.dungeonBones[i] < 2 && before[i] !== undefined && memory.dungeonBones[i] < before[i]); // (coming its way)
  if (fighter && bi !== -1 && level !== 'easy') {
    const b = view.bones[bi];
    const d = memory.dungeonBones[bi] || 1;
    return { type: 'move', x: r2(((b.x - me.x) / d) * 0.3), y: r2(((b.y - me.y) / d) * 0.3), special: true, botDelayMs: pace * 0.6 }; // (turned to it, shield up)
  }
  if (seen.length) {
    const { e, d } = seen[0];
    const dx = e.x - me.x;
    const dy = e.y - me.y;
    const reach = fighter ? HEROES.fighter.reach + (e.r || 0.3) - 0.3 : 6;
    const facing = (dx * me.face[0] + dy * me.face[1]) / (d || 1) > (fighter ? 0.7 : 0.95);
    const off = shield(false) ? { special: false } : {};
    // In range: turn to it and strike, in one motion (Easy a beat slower to swing).
    const strike = { type: 'attack', botDelayMs: 60 + (1 - L.attack) * 500 };
    if (fighter) {
      if (d > reach * 0.85) return goTo(e.x, e.y, off) || steer(dx, dy, off);
      if (facing && me.readyIn === 0) return strike;
      return { type: 'move', ...turn(dx / (d || 1), dy / (d || 1), 0.3), ...off, botDelayMs: facing ? pace * 0.6 : 40 };
    }
    if (d <= reach && facing && me.readyIn === 0 && d >= 2.2) return strike;
    // The Healer: back off when it's close, else line up a bolt (a straight shot it can see).
    if (d < 2.2) return steer(-dx, -dy);
    return { type: 'move', ...turn(dx / d, dy / d, 0.25), botDelayMs: facing ? pace * 0.6 : 40 };
  }
  if (fighter && me.blocking) return stop({ special: false });

  // 5. The floor: plates and gates, keys and doors, then the stairs.
  const find = (c) => {
    const out = [];
    map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === c) out.push([x, y]); }));
    return out;
  };
  const near = (list) => list.filter(([x, y]) => walk.dist.has(x + ',' + y)).sort((a, b) => walk.dist.get(a.join()) - walk.dist.get(b.join()))[0];
  const plates = find('P');
  const gates = find('G');
  const onPlate = tileAt(me.x, me.y) === 'P';
  const mateOnPlate = tileAt(mate.x, mate.y) === 'P' && !mate.downed;
  if (gates.length) {
    // The far side of the gate: where the key (or the stairs) is, as if the gate were shut.
    const goal = find('K')[0];
    const far = goal ? walkFrom(map, goal[0], goal[1], false, false).dist : new Map();
    const meFar = far.has(cell(me).join());
    const mateFar = far.has(cell(mate).join());
    const farPlate = near(plates.filter(([x, y]) => far.has(x + ',' + y)));
    const nearPlate = near(plates.filter(([x, y]) => !far.has(x + ',' + y)));
    if (goal && meFar && !mateFar) {
      // You're still on the near side: hold the plate out here for you.
      if (onPlate) return stop();
      if (farPlate) return goTo(farPlate[0] + 0.5, farPlate[1] + 0.5);
    }
    if (goal && !meFar) {
      if (mateFar && view.gateOpen) return goTo(mate.x, mate.y) || stop(); // (you're holding it: through)
      if (!mateFar && mateOnPlate && view.gateOpen && farPlate) return goTo(farPlate[0] + 0.5, farPlate[1] + 0.5); // (through, to hold the far one for you)
      if (!mateFar && !mateOnPlate) {
        // Neither of us through: it takes the plate here so you can go (or waits on it).
        if (onPlate) return stop();
        if (nearPlate) return goTo(nearPlate[0] + 0.5, nearPlate[1] + 0.5);
      }
      if (onPlate) return stop();
    }
    if (!goal) {
      // The key's taken: the gate only matters while one of you is still on the other side of it.
      const shut = walkFrom(map, mx, my, false, false);
      if (!shut.dist.has(cell(mate).join())) {
        if (onPlate) return stop();
        if (mateOnPlate && view.gateOpen) return goTo(mate.x, mate.y) || stop();
        const p = near(plates.filter(([x, y]) => shut.dist.has(x + ',' + y)));
        if (p) return goTo(p[0] + 0.5, p[1] + 0.5);
      }
    }
  }
  // The iron door: one of us on each lever at once. It takes the lever you're not going for.
  const levers = find('l');
  if (!view.leversPulled && levers.length === 2 && find('I').length) {
    const dTo = (b, [x, y]) => Math.hypot(b.x - x - 0.5, b.y - y - 0.5);
    const yours = mate.downed ? null : levers.slice().sort((a, b) => dTo(mate, a) - dTo(mate, b))[0];
    const mine = levers.find((l) => l !== yours) || levers[0];
    if (walk.dist.has(mine.join())) {
      if (mx === mine[0] && my === mine[1]) return stop();
      return goTo(mine[0] + 0.5, mine[1] + 0.5) || stop();
    }
  }
  const doors = find('D');
  if (doors.length) {
    if (view.keys > 0) {
      // Walk into the door with the key (from a tile beside it).
      for (const [x, y] of doors) {
        for (const [dx, dy] of DIRS) {
          if (!walk.dist.has(x + dx + ',' + (y + dy))) continue;
          if (mx === x + dx && my === y + dy) return steer(-dx, -dy);
          return goTo(x + dx + 0.5, y + dy + 0.5);
        }
      }
    }
    const key = near(find('K'));
    if (key && view.keys === 0) return goTo(key[0] + 0.5, key[1] + 0.5);
  }
  const stairs = near(find('E'));
  if (stairs) {
    // On the stairs: wait for you (and if two tiles of stairs, any will do).
    if (tileAt(me.x, me.y) === 'E') return stop();
    return goTo(stairs[0] + 0.5, stairs[1] + 0.5);
  }
  // Nothing else to do: keep near you.
  const d = Math.hypot(mate.x - me.x, mate.y - me.y);
  if (d > 2) return goTo(mate.x, mate.y) || stop();
  return stop();
}
