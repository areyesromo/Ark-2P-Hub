// Reflex Grid: squares light up on a 3 x 3 grid, the same ones at the same moment for both of you.
// Tap a lit square before it fades for +1 (each of you can score every light once); tap a dark one
// and it's -1. The lights fade quicker as it goes. Most points wins.
export const TICK_MS = 50;
export const CELLS = 9;
export const LIFE_MS = [1300, 650]; // how long a light stays lit, from the start to the end
export const GAP_MS = [750, 420]; // between lights, from the start to the end
const DURATION_MS = 30000;

const lerp = (range, k) => Math.round(range[0] + (range[1] - range[0]) * Math.min(1, k));

export default {
  id: 'reflex-grid', kind: 'party', look: '2d', name: 'Reflex Grid', order: 'TAP THE LIGHTS!', howTo: 'Tap the lit squares before they fade (D-pad + A on a controller)', durationMs: DURATION_MS,
  create(api) {
    // The whole run of lights, one list for both, in minigame time: { id, cell, at, life }.
    const lights = [];
    for (let at = 800, id = 1; at < DURATION_MS - 500; id++) {
      const k = at / DURATION_MS;
      lights.push({ id, cell: Math.floor(api.rng() * CELLS), at, life: lerp(LIFE_MS, k) });
      at += lerp(GAP_MS, k);
    }
    const points = [0, 0];
    const hit = [new Set(), new Set()];
    let last = null; // the latest tap, for the TV: { slot, cell, good, at }
    let shown = '';

    const lit = (now) => lights.filter((l) => now >= l.at && now < l.at + l.life);

    function view() {
      const now = api.elapsed();
      return {
        lights: lit(now).map((l) => ({ id: l.id, cell: l.cell, life: l.life, left: l.at + l.life - now, hitBy: [hit[0].has(l.id), hit[1].has(l.id)] })),
        points,
        last: last && now - last.at < 400 ? { slot: last.slot, cell: last.cell, good: last.good } : null,
      };
    }
    // Sent when what's lit (or the last tap) changes, not every tick.
    function tick() {
      const v = view();
      const key = JSON.stringify([v.lights.map((l) => l.id), v.last]);
      if (key !== shown) {
        shown = key;
        api.update();
      }
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() {
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if ((slot !== 0 && slot !== 1) || input.type !== 'tap') return;
        const cell = input.cell;
        if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return;
        const now = api.elapsed();
        const light = lit(now).find((l) => l.cell === cell && !hit[slot].has(l.id));
        if (light) hit[slot].add(light.id);
        points[slot] += light ? 1 : -1;
        last = { slot, cell, good: Boolean(light), at: now };
        api.update();
      },
      onTimeUp: () => api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 }),
      view,
    };
  },
};
