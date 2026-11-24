/** A repeatable rng (mulberry32): the same seed gives the same numbers, e.g. for the daily challenge. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from a string (FNV-1a), to seed with: the same text gives the same seed. */
export function hashSeed(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h;
}
