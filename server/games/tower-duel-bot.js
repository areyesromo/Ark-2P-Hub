/**
 * The computer opponent for Tower Defence Duel (see `bot` in index.js). It plays a build order like
 * a person does: towers on the tiles that cover the most road, upgrades for the best of them, and
 * spare gold spent sending creeps down your road (which raises its income too). When creeps get
 * close to its base it shores up first. It takes a moment over each move.
 *   easy:   slow, builds on roughly the right tiles, mostly arrows, rarely sends.
 *   normal: the best tiles, a mix of towers, sends when it has gold to spare.
 *   hard:   quicker, the same mix (cannons where most road is in reach, frost further down the
 *           road), upgrades its best towers, and sends early to build its income.
 */
import { GRID, TOWERS, CREEPS, pathLength, pointAt, pathTiles } from './tower-duel.js';

const LEVEL = {
  easy: { think: [3500, 6000], pick: 6, send: 0.15, reserve: 30 },
  normal: { think: [2000, 3500], pick: 2, send: 0.5, reserve: 20 },
  hard: { think: [1200, 2200], pick: 1, send: 0.8, reserve: 10 },
};
const ROAD = pathTiles();
const LEN = pathLength();

/** How much road (in tiles) a tower on (x, y) with this range covers, and how far down it (0..1). */
const coverage = (() => {
  const cache = new Map();
  return (x, y, range) => {
    const k = x + ',' + y + ',' + range;
    if (!cache.has(k)) {
      let n = 0;
      let at = 0;
      for (let d = 0; d <= LEN; d += 0.25) {
        const p = pointAt(d);
        if (Math.hypot(p.x - (x + 0.5), p.y - (y + 0.5)) <= range) { n += 0.25; at += d * 0.25; }
      }
      cache.set(k, { road: n, depth: n ? at / n / LEN : 0 });
    }
    return cache.get(k);
  };
})();

export function towerDuelBot(view, level, rng = Math.random) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.sides) return null;
  const me = view.sides[view.you];
  const them = view.sides[1 - view.you];
  const wait = L.think[0] + rng() * (L.think[1] - L.think[0]);
  const taken = new Set(me.towers.map((t) => t.x + ',' + t.y));
  // Pressure: creeps well down its road.
  const danger = me.creeps.some((c) => c.d > LEN * 0.6);
  const spots = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const k = x + ',' + y;
      if (ROAD.has(k) || taken.has(k)) continue;
      spots.push({ x, y });
    }
  }
  // Which tower to build: Hard and Normal mix them (cannons where lots of road is in reach,
  // frost now and then); Easy mostly arrows.
  const kinds = me.towers.map((t) => t.kind);
  const count = (kind) => kinds.filter((k) => k === kind).length;
  let kind = 'arrow';
  if (level !== 'easy') {
    if (count('cannon') < Math.floor(me.towers.length / 3)) kind = 'cannon';
    else if (count('frost') < Math.floor(me.towers.length / 5)) kind = 'frost';
  }
  const build = (k) => {
    const def = TOWERS[k];
    const ranked = spots
      .map((s) => {
        const c = coverage(s.x, s.y, def.range[0]);
        // More road in reach; under pressure, nearer the base.
        return { ...s, v: c.road * (danger ? 0.6 + c.depth : 1) + (k === 'frost' ? c.depth : 0) };
      })
      .sort((a, b) => b.v - a.v);
    const s = ranked[Math.floor(rng() * Math.min(L.pick, ranked.length))];
    return s ? { type: 'build', kind: k, x: s.x, y: s.y, botDelayMs: wait } : null;
  };
  // 1. Under pressure: build, or upgrade, now.
  if (danger && me.gold >= TOWERS[kind].cost) return build(kind) || build('arrow');
  // 2. Upgrade its best tower when it's worth it (Normal, Hard), else build.
  const best = me.towers
    .filter((t) => t.level < 3)
    .map((t) => ({ t, v: coverage(t.x, t.y, TOWERS[t.kind].range[t.level - 1]).road }))
    .sort((a, b) => b.v - a.v)[0];
  const wantMore = me.towers.length < 3 + (view.wave || 0) * (level === 'hard' ? 1.2 : 1);
  if (wantMore && me.gold >= TOWERS[kind].cost + (danger ? 0 : L.reserve * 0.5)) return build(kind);
  if (best && level !== 'easy') {
    const cost = TOWERS[best.t.kind].upgrade[best.t.level - 1];
    if (me.gold >= cost + L.reserve) return { type: 'upgrade', x: best.t.x, y: best.t.y, level: best.t.level, botDelayMs: wait };
  }
  // 3. Spare gold: creeps down your road (more income for it).
  if (me.gold >= L.reserve + 8 && rng() < L.send) {
    const theirTowers = them.towers.length;
    const pick = level === 'hard' && theirTowers < 4 ? 'swarm' : me.gold > 60 ? 'brute' : 'runner';
    if (me.gold >= CREEPS[pick].cost + L.reserve) return { type: 'send', kind: pick, botDelayMs: wait };
  }
  if (me.gold >= TOWERS[kind].cost + L.reserve) return build(kind);
  return null;
}
