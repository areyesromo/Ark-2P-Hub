// Hot Air Race: two balloons race to the flag. Hold BURN to heat the air and rise; let go and it
// cools and sinks. The wind blows at different speeds at different heights (and the bands change as
// the race goes on): find the fast one and ride it. Touch the ground and you drag along slowly.
// First to the flag wins; at time up, whoever's further on.
export const TICK_MS = 50;
export const LENGTH = 100; // the course, in wind-units
export const BANDS = 5; // wind bands, bottom to top
export const LIFT = 0.55; // climb a second while burning (heights 0 to 1)
export const SINK = 0.32; // fall a second while not
export const GROUND_SPEED = 0.6; // on the ground: crawling
export const SHIFT_MS = 6000; // the bands change speeds this often
export const SPEEDS = [1.2, 2.2, 3.1, 4]; // what a band's wind can be (a second)
const DURATION_MS = 45000;

/** Which band height `y` is in (0 bottom). */
export const bandOf = (y) => Math.min(BANDS - 1, Math.floor(y * BANDS));

export default {
  id: 'hot-air-race', kind: 'party', look: '2d', name: 'Hot Air Race', order: 'RIDE THE WIND!', howTo: 'Hold BURN to rise, let go to sink. Find the fastest wind and race to the flag', durationMs: DURATION_MS,
  create(api) {
    const balloons = [0, 1].map(() => ({ x: 0, y: 0, vy: 0, burn: false }));
    let winds = []; // the wind in each band, bottom to top
    let shifts = 0;
    let done = false;
    let finish = null; // who got there first

    function newWinds() {
      // Every speed somewhere, the fastest one in a different band each time.
      const order = [];
      for (let i = 0; i < BANDS; i++) order.push(SPEEDS[Math.min(SPEEDS.length - 1, Math.floor(api.rng() * SPEEDS.length))]);
      const fast = Math.floor(api.rng() * BANDS);
      order[fast] = SPEEDS[SPEEDS.length - 1];
      for (let i = 0; i < BANDS; i++) if (i !== fast && order[i] === SPEEDS[SPEEDS.length - 1]) order[i] = SPEEDS[SPEEDS.length - 2];
      winds = order;
      shifts++;
    }

    function tick() {
      if (done) return;
      const dt = TICK_MS / 1000;
      balloons.forEach((b, slot) => {
        b.y = Math.max(0, Math.min(1, b.y + (b.burn ? LIFT : -SINK) * dt));
        const speed = b.y <= 0.001 ? GROUND_SPEED : winds[bandOf(b.y)];
        b.x = Math.min(LENGTH, b.x + speed * dt);
        if (b.x >= LENGTH && finish === null) finish = slot;
      });
      api.update();
      if (finish !== null) {
        done = true;
        return api.setTimeout(() => api.end({ winner: finish }), 900);
      }
      api.setTimeout(tick, TICK_MS);
    }

    function shift() {
      if (done) return;
      newWinds();
      api.setTimeout(shift, SHIFT_MS);
    }

    return {
      start() {
        newWinds();
        api.setTimeout(shift, SHIFT_MS);
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if ((slot !== 0 && slot !== 1) || input.type !== 'burn' || done) return;
        balloons[slot].burn = input.on === true;
      },
      onTimeUp: () => {
        if (done) return;
        done = true;
        const [a, b] = balloons.map((x) => x.x);
        api.end({ winner: Math.abs(a - b) < 0.01 ? null : a > b ? 0 : 1 });
      },
      view: () => ({
        length: LENGTH, bands: BANDS, winds, shifts,
        balloons: balloons.map((b) => ({ x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 1000) / 1000, burn: b.burn })),
        finish,
      }),
    };
  },
};
