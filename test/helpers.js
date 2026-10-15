/** A game ctx with a manual clock, so game tests run instantly and deterministically. */
export function fakeCtx(names = ['Ana', 'Ben']) {
  let now = 0;
  let timers = [];
  let seq = 0;
  const ctx = {
    updates: 0,
    players: names.map((name, slot) => ({ slot, name })),
    now: () => now,
    setTimeout(fn, ms) {
      const t = { id: ++seq, at: now + ms, fn };
      timers.push(t);
      return t;
    },
    clearTimeout(t) {
      timers = timers.filter((x) => x !== t);
    },
    update() {
      ctx.updates++;
    },
    /** Move the clock forward, firing due timers in order. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        now = due.at;
        due.fn();
      }
      now = target;
    },
    pendingTimers: () => timers.length,
  };
  return ctx;
}
