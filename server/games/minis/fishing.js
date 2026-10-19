// Fishing: each of you fishes on your own line. Wait for the bite, then HOOK within a second
// (too early scares the fish away). Then REEL: every tap pulls the fish in but adds tension,
// which eases off between taps; too much and the line snaps. Most fish wins.
export const BITE = { minMs: 1500, maxMs: 4500, windowMs: 1000 };
export const SCARE_MS = 1200; // hooking too early: the fish swims off, wait again after this
export const REEL = { pull: 0.07, tension: 0.13, ease: 0.55, escape: 0.06 }; // per tap / per second
export const SNAP = 1; // tension at which the line breaks
export const SNAP_MS = 1000; // re-tying the line
const DURATION_MS = 30000;

export default {
  id: 'fishing', kind: 'party', look: '2d', name: 'Fishing', order: 'GO FISH!', howTo: 'Wait for the bite, HOOK it (jerk the phone up, or tap), then REEL (wind the phone round, or tap) without snapping the line', durationMs: DURATION_MS,
  create(api) {
    // stage: 'wait' (line in the water), 'bite' (hook now!), 'reel', 'scared', 'snapped', 'caught'
    const lines = [0, 1].map(() => ({ stage: 'wait', since: 0, biteAt: 0, progress: 0, tension: 0, fish: 0, timer: null, tick: 0 }));

    function cast(slot, delay) {
      const L = lines[slot];
      L.stage = 'wait';
      L.progress = 0;
      L.tension = 0;
      api.clearTimeout(L.timer);
      L.timer = api.setTimeout(() => bite(slot), (delay || 0) + BITE.minMs + api.rng() * (BITE.maxMs - BITE.minMs));
    }

    function bite(slot) {
      const L = lines[slot];
      L.stage = 'bite';
      L.timer = api.setTimeout(() => cast(slot), BITE.windowMs); // missed it: the fish swims off
      api.update();
    }

    function pause(slot, stage, ms) {
      const L = lines[slot];
      api.clearTimeout(L.timer);
      L.stage = stage;
      L.progress = 0;
      L.tension = 0;
      L.timer = api.setTimeout(() => { cast(slot); api.update(); }, ms);
    }

    // Reeling: tension eases and the fish fights back a little, ten times a second.
    function tick() {
      lines.forEach((L) => {
        if (L.stage !== 'reel') return;
        L.tension = Math.max(0, L.tension - REEL.ease / 10);
        L.progress = Math.max(0, L.progress - REEL.escape / 10);
      });
      api.update();
      api.setTimeout(tick, 100);
    }

    return {
      start() {
        cast(0);
        cast(1);
        api.setTimeout(tick, 100);
      },
      onInput(slot, input) {
        if (input.type !== 'tap' || (slot !== 0 && slot !== 1)) return;
        const L = lines[slot];
        if (L.stage === 'wait') {
          pause(slot, 'scared', SCARE_MS); // too early: the fish swims off
          return api.update();
        }
        if (L.stage === 'bite') {
          api.clearTimeout(L.timer);
          L.stage = 'reel';
          L.progress = 0.1;
          L.tension = 0.2;
          return api.update();
        }
        if (L.stage !== 'reel') return;
        L.progress = Math.min(1, L.progress + REEL.pull);
        L.tension += REEL.tension;
        if (L.tension >= SNAP) pause(slot, 'snapped', SNAP_MS);
        else if (L.progress >= 1) {
          L.fish++;
          pause(slot, 'caught', 900);
        }
        api.update();
      },
      onTimeUp: () => {
        const [a, b] = lines.map((L) => L.fish);
        api.end({ winner: a === b ? null : a > b ? 0 : 1 });
      },
      view: () => ({
        lines: lines.map((L) => ({ stage: L.stage, progress: Math.round(L.progress * 100) / 100, tension: Math.round(Math.min(1, L.tension) * 100) / 100, fish: L.fish })),
      }),
    };
  },
};
