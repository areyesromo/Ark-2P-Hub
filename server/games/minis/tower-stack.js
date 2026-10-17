// Tower Stack (3D on the TV): a block swings over your tower; drop it. Only
// the part over the tower stays, so it gets narrower. Miss completely and
// your tower is finished. Tallest tower wins.
import { plausibleT } from './runner.js';

export const SWING = { amp: 1.2, period: 1600 };
export const PERFECT = 0.03; // this close snaps on, full width
export const NEXT_MS = 400;

/** The swinging block's x, `ms` after it appeared. Copied in public/games/minis/tower-stack.js. */
export function swingAt(ms, swing) {
  return swing.amp * Math.sin((2 * Math.PI * ms) / swing.period);
}

export default {
  id: 'tower-stack', kind: 'party', look: '3d', name: 'Tower Stack', order: 'STACK IT!', howTo: 'Tap (or A) to drop the swinging block on your tower', durationMs: 35000,
  create(api) {
    const towers = [[{ x: 0, w: 1 }], [{ x: 0, w: 1 }]];
    const blockStart = [0, 0];
    const out = [false, false];
    const h = (s) => towers[s].length;
    const result = () => api.end({ winner: h(0) === h(1) ? null : h(0) > h(1) ? 0 : 1 });

    function check() {
      if (out[0] && out[1]) return result();
      for (const s of [0, 1]) if (out[s] && h(1 - s) > h(s)) return api.end({ winner: 1 - s });
      api.update();
    }

    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'drop' || (slot !== 0 && slot !== 1) || out[slot]) return;
        const t = plausibleT(input.t, api.elapsed());
        if (t < blockStart[slot]) return;
        const x = swingAt(t - blockStart[slot], SWING);
        const top = towers[slot][towers[slot].length - 1];
        const dx = x - top.x;
        if (Math.abs(dx) <= PERFECT) towers[slot].push({ x: top.x, w: top.w });
        else if (top.w - Math.abs(dx) <= 0) out[slot] = true;
        else towers[slot].push({ x: Math.round(((x + top.x) / 2) * 1000) / 1000, w: Math.round((top.w - Math.abs(dx)) * 1000) / 1000 });
        blockStart[slot] = t + NEXT_MS;
        check();
      },
      onTimeUp: result,
      view: () => ({ towers, blockStart, out, swing: SWING }),
    };
  },
};
