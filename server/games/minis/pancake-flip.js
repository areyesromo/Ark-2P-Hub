// Pancake Flip: each of you cooks pancakes in your own pan. FLIP when it's golden (the meter's
// green: too soon and it's raw and splats, wait too long and it burns), then it spins in the air:
// CATCH it flat. A flat catch stacks neatly; a crooked one stacks but the stack wobbles (three
// wobbles and half the stack falls off); a bad catch drops it. Every pancake on your stack makes
// the next one spin faster. The tallest stack at time up wins (the same height: more golden ones).
import { plausibleT } from './runner.js';

export const COOK_MS = 2600; // empty pan to burnt
export const RAW = 0.3; // flipped before this much of COOK_MS: raw, it splats
export const GOLDEN = [0.55, 0.8]; // the meter's green band
export const AIR_MS = 1300; // in the air, to catch
export const RISE_MS = 450; // still going up: no catching it yet
export const SPIN = [540, 45]; // degrees a second, plus this much a pancake already on the stack
export const FLAT_DEG = 20; // this close to flat: a neat catch
export const OK_DEG = 50; // this close: crooked; further: dropped
export const WOBBLES = 3; // crooked catches before half the stack falls
export const NEXT_MS = 350; // a fresh pancake in the pan after the last one
const DURATION_MS = 45000;

/** The pancake's angle from flat (0 to 90) `ms` after it was flipped, at `spin` degrees a second. */
export function tiltAt(ms, spin) {
  const a = ((spin * ms) / 1000) % 180;
  return Math.min(a, 180 - a);
}

export const spinFor = (height) => SPIN[0] + SPIN[1] * height;

export default {
  id: 'pancake-flip', kind: 'party', look: '2d', name: 'Pancake Flip', order: 'FLIP AND CATCH!', howTo: 'FLIP when the meter is green, then CATCH it flat. Tallest stack wins', durationMs: DURATION_MS,
  create(api) {
    let n = 0;
    const pans = [0, 1].map(() => ({ stage: 'cook', cookAt: 300, airAt: 0, spin: SPIN[0], golden: false, stack: [], wobble: 0, last: null }));
    const timers = [null, null];

    function arm(slot, at, fn) {
      if (timers[slot]) api.clearTimeout(timers[slot]);
      timers[slot] = api.setTimeout(fn, Math.max(0, at - api.elapsed()));
    }

    function event(p, kind) {
      p.last = { n: ++n, kind };
    }

    /** A fresh pancake in the pan (it burns if left). */
    function cook(slot, at) {
      const p = pans[slot];
      p.stage = 'cook';
      p.cookAt = at;
      arm(slot, at + COOK_MS, () => {
        if (p.stage !== 'cook') return;
        event(p, 'burnt');
        cook(slot, api.elapsed() + NEXT_MS);
        api.update();
      });
    }

    function land(slot, tilt) {
      const p = pans[slot];
      if (tilt === null || tilt > OK_DEG) {
        event(p, tilt === null ? 'drop' : 'miss');
      } else {
        p.stack.push(p.golden);
        if (tilt > FLAT_DEG) {
          p.wobble++;
          event(p, 'crooked');
          if (p.wobble >= WOBBLES) {
            p.stack = p.stack.slice(0, Math.floor(p.stack.length / 2));
            p.wobble = 0;
            event(p, 'topple');
          }
        } else {
          event(p, 'flat');
        }
      }
      cook(slot, api.elapsed() + NEXT_MS);
      api.update();
    }

    return {
      start() {
        cook(0, 300);
        cook(1, 300);
        api.update();
      },
      onInput(slot, input) {
        if (slot !== 0 && slot !== 1) return;
        const p = pans[slot];
        const now = api.elapsed();
        const at = plausibleT(input.t, now);
        if (input.type === 'flip' && p.stage === 'cook') {
          const done = (at - p.cookAt) / COOK_MS;
          if (done < 0) return; // (the pan's still empty)
          if (done < RAW) {
            event(p, 'raw');
            cook(slot, now + NEXT_MS);
            return api.update();
          }
          if (done >= 1) return; // (it's burnt: the timer takes it)
          p.golden = done >= GOLDEN[0] && done <= GOLDEN[1];
          p.stage = 'air';
          p.airAt = at;
          p.spin = spinFor(p.stack.length);
          arm(slot, at + AIR_MS, () => { if (p.stage === 'air') land(slot, null); });
          event(p, p.golden ? 'golden' : 'flip');
          return api.update();
        }
        if (input.type === 'catch' && p.stage === 'air') {
          const ms = Math.min(AIR_MS, Math.max(0, at - p.airAt));
          if (ms < RISE_MS) return;
          return land(slot, tiltAt(ms, p.spin));
        }
      },
      // The tallest stack; the same height, more golden ones.
      onTimeUp: () => {
        const score = (p) => p.stack.length * 100 + p.stack.filter(Boolean).length;
        const [a, b] = pans.map(score);
        api.end({ winner: a === b ? null : a > b ? 0 : 1 });
      },
      view: () => ({
        cookMs: COOK_MS, raw: RAW, goldenBand: GOLDEN, airMs: AIR_MS, riseMs: RISE_MS, flatDeg: FLAT_DEG, okDeg: OK_DEG, wobbles: WOBBLES,
        elapsed: api.elapsed(),
        pans: pans.map((p) => ({ stage: p.stage, cookAt: p.cookAt, airAt: p.airAt, spin: p.spin, stack: p.stack, wobble: p.wobble, last: p.last })),
      }),
    };
  },
};
