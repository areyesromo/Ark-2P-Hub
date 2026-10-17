// Memory Path: watch the tiles light up, then repeat the path. It grows by one
// each round; the first to slip (or take over 10 s) loses.
export const TIMING = { stepMs: 600, pauseMs: 400, inputMs: 10000 };
export const START_LENGTH = 3;

export default {
  id: 'memory-path', kind: 'party', name: 'Memory Path', order: 'REMEMBER!', howTo: 'Watch the path, then tap it back in order', durationMs: 30000,
  create(api) {
    const cell = () => Math.floor(api.rng() * 9);
    const seq = Array.from({ length: START_LENGTH - 1 }, cell);
    let stage = 'show';
    let step = [0, 0];
    let out = [false, false];
    let finished = [false, false];
    let deadline = null;

    function round() {
      seq.push(cell());
      stage = 'show';
      step = [0, 0];
      finished = [false, false];
      api.setTimeout(() => {
        stage = 'input';
        deadline = api.setTimeout(() => {
          for (const s of [0, 1]) if (!finished[s]) out[s] = true;
          check();
        }, TIMING.inputMs);
        api.update();
      }, seq.length * TIMING.stepMs + TIMING.pauseMs);
      api.update();
    }

    function check() {
      if (![0, 1].every((s) => out[s] || finished[s])) return api.update();
      api.clearTimeout(deadline);
      if (out[0] && out[1]) return api.end({ winner: null });
      if (out[0] || out[1]) return api.end({ winner: out[0] ? 1 : 0 });
      round();
    }

    return {
      start: round,
      onInput(slot, input) {
        if (input.type !== 'cell' || stage !== 'input' || (slot !== 0 && slot !== 1) || out[slot] || finished[slot]) return;
        if (input.i !== seq[step[slot]]) out[slot] = true;
        else if (++step[slot] === seq.length) finished[slot] = true;
        check();
      },
      // Time's up: the one further along wins (out < partway < done).
      onTimeUp() {
        const far = (s) => (out[s] ? -1 : finished[s] ? seq.length : stage === 'input' ? step[s] : 0);
        api.end({ winner: far(0) === far(1) ? null : far(0) > far(1) ? 0 : 1 });
      },
      view: () => Object.assign({ stage, step, out, finished, length: seq.length }, stage === 'show' ? { seq } : {}),
    };
  },
};
