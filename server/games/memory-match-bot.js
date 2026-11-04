/**
 * The computer opponent for Memory Match (see `bot` in index.js). It remembers the faces it has
 * seen turned over (yours too) in its memory, as well as its level allows:
 *   easy:   keeps about a third of what it sees.   normal: about two thirds.   hard: all of it.
 * On its turn: a pair it knows, else a card it hasn't seen (then its match, if it knows one).
 */
const KEEP = { easy: 0.35, normal: 0.7, hard: 1 };

export function memoryMatchBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !KEEP[level] || !view.cards) return null;
  const mem = (memory.memory = memory.memory || { faces: {}, looked: {} });
  // Remember the cards face up now (each sighting once: a card it forgot stays forgotten).
  view.cards.forEach((c, i) => {
    if (!c.up || c.owner !== null && c.owner !== undefined) return;
    const key = i + ':' + c.face;
    if (mem.looked[key]) return;
    mem.looked[key] = true;
    if (rng() < KEEP[level]) mem.faces[i] = c.face;
  });
  // Paired cards are out of play.
  view.cards.forEach((c, i) => { if (c.owner !== null && c.owner !== undefined) delete mem.faces[i]; });
  if (view.phase !== 'turn' || view.turn !== view.you || view.race) return null;
  const pace = 700 + rng() * 700;
  const flip = (index) => ({ type: 'flip', index, botDelayMs: pace });
  const hidden = view.cards.map((c, i) => i).filter((i) => !view.cards[i].up);
  if (!hidden.length) return null;
  const known = (i) => mem.faces[i] !== undefined;
  const any = (list) => list[Math.floor(rng() * list.length)];
  if (view.flipped.length === 1) {
    // The second card: its match if known, else one it hasn't seen.
    const first = view.flipped[0];
    const face = view.cards[first].face;
    const match = hidden.find((i) => i !== first && mem.faces[i] === face);
    if (match !== undefined) return flip(match);
    const fresh = hidden.filter((i) => !known(i));
    return flip(any(fresh.length ? fresh : hidden));
  }
  // The first card: one of a pair it knows, else one it hasn't seen.
  for (const i of hidden) {
    if (known(i) && hidden.some((j) => j !== i && mem.faces[j] === mem.faces[i])) return flip(i);
  }
  const fresh = hidden.filter((i) => !known(i));
  return flip(any(fresh.length ? fresh : hidden));
}
