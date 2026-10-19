// Glass Bridge (3D on the TV): both of you cross the same bridge, row by row, picking the left
// or the right glass panel. One panel in each row is fake: step on it and it shatters, you fall
// and start again from the beginning. A shattered panel stays broken for both of you, so watch
// your rival. First across wins; at the end of time, whoever got furthest.
export const ROWS = 8;
export const FALL_MS = 1500; // falling and climbing back to the start
export const STEP_MS = 350; // a jump to the next row
const DURATION_MS = 40000;

export default {
  id: 'glass-bridge', kind: 'party', look: '3d', name: 'Glass Bridge', order: 'CROSS THE BRIDGE!', howTo: 'Pick ◀ left or right ▶ glass, row by row: one of each pair breaks', durationMs: DURATION_MS,
  create(api) {
    const safe = Array.from({ length: ROWS }, () => (api.rng() < 0.5 ? 0 : 1)); // the solid side of each row
    const broken = Array.from({ length: ROWS }, () => [false, false]);
    const solid = Array.from({ length: ROWS }, () => [false, false]); // stood on and held
    // row: the next row to step onto (0 = on the start platform, ROWS = across)
    const runners = [0, 1].map(() => ({ row: 0, side: null, falls: 0, busyUntil: 0, fell: null }));
    let finished = false;

    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pick' || (slot !== 0 && slot !== 1) || finished || (input.side !== 0 && input.side !== 1)) return;
        const r = runners[slot];
        const now = api.now();
        if (now < r.busyUntil || r.row >= ROWS) return;
        const row = r.row;
        if (broken[row][input.side]) return; // already gone: pick the other one
        r.busyUntil = now + STEP_MS;
        if (input.side === safe[row]) {
          solid[row][input.side] = true;
          r.row++;
          r.side = input.side;
          r.fell = null;
          if (r.row >= ROWS) {
            finished = true;
            return api.end({ winner: slot });
          }
        } else {
          broken[row][input.side] = true;
          r.falls++;
          r.fell = { row, side: input.side, at: now };
          r.row = 0;
          r.side = null;
          r.busyUntil = now + FALL_MS;
        }
        api.setTimeout(api.update, r.busyUntil - now + 1); // clear 'falling' / 'busy' on the screens
        api.update();
      },
      onTimeUp: () => {
        const [a, b] = runners.map((r) => r.row);
        api.end({ winner: a === b ? null : a > b ? 0 : 1 });
      },
      view: () => {
        const now = api.now();
        return {
          rows: ROWS,
          broken,
          solid,
          runners: runners.map((r) => ({ row: r.row, side: r.side, falls: r.falls, falling: r.fell && now - r.fell.at < FALL_MS ? r.fell : null, busy: now < r.busyUntil })),
        };
      },
    };
  },
};
