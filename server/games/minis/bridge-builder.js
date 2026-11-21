// Bridge Builder: a bridge balanced on a post in the middle, with four spots for crates on each
// side: the left half is player 1's, the right half player 2's. Take turns putting the next crate
// (weights 1 to 3, the next one shown) on any free spot: the further out, the more it leans. Tip
// it past the limit with your crate and you lose the round. Once all eight are on, the cart rolls
// across and the bridge tips to the heavier side: that side's owner loses (dead level: nobody).
// First to two rounds.
export const SPOTS = [-4, -3, -2, -1, 1, 2, 3, 4]; // a spot's distance from the post (left negative)
export const LIMIT = 10; // more lean than this, either way, and it tips
export const TURN_MS = 4000;
export const CART_MS = 2600;
export const BETWEEN_MS = 2200;
export const ROUNDS_TO_WIN = 2;
const DURATION_MS = 80000;

/** The lean: each crate's weight times how far out it is (left negative). */
export function lean(placed) {
  return placed.reduce((t, w, i) => t + (w ? w * SPOTS[i] : 0), 0);
}

/** Who loses when the cart crosses a full bridge: the heavier side's owner, or nobody when level. */
export const cartLoser = (t) => (t === 0 ? null : t < 0 ? 0 : 1);

export default {
  id: 'bridge-builder', kind: 'party', look: '2d', name: 'Bridge Builder', order: 'BALANCE THE BRIDGE!', howTo: 'Take turns placing crates. Tip it and you lose; when it is full the heavier side loses', durationMs: DURATION_MS,
  create(api) {
    const wins = [0, 0];
    let round = 0;
    let starter = Math.floor(api.rng() * 2);
    let crates = []; // this round's weights, in order
    let placed = []; // weight on each spot, 0 free
    let turn = 0;
    let n = 0; // crates placed
    let phase = 'place';
    let result = null; // { loser, how: 'tip' | 'cart', lean }
    let last = null; // { spot, by, n }
    let turnEnds = 0;
    let cartAt = 0;
    let timer = null;
    let winner = null;

    const set = (ms, fn) => { if (timer) api.clearTimeout(timer); timer = api.setTimeout(fn, ms); };

    function newRound() {
      round++;
      crates = Array.from({ length: SPOTS.length }, () => 1 + Math.floor(api.rng() * 3));
      placed = new Array(SPOTS.length).fill(0);
      n = 0;
      turn = starter;
      starter = 1 - starter;
      result = null;
      last = null;
      phase = 'place';
      armTurn();
    }

    function armTurn() {
      turnEnds = api.elapsed() + TURN_MS;
      api.update();
      // Out of time: a free spot that doesn't tip it, if there is one.
      set(TURN_MS, () => {
        const free = placed.map((w, i) => (w ? -1 : i)).filter((i) => i >= 0);
        const safe = free.filter((i) => Math.abs(lean(placed) + crates[n] * SPOTS[i]) <= LIMIT);
        const from = safe.length ? safe : free;
        place(turn, from[Math.floor(api.rng() * from.length)]);
      });
    }

    function place(slot, spot) {
      placed[spot] = crates[n];
      n++;
      last = { spot, by: slot, n };
      const t = lean(placed);
      if (Math.abs(t) > LIMIT) return endRound({ loser: slot, how: 'tip', lean: t });
      if (n === SPOTS.length) {
        phase = 'cart';
        cartAt = api.elapsed();
        api.update();
        return set(CART_MS, () => endRound({ loser: cartLoser(t), how: 'cart', lean: t }));
      }
      turn = 1 - slot;
      armTurn();
    }

    function endRound(r) {
      result = r;
      phase = 'roundEnd';
      if (r.loser !== null) wins[1 - r.loser]++;
      const top = wins[0] >= ROUNDS_TO_WIN ? 0 : wins[1] >= ROUNDS_TO_WIN ? 1 : null;
      api.update();
      if (top !== null) {
        winner = top;
        return set(BETWEEN_MS, () => api.end({ winner: top }));
      }
      set(BETWEEN_MS, newRound);
    }

    return {
      start() {
        newRound();
      },
      onInput(slot, input) {
        if ((slot !== 0 && slot !== 1) || input.type !== 'place' || phase !== 'place' || slot !== turn || winner !== null) return;
        const spot = input.spot;
        if (!Number.isInteger(spot) || spot < 0 || spot >= SPOTS.length || placed[spot]) return;
        place(slot, spot);
      },
      // Time up (rare: rounds are short): more rounds won wins.
      onTimeUp: () => api.end({ winner: wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1 }),
      view: () => ({
        spots: SPOTS, limit: LIMIT, round, wins, crates, n, placed, turn, phase, result, last,
        lean: lean(placed),
        turnLeftMs: phase === 'place' ? Math.max(0, turnEnds - api.elapsed()) : 0,
        turnMs: TURN_MS, cartMs: CART_MS,
        cartLeftMs: phase === 'cart' ? Math.max(0, cartAt + CART_MS - api.elapsed()) : 0,
      }),
    };
  },
};
