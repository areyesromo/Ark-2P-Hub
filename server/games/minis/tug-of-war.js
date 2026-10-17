// Tug of War: tap on the beat to pull. A tap on the beat pulls hardest;
// mashing off-beat barely moves the rope. Drag the flag over your line.
import { plausibleT } from './runner.js';

export const BEAT_MS = 600;
export const PULL = { perfect: 0.08, good: 0.04, miss: 0.01 };
export const WINDOWS = { perfect: 80, good: 160 };
export const GAP_MS = 120; // faster than this is mashing: ignored

export default {
  id: 'tug-of-war', kind: 'party', look: '2d', name: 'Tug of War', order: 'PULL ON THE BEAT!', howTo: 'Tap (or A) on the beat: timing beats mashing', durationMs: 30000,
  create(api) {
    let rope = 0; // -1: over player 1's line (left), +1: over player 2's
    const lastAt = [-Infinity, -Infinity];
    const last = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'pull' || (slot !== 0 && slot !== 1)) return;
        const now = api.now();
        if (now - lastAt[slot] < GAP_MS) return;
        lastAt[slot] = now;
        const t = plausibleT(input.t, api.elapsed());
        const off = Math.min(t % BEAT_MS, BEAT_MS - (t % BEAT_MS));
        const grade = off <= WINDOWS.perfect ? 'perfect' : off <= WINDOWS.good ? 'good' : 'miss';
        last[slot] = grade;
        rope += (slot === 0 ? -1 : 1) * PULL[grade];
        if (rope <= -1) return api.end({ winner: 0 });
        if (rope >= 1) return api.end({ winner: 1 });
        api.update();
      },
      onTimeUp: () => api.end({ winner: Math.abs(rope) < 0.02 ? null : rope < 0 ? 0 : 1 }),
      view: () => ({ rope: Math.round(rope * 1e6) / 1e6, beatMs: BEAT_MS, last }),
    };
  },
};
