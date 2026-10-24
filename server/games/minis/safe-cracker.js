// Safe Cracker: a dial of 40 numbers and a 3-number combination each. Turn the dial; on your next
// number it clicks (the phone buzzes, the lock light flickers), then TRY locks it in. A wrong TRY
// jams the dial for a moment. First to open their safe wins; at time up, more numbers opened.
// The two safes are equally hard (your dial starts FIRST_AWAY from your first number, and the
// three numbers take TRAVEL turns in all) but spaced their own way, so watching your rival's
// lock light tells you nothing about yours.
export const DIAL = 40;
export const WRONG_MS = 800;
export const FIRST_AWAY = 10;
export const TRAVEL = 30; // turns from the first number to the second, plus the second to the third
const MAX_TURN = 10; // one turn input: up to this many numbers either way

export default {
  id: 'safe-cracker', kind: 'party', look: '2d', name: 'Safe Cracker', order: 'CRACK THE SAFE!', howTo: 'Turn the dial (← → on a controller); when it clicks, TRY (A)', durationMs: 40000,
  create(api) {
    const wrap = (n) => ((n % DIAL) + DIAL) % DIAL;
    const side = () => (api.rng() < 0.5 ? -1 : 1);
    // Each safe: a first number anywhere, the dial FIRST_AWAY from it, then two gaps (10-20 turns
    // each, either way) that add up to TRAVEL.
    const safes = [];
    const combos = [0, 1].map(() => {
      const first = Math.floor(api.rng() * DIAL);
      const gap = 10 + Math.floor(api.rng() * 11);
      const second = wrap(first + side() * gap);
      safes.push({ dial: wrap(first + side() * FIRST_AWAY), opened: 0, jamUntil: -Infinity, timer: null });
      return [first, second, wrap(second + side() * (TRAVEL - gap))];
    });
    let done = false;

    const click = (slot) => safes[slot].opened < 3 && safes[slot].dial === combos[slot][safes[slot].opened];
    const end = (winner) => {
      done = true;
      api.end({ winner });
    };

    return {
      start() {},
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1)) return;
        const s = safes[slot];
        const now = api.elapsed();
        if (now < s.jamUntil) return; // jammed after a wrong try
        if (input.type === 'turn') {
          const by = input.by;
          if (!Number.isInteger(by) || by === 0 || Math.abs(by) > MAX_TURN) return;
          s.dial = (((s.dial + by) % DIAL) + DIAL) % DIAL;
        } else if (input.type === 'try') {
          if (click(slot)) {
            s.opened++;
            if (s.opened === 3) return end(slot);
          } else {
            s.jamUntil = now + WRONG_MS;
            // Tell the screens when the jam is over.
            api.clearTimeout(s.timer);
            s.timer = api.setTimeout(api.update, WRONG_MS);
          }
        } else {
          return;
        }
        api.update();
      },
      /** Tests only. */
      debugCombo: (slot) => combos[slot].slice(),
      onTimeUp() {
        const [a, b] = safes;
        end(a.opened === b.opened ? null : a.opened > b.opened ? 0 : 1);
      },
      // Each safe's dial, how far it's open and whether it's clicking: the TV shows both (a
      // controller player has no phone), which gives nothing away as the combinations differ.
      // A phone also gets its own safe at the top level.
      view: (slot) => {
        const now = api.elapsed();
        const safe = (i) => ({ dial: safes[i].dial, opened: safes[i].opened, click: click(i), locked: now < safes[i].jamUntil });
        return { dialSize: DIAL, safes: [safe(0), safe(1)], ...(slot === 0 || slot === 1 ? safe(slot) : {}) };
      },
    };
  },
};
