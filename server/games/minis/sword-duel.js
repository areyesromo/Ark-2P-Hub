// Sword Duel (phones only): an arrow flashes up on the TV after a tense wait. Slash your phone
// that way (or swipe the screen) first to win the point. Slash before the arrow, or the wrong
// way, and you're out of that point. First to 3, or most points when time runs out.
export const WIN = 3;
export const DIRS = ['up', 'down', 'left', 'right'];
export const TIMING = { waitMinMs: 1200, waitMaxMs: 3500, showMs: 1800, pauseMs: 1300 };
const DURATION_MS = 40000;

export default {
  id: 'sword-duel', kind: 'party', look: '2d', phoneOnly: true, name: 'Sword Duel', order: 'EN GARDE!', howTo: 'When the arrow shows, slash your phone that way (or swipe). Too soon or the wrong way: out of that point', durationMs: DURATION_MS,
  create(api) {
    const points = [0, 0];
    // stage: 'wait' (hold still…), 'go' (slash!), 'point' (who won it)
    let stage = 'wait';
    let dir = null;
    let out = [false, false]; // slashed too soon or the wrong way this point
    let last = null; // { winner: 0 | 1 | null, why: 'fast' | 'foul' | 'wrong' | 'slow', by }
    let n = 0;
    let timer = null;

    function nextPoint() {
      n++;
      stage = 'wait';
      dir = null;
      out = [false, false];
      api.update();
      timer = api.setTimeout(() => {
        stage = 'go';
        dir = DIRS[Math.floor(api.rng() * DIRS.length)];
        api.update();
        timer = api.setTimeout(() => settle(null, 'slow'), TIMING.showMs);
      }, TIMING.waitMinMs + api.rng() * (TIMING.waitMaxMs - TIMING.waitMinMs));
    }

    function settle(winner, why, by) {
      api.clearTimeout(timer);
      if (winner !== null) points[winner]++;
      last = { winner, why, by: by === undefined ? null : by, n };
      stage = 'point';
      api.update();
      if (winner !== null && points[winner] >= WIN) return api.end({ winner });
      timer = api.setTimeout(nextPoint, TIMING.pauseMs);
    }

    return {
      start() { nextPoint(); },
      onInput(slot, input) {
        if (input.type !== 'slash' || (slot !== 0 && slot !== 1) || !DIRS.includes(input.dir) || out[slot]) return;
        if (stage === 'wait') {
          // Jumped the gun: the other player takes the point.
          out[slot] = true;
          return settle(1 - slot, 'foul', slot);
        }
        if (stage !== 'go') return;
        if (input.dir === dir) return settle(slot, 'fast', slot);
        out[slot] = true;
        if (out[0] && out[1]) return settle(null, 'wrong');
        api.update();
      },
      onTimeUp: () => api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 }),
      view: () => ({ stage, dir: stage === 'wait' ? null : dir, points, out, last, n, win: WIN }),
    };
  },
};
