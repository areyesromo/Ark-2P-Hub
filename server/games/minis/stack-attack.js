// Stack Attack: crates drop into each half, the same ones in the same places for both of you.
// Slide your tray under them to catch them; caught crates stack up. Catch one off-centre and the
// stack leans that way (catch one on the other side to straighten it); lean it too far and the
// whole stack topples and you start again. The taller stack at time up wins.
export const TICK_MS = 50;
export const SPEED = 1.2; // half widths a second
export const TRAY_HALF = 0.13;
export const CRATE_HALF = 0.05;
export const CATCH = TRAY_HALF + CRATE_HALF; // the crate's centre this far from the tray's: caught
export const LEAN_PER = 0.4; // lean from a catch right on the edge; 1 topples it
export const GAP_MS = [1100, 650]; // between crates, from the start to the end
export const FALL_MS = [2000, 1300]; // top to tray, from the start to the end
const DURATION_MS = 30000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (range, k) => Math.round(range[0] + (range[1] - range[0]) * Math.min(1, k));

export default {
  id: 'stack-attack', kind: 'party', look: '2d', name: 'Stack Attack', order: 'STACK THEM UP!', howTo: 'Slide your tray (joystick / tilt / stick) to catch the crates. Catch them in the middle or the stack leans and topples!', durationMs: DURATION_MS,
  create(api) {
    // Every crate, one list for both, in minigame time: { id, x, at (when it starts to fall), fall }.
    const crates = [];
    for (let at = 600, id = 1; at < DURATION_MS - 1000; id++) {
      const k = at / DURATION_MS;
      crates.push({ id, x: Math.round((TRAY_HALF + api.rng() * (1 - 2 * TRAY_HALF)) * 1000) / 1000, at, fall: lerp(FALL_MS, k) });
      at += lerp(GAP_MS, k);
    }
    let next = 0; // the first crate that hasn't landed yet
    const trays = [0, 1].map(() => ({ x: 0.5, v: 0 }));
    const stacks = [0, 1].map(() => ({ height: 0, lean: 0, topples: 0 }));
    const events = [null, null]; // each player's latest catch / topple: { n, kind }
    let n = 0;
    let done = false;
    let shown = '';

    function land(c) {
      trays.forEach((t, slot) => {
        const d = c.x - t.x;
        if (Math.abs(d) > CATCH) return;
        const s = stacks[slot];
        s.height++;
        s.lean += (d / CATCH) * LEAN_PER;
        if (Math.abs(s.lean) >= 1) {
          s.height = 0;
          s.lean = 0;
          s.topples++;
          events[slot] = { n: ++n, kind: 'topple' };
        } else {
          events[slot] = { n: ++n, kind: 'catch' };
        }
      });
    }

    function tick() {
      if (done) return;
      const now = api.elapsed();
      const step = (SPEED * TICK_MS) / 1000;
      trays.forEach((t) => { t.x = clamp(t.x + t.v * step, TRAY_HALF, 1 - TRAY_HALF); });
      while (next < crates.length && now >= crates[next].at + crates[next].fall) land(crates[next++]);
      // Sent when the trays, the crates in the air or the stacks change; the screens animate the falling.
      const v = view();
      const key = JSON.stringify([v.trays, v.crates.map((c) => c.id), v.stacks, events]);
      if (key !== shown) {
        shown = key;
        api.update();
      }
      api.setTimeout(tick, TICK_MS);
    }

    function view() {
      const now = api.elapsed();
      return {
        trayHalf: TRAY_HALF, crateHalf: CRATE_HALF,
        trays: trays.map((t) => ({ x: Math.round(t.x * 1000) / 1000 })),
        crates: crates.slice(next).filter((c) => now >= c.at).map((c) => ({ id: c.id, x: c.x, fall: c.fall, left: c.at + c.fall - now })),
        stacks: stacks.map((s) => ({ height: s.height, lean: Math.round(s.lean * 1000) / 1000, topples: s.topples })),
        events,
      };
    }

    return {
      start() { api.setTimeout(tick, TICK_MS); },
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1) || input.type !== 'move') return;
        if (typeof input.x !== 'number' || !Number.isFinite(input.x)) return;
        trays[slot].v = clamp(input.x, -1, 1);
      },
      onTimeUp() {
        if (done) return;
        done = true;
        const [a, b] = stacks.map((s) => s.height);
        api.end({ winner: a === b ? null : a > b ? 0 : 1 });
      },
      /** Tests only: puts a tray at x. */
      debugTray: (slot, x) => { trays[slot].x = clamp(x, TRAY_HALF, 1 - TRAY_HALF); },
      view,
    };
  },
};
