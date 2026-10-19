// Pour It (phones only): hold your phone upright like a bottle and tip it sideways to pour into
// your glass (or hold the POUR button); stand it back up to stop. Get the drink as close to the line as you can: overfill it and you
// spill, which loses. When you've poured and held still for a moment, your glass is done.
export const TICK_MS = 100;
export const FLOW = 0.32; // of a glass per second, at full tilt
export const SETTLE_MS = 2000; // poured, then this long without pouring: done
export const MIN_FILL = 0.1; // a dribble (picking the phone up) doesn't count as having poured
export const LINE = { min: 0.55, max: 0.85 };
const DURATION_MS = 25000;

export default {
  id: 'pour-it', kind: 'party', look: '2d', phoneOnly: true, name: 'Pour It', order: 'POUR!', howTo: 'Hold the phone up like a bottle and tip it sideways to pour (or hold POUR); stand it up to stop. Closest to the line wins; spill and you lose', durationMs: DURATION_MS,
  create(api) {
    const line = Math.round((LINE.min + api.rng() * (LINE.max - LINE.min)) * 100) / 100;
    // Each glass: fill 0..1+, the pour now (0..1), when it last poured, done / spilled.
    const glasses = [0, 1].map(() => ({ fill: 0, pour: 0, lastPour: 0, done: false, spilled: false }));
    let over = false;

    const score = (g) => (g.spilled ? Infinity : Math.abs(g.fill - line));
    function finish() {
      if (over) return;
      over = true;
      const [a, b] = glasses.map(score);
      api.end({ winner: a === b ? null : a < b ? 0 : 1 });
    }

    function tick() {
      if (over) return;
      const now = api.now();
      glasses.forEach((g) => {
        if (g.done) return;
        if (g.pour > 0) {
          g.fill += (FLOW * g.pour * TICK_MS) / 1000;
          g.lastPour = now;
          if (g.fill > 1) {
            g.fill = 1;
            g.spilled = true;
            g.done = true;
          }
        } else if (g.fill >= MIN_FILL && now - g.lastPour >= SETTLE_MS) g.done = true;
      });
      api.update();
      if (glasses.every((g) => g.done)) return finish();
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() { api.setTimeout(tick, TICK_MS); },
      onInput(slot, input) {
        if (input.type !== 'pour' || (slot !== 0 && slot !== 1) || !Number.isFinite(input.v)) return;
        const g = glasses[slot];
        if (!g.done) g.pour = Math.max(0, Math.min(1, input.v));
      },
      onTimeUp: finish,
      view: () => ({
        line,
        glasses: glasses.map((g) => ({ fill: Math.round(g.fill * 1000) / 1000, pouring: g.pour > 0 && !g.done, done: g.done, spilled: g.spilled })),
      }),
    };
  },
};
