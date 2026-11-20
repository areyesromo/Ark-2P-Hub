// DODGE BALL! Balls fly at you along three lanes: step up or down out of their way. Hit, you're out.
import { verdicts } from './common.js';
import { plausibleT, T_SLACK_MS } from './runner.js';

export const LANES = 3;
/** How long a ball takes to cross to you, ms (at speed 1). */
export const FLIGHT_MS = 1400;

/** The lane a player is in `t` ms in, from their moves ([{ t, lane }], in order; the middle to start). */
export function laneAt(moves, t) {
  let lane = 1;
  for (const m of moves) if (m.t <= t) lane = m.lane;
  return lane;
}

export default {
  id: 'dodge-ball', kind: 'micro', name: 'Dodge ball!', order: 'DODGE BALL!', howTo: 'Swipe up or down out of the way', durationMs: 5500,
  create(api) {
    const v = verdicts(api);
    const flightMs = Math.round(FLIGHT_MS * api.speed);
    // Three balls, each thrown 0.9 to 1.3 s after the last (the first after half a second), each
    // at a lane; the first one always at the middle, where you start.
    const balls = [];
    let thrown = 500 * api.speed;
    for (let i = 0; i < 3; i++) {
      const lane = i === 0 ? 1 : Math.floor(api.rng() * LANES);
      balls.push({ lane, at: Math.round(thrown), hit: Math.round(thrown + flightMs) });
      thrown += (900 + api.rng() * 400) * api.speed;
    }
    const moves = [[], []];
    return {
      start() {
        // Each ball is judged when it reaches you (with a moment's slack for a phone's late word).
        for (const b of balls) {
          api.setTimeout(() => {
            for (const slot of [0, 1]) if (v.open(slot) && laneAt(moves[slot], b.hit) === b.lane) v.decide(slot, false);
          }, b.hit + T_SLACK_MS);
        }
      },
      onInput(slot, input) {
        if (input.type !== 'move' || !v.open(slot) || (input.dir !== 'up' && input.dir !== 'down')) return;
        const at = plausibleT(input.t, api.elapsed());
        const was = laneAt(moves[slot], at);
        const lane = Math.max(0, Math.min(LANES - 1, was + (input.dir === 'up' ? -1 : 1)));
        if (lane === was) return;
        moves[slot].push({ t: Math.round(at), lane });
        moves[slot].sort((a, b) => a.t - b.t);
        api.update();
      },
      // Still standing at the end: passed.
      onTimeUp: () => v.timeUp(true),
      view: () => ({ balls, flightMs, lanes: moves.map((m) => laneAt(m, Number.MAX_SAFE_INTEGER)), res: v.res }),
    };
  },
};
