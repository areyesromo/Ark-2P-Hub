// Simon Says: orders flash up one after another: "Simon says GREEN!" or just "RED!". Press the
// colour only when Simon says so (+1); the wrong colour or obeying an order Simon didn't give
// costs a point. Orders come faster as the time runs. Most points wins.
export const COLORS = ['green', 'red', 'blue', 'yellow']; // as a controller's A, B, X, Y
export const SIMON_CHANCE = 0.65;
export const ORDER = { startMs: 1800, endMs: 1100, gapMs: 450 }; // how long an order stays up, early -> late
export const POINTS = { right: 1, wrong: -1, trap: -1 };
const DURATION_MS = 30000;

export default {
  id: 'simon-says', kind: 'party', look: '2d', name: 'Simon Says', order: 'SIMON SAYS…', howTo: 'Press the colour only when Simon says so', durationMs: DURATION_MS,
  create(api) {
    const points = [0, 0];
    let order = null; // { id, color, simon, until }
    let answers = [null, null]; // this order: 'right' | 'wrong' | 'trap' | null
    let nextId = 1;
    const lerp = (a, b) => a + (b - a) * Math.min(1, api.elapsed() / DURATION_MS);

    function next() {
      order = {
        id: nextId++,
        color: COLORS[Math.floor(api.rng() * COLORS.length)],
        // The first order is always a real one, so nobody loses a point for trying.
        simon: nextId === 2 || api.rng() < SIMON_CHANCE,
        until: api.now() + lerp(ORDER.startMs, ORDER.endMs),
      };
      answers = [null, null];
      api.update();
      api.setTimeout(clear, order.until - api.now());
    }

    function clear() {
      order = Object.assign({}, order, { done: true });
      api.update();
      api.setTimeout(next, ORDER.gapMs);
    }

    return {
      start() { api.setTimeout(next, 600); },
      onInput(slot, input) {
        if (input.type !== 'press' || (slot !== 0 && slot !== 1) || !COLORS.includes(input.color)) return;
        if (!order || order.done || answers[slot]) return;
        const kind = !order.simon ? 'trap' : input.color === order.color ? 'right' : 'wrong';
        answers[slot] = kind;
        points[slot] += POINTS[kind];
        api.update();
      },
      onTimeUp: () => api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 }),
      view: () => ({
        order: order && { id: order.id, color: order.color, simon: order.simon, done: !!order.done, left: Math.max(0, order.until - api.now()) },
        answers,
        points,
      }),
    };
  },
};
