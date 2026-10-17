// Penalty Shootout (3D on the TV): take turns as kicker and keeper. Both
// pick a side in secret: different sides is a goal, the same is a save.
// Five kicks each; it stops early once one side can't be caught.
export const TIMING = { pickMs: 5000, showMs: 2500 };
export const KICKS = 5;

export default {
  id: 'penalty', kind: 'party', look: '3d', name: 'Penalty Shootout', order: 'SHOOT!', howTo: 'Kicker: pick a corner. Keeper: pick where to dive', durationMs: 80000,
  create(api) {
    let kick = 0;
    let stage = 'pick';
    let picks = [null, null];
    let last = null;
    let timer = null;
    const goals = [0, 0];
    const taken = [0, 0];
    const kicker = () => (kick ? (kick - 1) % 2 : 0); // before the first kick (the intro card): player 1 is up

    function newKick() {
      kick++;
      stage = 'pick';
      picks = [null, null];
      timer = api.setTimeout(resolve, TIMING.pickMs);
      api.update();
    }

    function resolve() {
      api.clearTimeout(timer);
      const k = kicker();
      const shot = picks[k];
      const dive = picks[1 - k] === null ? 1 : picks[1 - k];
      const goal = shot !== null && shot !== dive;
      if (goal) goals[k]++;
      taken[k]++;
      last = { kicker: k, shot, dive, goal };
      stage = 'show';
      for (const s of [0, 1]) if (goals[s] + (KICKS - taken[s]) < goals[1 - s]) return api.end({ winner: 1 - s });
      if (taken[0] === KICKS && taken[1] === KICKS) return api.end({ winner: goals[0] === goals[1] ? null : goals[0] > goals[1] ? 0 : 1 });
      timer = api.setTimeout(newKick, TIMING.showMs);
      api.update();
    }

    return {
      start: newKick,
      onInput(slot, input) {
        if (input.type !== 'pick' || stage !== 'pick' || (slot !== 0 && slot !== 1) || picks[slot] !== null) return;
        if (![0, 1, 2].includes(input.side)) return;
        picks[slot] = input.side;
        if (picks[0] !== null && picks[1] !== null) resolve();
        else api.update();
      },
      onTimeUp: () => api.end({ winner: goals[0] === goals[1] ? null : goals[0] > goals[1] ? 0 : 1 }),
      view: (slot) => ({
        kick, kicker: kicker(), stage, kicks: KICKS,
        picked: picks.map((p) => p !== null),
        mine: slot === 0 || slot === 1 ? picks[slot] : null,
        last, goals, taken,
      }),
    };
  },
};
