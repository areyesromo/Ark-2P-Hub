// Hot Potato: pass the bomb back before it blows. The fuse (8-20 s) is secret;
// a pass takes 0.6 s to land, and whoever has it (or is about to) at the bang loses.
export const FLIGHT_MS = 600;

export default {
  id: 'hot-potato', kind: 'party', name: 'Hot Potato', order: 'PASS IT!', howTo: 'Holding the bomb? Tap PASS (or A) to throw it back', durationMs: 25000,
  create(api) {
    let holder = api.rng() < 0.5 ? 0 : 1;
    let flying = false;
    let passes = 0;
    const inst = {
      fuseMs: 8000 + Math.floor(api.rng() * 12001),
      start() {
        api.setTimeout(() => api.end({ winner: 1 - (flying ? 1 - holder : holder) }), inst.fuseMs);
      },
      onInput(slot, input) {
        if (input.type !== 'pass' || slot !== holder || flying) return;
        flying = true;
        passes++;
        api.setTimeout(() => {
          holder = 1 - holder;
          flying = false;
          api.update();
        }, FLIGHT_MS);
        api.update();
      },
      view: () => ({ holder, flying, passes }),
    };
    return inst;
  },
};
