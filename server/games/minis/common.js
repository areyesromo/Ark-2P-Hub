// Helpers shared by the micro-games.

/**
 * Pass/fail bookkeeping for a micro: each player is decided once (their
 * first decisive input counts), and the micro ends as soon as both are.
 */
export function verdicts(api) {
  const res = [null, null];
  const v = {
    res,
    open: (slot) => (slot === 0 || slot === 1) && res[slot] === null,
    decide(slot, ok) {
      if (!v.open(slot)) return;
      res[slot] = Boolean(ok);
      if (res[0] !== null && res[1] !== null) api.end({ pass: res.slice() });
      else api.update();
    },
    /** Time's up: whoever is still undecided gets `rest` (fail, unless told otherwise). */
    timeUp(rest = false) {
      api.end({ pass: res.map((r) => (r === null ? rest : r)) });
    },
  };
  return v;
}

export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function shuffle(rng, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The answer plus three other numbers near it (never below `min`), shuffled. */
export function choicesFor(rng, answer, spread, min = 0) {
  const out = new Set([answer]);
  while (out.size < 4) {
    const n = answer + (1 + Math.floor(rng() * spread)) * (rng() < 0.5 ? -1 : 1);
    if (n >= min) out.add(n);
  }
  return shuffle(rng, [...out]);
}
