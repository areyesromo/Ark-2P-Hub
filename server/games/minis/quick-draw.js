// Quick Draw: wait for BANG!, then fire. Fire early and you lose the duel;
// the faster shot (by each phone's own clock) wins it. First to 2 duels.
import { plausibleT } from './runner.js';

export const TIMING = { waitMinMs: 2000, waitMaxMs: 6000, graceMs: 300, noShotMs: 3000, betweenMs: 1500 };

export default {
  id: 'quick-draw', kind: 'party', name: 'Quick Draw', order: 'WAIT FOR IT…', howTo: 'Fire (or A) on BANG! Too early loses', durationMs: 40000,
  create(api) {
    const duelWins = [0, 0];
    let duel = 0;
    let stage = 'wait';
    let bangAt = 0;
    let shots = [null, null];
    let last = null;
    let timers = [];
    const later = (fn, ms) => timers.push(api.setTimeout(fn, ms));
    const clear = () => {
      timers.forEach((t) => api.clearTimeout(t));
      timers = [];
    };

    function startDuel() {
      duel++;
      stage = 'wait';
      shots = [null, null];
      later(() => {
        stage = 'bang';
        bangAt = api.elapsed();
        later(decide, TIMING.noShotMs);
        api.update();
      }, TIMING.waitMinMs + Math.floor(api.rng() * (TIMING.waitMaxMs - TIMING.waitMinMs + 1)));
      api.update();
    }

    function decide() {
      const [a, b] = shots;
      const winner = a === null && b === null ? null : b === null || (a !== null && a <= b) ? 0 : 1;
      resolve(winner, null);
    }

    function resolve(winner, early) {
      clear();
      stage = 'done';
      if (winner !== null) duelWins[winner]++;
      last = { winner, ms: shots.slice(), early };
      if (duelWins.includes(2)) return api.end({ winner: duelWins[0] === 2 ? 0 : 1 });
      if (duel >= 3) return api.end({ winner: duelWins[0] === duelWins[1] ? null : duelWins[0] > duelWins[1] ? 0 : 1 });
      later(startDuel, TIMING.betweenMs);
      api.update();
    }

    return {
      start: startDuel,
      onInput(slot, input) {
        if (input.type !== 'fire' || (slot !== 0 && slot !== 1)) return;
        if (stage === 'wait') return resolve(1 - slot, slot);
        if (stage !== 'bang' || shots[slot] !== null) return;
        shots[slot] = Math.max(0, Math.round(plausibleT(input.t, api.elapsed()) - bangAt));
        if (shots[0] !== null && shots[1] !== null) return decide();
        clear();
        later(decide, TIMING.graceMs); // a slower network may still bring a faster shot
        api.update();
      },
      onTimeUp: () => api.end({ winner: duelWins[0] === duelWins[1] ? null : duelWins[0] > duelWins[1] ? 0 : 1 }),
      view: () => ({ duel, stage, duelWins, last }),
    };
  },
};
