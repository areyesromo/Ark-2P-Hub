// Bowling Bash (3D on the TV), phones only: swipe up the lane. The swipe's angle is your
// aim and its speed your power. Two rolls each; most pins wins. The pocket (just right of
// centre) at about 85% power is the sweet spot, with a little luck either way.
export const ROLL_MS = 1500;
export const SWEET = { aim: 0.15, power: 0.85 };

/** Pins in rows of 1-4: x across the lane, z back from the head pin. */
export const PINS = [];
for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) PINS.push({ x: Math.round((i - r / 2) * 0.6 * 100) / 100, z: Math.round(r * 0.52 * 100) / 100 });

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default {
  id: 'bowling', kind: 'party', look: '3d', phoneOnly: true, name: 'Bowling Bash', order: 'BOWL!', howTo: 'Swipe up the lane: the angle aims, the speed is your power. Two rolls', durationMs: 40000,
  create(api) {
    // stage: 'ready' (swipe!), 'rolling', 'done'
    const lanes = [0, 1].map(() => ({ roll: 1, stage: 'ready', since: 0, aim: null, power: null, standing: PINS.map((_, i) => i), knocked: [] }));
    const total = (s) => lanes[s].knocked.reduce((a, b) => a + b, 0);
    const result = () => api.end({ winner: total(0) === total(1) ? null : total(0) > total(1) ? 0 : 1 });

    function knock(lane) {
      const q = clamp01(1 - Math.abs(lane.aim - SWEET.aim) * 1.6) * clamp01(1 - Math.abs(lane.power - SWEET.power) * 1.5);
      const n = lane.standing.length;
      const k = Math.max(0, Math.min(n, Math.round(n * q + (api.rng() - 0.5) * 2)));
      // The pins nearest the ball's line go first.
      const line = lane.aim * 1.2;
      const order = lane.standing.slice().sort((a, b) => Math.abs(PINS[a].x - line) - Math.abs(PINS[b].x - line));
      const down = new Set(order.slice(0, k));
      lane.standing = lane.standing.filter((i) => !down.has(i));
      lane.knocked.push(k);
    }

    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'bowl' || (slot !== 0 && slot !== 1)) return;
        const lane = lanes[slot];
        if (lane.stage !== 'ready' || !Number.isFinite(input.aim) || !Number.isFinite(input.power)) return;
        lane.aim = Math.round(Math.max(-1, Math.min(1, input.aim)) * 1000) / 1000;
        lane.power = Math.round(clamp01(input.power) * 1000) / 1000;
        knock(lane);
        lane.stage = 'rolling';
        lane.since = api.elapsed();
        api.setTimeout(() => {
          if (lane.roll === 1) {
            lane.roll = 2;
            lane.stage = 'ready';
            lane.aim = lane.power = null;
            return api.update();
          }
          lane.stage = 'done';
          if (lanes.every((l) => l.stage === 'done')) return result();
          api.update();
        }, ROLL_MS);
        api.update();
      },
      onTimeUp: result,
      view: () => ({ lanes, pins: PINS }),
    };
  },
};
