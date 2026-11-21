// Treasure Dig: a chest is buried in your patch of sand (each of you has your own, in a different
// spot). Dig a square and the beeper says how close you are: 🔥 next to it, ♨️ warm, 🌤️ cool,
// ❄️ cold. First to dig up their chest takes the round; first to three. Digging takes a moment, so
// thinking beats tapping at random.
export const SIZE = 8; // the patch: SIZE x SIZE squares
export const DIG_MS = 700; // a dig takes this long (no digging again till it's done)
export const ROUNDS_TO_WIN = 3;
const BETWEEN_MS = 1800; // the found chest on show before the next round
const DURATION_MS = 75000;

/** How close a square is to the chest: squares apart, as a king moves (diagonals count as one). */
export function distance(a, b) {
  return Math.max(Math.abs((a % SIZE) - (b % SIZE)), Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)));
}

/** The beeper's word for a distance: 0 found, 1 hot, 2 warm, 3 cool, 4 or more cold. */
export function heat(d) {
  return d === 0 ? 'chest' : d === 1 ? 'hot' : d === 2 ? 'warm' : d === 3 ? 'cool' : 'cold';
}

export default {
  id: 'treasure-dig', kind: 'party', look: '2d', name: 'Treasure Dig', order: 'DIG FOR TREASURE!', howTo: 'Dig a square: hot or cold says how close your chest is. First to find it', durationMs: DURATION_MS,
  create(api) {
    const wins = [0, 0];
    let round = 0;
    let chests = [0, 0];
    let digs = [[], []]; // { cell, heat } per player, in order
    let busyUntil = [0, 0];
    let found = null; // the round's finder (or null), while the next round waits
    let winner = null;

    function newRound() {
      round++;
      found = null;
      digs = [[], []];
      busyUntil = [0, 0];
      // A chest each, in different spots.
      const a = Math.floor(api.rng() * SIZE * SIZE);
      let b = Math.floor(api.rng() * SIZE * SIZE);
      while (b === a) b = Math.floor(api.rng() * SIZE * SIZE);
      chests = api.rng() < 0.5 ? [a, b] : [b, a];
      api.update();
    }

    return {
      start() {
        newRound();
      },
      onInput(slot, input) {
        if ((slot !== 0 && slot !== 1) || input.type !== 'dig' || found !== null || winner !== null) return;
        const cell = input.cell;
        if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) return;
        const now = api.elapsed();
        if (now < busyUntil[slot] || digs[slot].some((d) => d.cell === cell)) return;
        busyUntil[slot] = now + DIG_MS;
        const h = heat(distance(cell, chests[slot]));
        digs[slot].push({ cell, heat: h });
        if (h === 'chest') {
          found = slot;
          wins[slot]++;
          if (wins[slot] >= ROUNDS_TO_WIN) {
            winner = slot;
            api.update();
            return api.setTimeout(() => api.end({ winner: slot }), BETWEEN_MS);
          }
          api.setTimeout(newRound, BETWEEN_MS);
        }
        api.update();
      },
      // Time up (rarely: rounds are quick): more rounds won wins.
      onTimeUp: () => api.end({ winner: wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1 }),
      // Never where a chest is (only one that's been dug up).
      view: () => ({
        size: SIZE,
        round,
        wins,
        digs,
        digMs: DIG_MS,
        found,
        chests: found === null ? [null, null] : chests.map((c, slot) => (digs[slot].some((d) => d.cell === c) ? c : null)),
      }),
    };
  },
};
