// Cup Stack: speed stacking. Each of you builds a pyramid of cups, then brings it back down, three
// times over (3 cups, then 6, then 10). Every cup is a tap with the hand the strip shows, LEFT or
// RIGHT. The wrong hand fumbles: the cups clatter and you lose a moment putting them right. First to
// finish wins; at time up, the one further along (the same: level).

export const STACKS = [3, 6, 10];
export const FUMBLE_MS = 800; // wrong hand: no taps for this long
export const SAME_HAND = 0.35; // how often the next cup is the same hand again (else the other)
const DURATION_MS = 40000;

/** Where each pyramid's build and unstack begin and end, as steps: [{ size, from, peak, to }]. */
export function segments(stacks = STACKS) {
  let at = 0;
  return stacks.map((size) => {
    const seg = { size, from: at, peak: at + size, to: at + size * 2 };
    at = seg.to;
    return seg;
  });
}

export const TOTAL = segments().at(-1).to;

export default {
  id: 'cup-stack', kind: 'party', look: '2d', name: 'Cup Stack', order: 'STACK IT!', howTo: 'Tap LEFT or RIGHT as the strip shows: build each pyramid, then take it down. Wrong hand fumbles', durationMs: DURATION_MS,
  create(api) {
    // One pattern for both of you, so it's fair.
    let hand = api.rng() < 0.5 ? 'L' : 'R';
    let seq = '';
    for (let i = 0; i < TOTAL; i++) {
      seq += hand;
      if (api.rng() >= SAME_HAND) hand = hand === 'L' ? 'R' : 'L';
    }
    const step = [0, 0];
    const lockUntil = [0, 0];
    const fumbles = [0, 0];
    const doneAt = [null, null];
    const last = [null, null];
    let n = 0;

    return {
      start() { api.update(); },
      onInput(slot, input) {
        if ((slot !== 0 && slot !== 1) || input.type !== 'tap' || (input.hand !== 'L' && input.hand !== 'R')) return;
        const now = api.elapsed();
        if (doneAt[slot] !== null || now < lockUntil[slot]) return;
        if (input.hand !== seq[step[slot]]) {
          fumbles[slot]++;
          lockUntil[slot] = now + FUMBLE_MS;
          last[slot] = { n: ++n, kind: 'fumble' };
          return api.update();
        }
        step[slot]++;
        const seg = segments().find((g) => g.peak === step[slot] || g.to === step[slot]);
        last[slot] = { n: ++n, kind: seg ? (seg.peak === step[slot] ? 'built' : 'down') : 'cup' };
        if (step[slot] >= TOTAL) {
          doneAt[slot] = now;
          last[slot].kind = 'done';
          api.update();
          return api.end({ winner: slot });
        }
        api.update();
      },
      onTimeUp: () => api.end({ winner: step[0] === step[1] ? null : step[0] > step[1] ? 0 : 1 }),
      view: () => ({
        seq, stacks: STACKS, total: TOTAL, fumbleMs: FUMBLE_MS,
        elapsed: api.elapsed(),
        step: step.slice(), lockUntil: lockUntil.slice(), fumbles: fumbles.slice(), doneAt: doneAt.slice(), last: last.slice(),
      }),
    };
  },
};
