// LIGHTS OUT! Five lights go out one by one: tap the moment the last one goes. Before it, you
// jumped the start; too slow, you missed it.
import { verdicts } from './common.js';
import { plausibleT, lagFor } from './runner.js';

export const LIGHTS = 5;

/** How many lights are still on `t` ms in (off[] is when each goes out). */
export function lightsOn(off, t) {
  return off.filter((at) => t < at).length;
}

export default {
  id: 'lights-out', kind: 'micro', name: 'Lights out!', order: 'LIGHTS OUT!', howTo: 'Tap the moment the last light goes out', durationMs: 5500,
  create(api) {
    const v = verdicts(api);
    // A light out every 0.35 to 0.75 s (uneven, so it can't be counted), the first after 0.8 s.
    const off = [];
    let t = 800 * api.speed;
    for (let i = 0; i < LIGHTS; i++) {
      t += (350 + api.rng() * 400) * api.speed;
      off.push(Math.round(t));
    }
    const last = off[LIGHTS - 1];
    const windowMs = Math.round(650 * api.speed); // (a quick tap after the last goes: a reaction)
    const taps = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'tap' || !v.open(slot)) return;
        // (judged when it was pressed, less the time a press takes to get here)
        const at = Math.round(plausibleT(input.t, api.elapsed()) - (typeof input.t === 'number' ? 0 : lagFor(api.players[slot])));
        taps[slot] = at - last;
        v.decide(slot, at >= last && at <= last + windowMs);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ off, windowMs, taps, res: v.res }),
    };
  },
};
