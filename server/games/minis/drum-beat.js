// Drum Beat: notes fall down three lanes to a beat; hit each lane as its note crosses the line.
// Both of you play the same chart side by side. Dead on is perfect (3), a little off is good (1),
// a wrong lane or a note let past breaks your streak; every ten in a row adds one to each hit.
// The higher score once the chart's played wins.
import { plausibleT } from './runner.js';

export const LANES = 3;
export const WINDOWS = { perfect: 60, good: 130 }; // ms either side of the note
export const POINTS = { perfect: 3, good: 1 };
export const STEP_MS = 150; // notes fall on this grid ...
export const FIRST_MS = 2200; // ... from here ...
export const LAST_MS = 24000; // ... to here
const TAIL_MS = 1500; // after the last note, then the result

export default {
  id: 'drum-beat', kind: 'party', look: '2d', name: 'Drum Beat', order: 'HIT THE BEAT!', howTo: 'Tap a lane as its note hits the line (controller: X / A / B or ← ↓ →)', durationMs: 30000,
  create(api) {
    // The chart: a note every 2-4 steps, now and then the same lane twice, never too fast to read.
    const chart = [];
    let t = FIRST_MS;
    let lane = 1;
    while (t <= LAST_MS) {
      chart.push({ t, lane });
      t += STEP_MS * (2 + Math.floor(api.rng() * 3));
      if (api.rng() < 0.75) lane = (lane + 1 + Math.floor(api.rng() * (LANES - 1))) % LANES;
    }
    const hit = [new Set(), new Set()]; // note indexes each has hit
    const passed = [0, 0]; // notes checked for a miss (in order)
    const score = [0, 0];
    const combo = [0, 0];
    const best = [0, 0];
    const last = [null, null];
    let timer = null;
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      api.end({ winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1 });
    }

    /** Notes gone past the line unhit (by `now`) break the streak. */
    function sweep(slot, now) {
      while (passed[slot] < chart.length && chart[passed[slot]].t + WINDOWS.good < now) {
        if (!hit[slot].has(passed[slot])) combo[slot] = 0;
        passed[slot]++;
      }
    }

    return {
      start() {
        timer = api.setTimeout(finish, chart[chart.length - 1].t + TAIL_MS);
      },
      onInput(slot, input) {
        if (done || input.type !== 'hit' || (slot !== 0 && slot !== 1)) return;
        if (!Number.isInteger(input.lane) || input.lane < 0 || input.lane >= LANES) return;
        const at = plausibleT(input.t, api.elapsed());
        sweep(slot, at);
        // The nearest note in that lane, not yet hit, near enough.
        let best1 = -1;
        let off = Infinity;
        for (let i = 0; i < chart.length; i++) {
          const n = chart[i];
          if (n.lane !== input.lane || hit[slot].has(i)) continue;
          const d = Math.abs(n.t - at);
          if (d < off) {
            off = d;
            best1 = i;
          }
          if (n.t > at + WINDOWS.good) break;
        }
        if (best1 === -1 || off > WINDOWS.good) {
          last[slot] = 'miss';
          combo[slot] = 0;
        } else {
          const grade = off <= WINDOWS.perfect ? 'perfect' : 'good';
          hit[slot].add(best1);
          combo[slot]++;
          best[slot] = Math.max(best[slot], combo[slot]);
          score[slot] += POINTS[grade] + Math.floor(combo[slot] / 10);
          last[slot] = grade;
        }
        api.update();
      },
      onTimeUp: finish,
      view: () => ({
        lanes: LANES, chart, windows: WINDOWS, score, combo, best, last,
        hits: hit.map((s) => [...s]),
      }),
    };
  },
};
