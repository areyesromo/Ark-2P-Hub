// Hurdle Dash: a side-view race over the same hurdles for both. The runners run by themselves and
// keep speeding up; you only jump. Clear a hurdle and you keep your speed; touch it (on the ground
// as you reach it) and you stumble and slow right down. First to the finish wins; at time up,
// whoever is further along.
export const TICK_MS = 50;
export const LENGTH = 100; // metres
export const START_SPEED = 4; // m/s
export const TOP_SPEED = 9;
export const ACCEL = 0.35; // m/s gained each second
export const JUMP_MS = 550; // time in the air (about 4-5 m at speed: a hurdle fits easily)
export const STUMBLE_SPEED = 2.5;
export const STUMBLE_MS = 600;
export const MIN_GAP = 7; // metres between hurdles

const round = (v) => Math.round(v * 100) / 100;

export default {
  id: 'hurdle-dash', kind: 'party', look: '2d', name: 'Hurdle Dash', order: 'JUMP THE HURDLES!', howTo: 'Tap JUMP (or A) just before each hurdle', durationMs: 30000,
  create(api) {
    // One course for both: hurdles from 10 m, 7-11 m apart, the last one before 94 m.
    const hurdles = [];
    for (let at = 10; at < 94; at += MIN_GAP + Math.floor(api.rng() * 5)) hurdles.push(at);
    const runners = [0, 1].map(() => ({ pos: 0, speed: START_SPEED, airUntil: 0, stumbleUntil: 0, next: 0, clipped: 0 }));
    let done = false;

    function tick() {
      if (done) return;
      const now = api.now();
      const dt = TICK_MS / 1000;
      runners.forEach((r) => {
        if (now >= r.stumbleUntil) r.speed = Math.min(TOP_SPEED, r.speed + ACCEL * dt);
        r.pos += r.speed * dt;
        // Each hurdle passed: cleared in the air, or clipped on the ground.
        while (r.next < hurdles.length && r.pos >= hurdles[r.next]) {
          if (now >= r.airUntil) {
            r.clipped++;
            r.speed = STUMBLE_SPEED;
            r.stumbleUntil = now + STUMBLE_MS;
          }
          r.next++;
        }
      });
      const finished = runners.filter((r) => r.pos >= LENGTH);
      if (finished.length) {
        done = true;
        const [a, b] = runners;
        return api.end({ winner: finished.length === 2 && a.pos === b.pos ? null : a.pos > b.pos ? 0 : 1 });
      }
      api.update();
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() {
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if (done || input.type !== 'jump' || (slot !== 0 && slot !== 1)) return;
        const r = runners[slot];
        const now = api.now();
        if (now < r.airUntil || now < r.stumbleUntil) return; // already up, or still stumbling
        r.airUntil = now + JUMP_MS;
        api.update();
      },
      onTimeUp() {
        const [a, b] = runners;
        api.end({ winner: a.pos === b.pos ? null : a.pos > b.pos ? 0 : 1 });
      },
      view: () => {
        const now = api.now();
        return {
          length: LENGTH,
          hurdles,
          runners: runners.map((r) => ({
            pos: round(Math.min(r.pos, LENGTH)),
            speed: round(r.speed),
            // How far through the jump (0 on the ground), for drawing the arc.
            air: now < r.airUntil ? round(1 - (r.airUntil - now) / JUMP_MS) || 0.01 : 0,
            stumbling: now < r.stumbleUntil,
            clipped: r.clipped,
          })),
        };
      },
    };
  },
};
