// Balloon Pump: mash to pump up your balloon; first to pop it (40 pumps) wins.
export const NEED = 40;
export const MIN_GAP_MS = 40; // faster than this is a bot (or a bounce): ignored

export default {
  id: 'balloon', kind: 'party', look: '2d', name: 'Balloon Pump', order: 'PUMP IT!', howTo: 'Mash PUMP (or A) to pop your balloon first', durationMs: 30000,
  create(api) {
    const pumps = [0, 0];
    const lastAt = [-Infinity, -Infinity];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pump' || (slot !== 0 && slot !== 1)) return;
        const now = api.now();
        if (now - lastAt[slot] < MIN_GAP_MS) return;
        lastAt[slot] = now;
        pumps[slot]++;
        if (pumps[slot] >= NEED) api.end({ winner: slot });
        else api.update();
      },
      onTimeUp: () => api.end({ winner: pumps[0] === pumps[1] ? null : pumps[0] > pumps[1] ? 0 : 1 }),
      view: () => ({ pumps, need: NEED }),
    };
  },
};
