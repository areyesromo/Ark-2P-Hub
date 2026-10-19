// Whack-a-Mole: moles pop up in a 3 × 3 field, in a player's colour or gold. Whack one of
// yours for +1 and a gold one for +2 (first whack takes it); whacking your rival's costs 1.
// They come faster and stay up shorter as the time runs. Most points wins.
export const HOLES = 9;
export const POINTS = { mine: 1, gold: 2, theirs: -1 };
export const SPAWN = { firstMs: 600, startMs: 650, endMs: 380 }; // gap between moles, early -> late
export const UP = { startMs: 1300, endMs: 800 }; // how long a mole stays up
export const GOLD_CHANCE = 0.12;
const DURATION_MS = 25000;

export default {
  id: 'whack-a-mole', kind: 'party', look: '2d', name: 'Whack-a-Mole', order: 'WHACK!', howTo: 'Whack the moles in your colour (gold: +2), not theirs', durationMs: DURATION_MS,
  create(api) {
    const holes = new Array(HOLES).fill(null); // { id, who: 0 | 1 | 'gold', until } or null
    const points = [0, 0];
    let nextId = 1;
    let last = null; // the last whack: { hole, by, kind: 'mine' | 'gold' | 'theirs' }
    const lerp = (a, b) => a + (b - a) * Math.min(1, api.elapsed() / DURATION_MS);

    function spawn() {
      const now = api.now();
      holes.forEach((m, i) => { if (m && m.until <= now) holes[i] = null; });
      const free = holes.map((m, i) => i).filter((i) => !holes[i]);
      if (free.length) {
        const hole = free[Math.floor(api.rng() * free.length)];
        const who = api.rng() < GOLD_CHANCE ? 'gold' : api.rng() < 0.5 ? 0 : 1;
        holes[hole] = { id: nextId++, who, until: now + lerp(UP.startMs, UP.endMs) };
      }
      api.update();
      api.setTimeout(spawn, lerp(SPAWN.startMs, SPAWN.endMs) / (api.speed || 1));
    }

    return {
      start() { api.setTimeout(spawn, SPAWN.firstMs); },
      onInput(slot, input) {
        if (input.type !== 'whack' || (slot !== 0 && slot !== 1) || !Number.isInteger(input.hole)) return;
        const m = holes[input.hole];
        if (!m || m.until <= api.now()) return;
        const kind = m.who === 'gold' ? 'gold' : m.who === slot ? 'mine' : 'theirs';
        points[slot] += POINTS[kind];
        holes[input.hole] = null;
        last = { hole: input.hole, by: slot, kind, id: m.id };
        api.update();
      },
      onTimeUp: () => api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 }),
      view: () => {
        const now = api.now();
        return {
          holes: holes.map((m) => (m && m.until > now ? { id: m.id, who: m.who, left: m.until - now } : null)),
          points,
          last,
        };
      },
    };
  },
};
