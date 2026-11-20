// SNAP! Cards turn over one after another on the TV: the first to snap on a card that matches the
// one before it (the same number) wins; a snap on the wrong card loses.
import { verdicts, pick } from './common.js';
import { plausibleT, lagFor } from './runner.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

/** The card showing `t` ms in: its index in cards[] (each shows for stepMs, the first at 0). */
export function cardAt(t, stepMs, count) {
  return Math.max(0, Math.min(count - 1, Math.floor(t / stepMs)));
}

export default {
  id: 'snap', kind: 'micro', name: 'Snap!', order: 'SNAP!', howTo: 'Snap when a card matches the one before', durationMs: 6000,
  create(api) {
    const v = verdicts(api);
    const stepMs = Math.round(800 * api.speed);
    // Five to seven cards; one pair in a row matches (somewhere after the second), none before.
    const count = 5 + Math.floor(api.rng() * 3);
    const match = 2 + Math.floor(api.rng() * (count - 2));
    const cards = [];
    for (let i = 0; i < count; i++) {
      let rank;
      if (i === match) rank = cards[i - 1].rank;
      else do rank = pick(api.rng, RANKS); while (i > 0 && rank === cards[i - 1].rank);
      cards.push({ rank, suit: pick(api.rng, SUITS) });
    }
    const snaps = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (input.type !== 'snap' || !v.open(slot)) return;
        const at = plausibleT(input.t, api.elapsed()) - (typeof input.t === 'number' ? 0 : lagFor(api.players[slot]));
        const i = cardAt(at, stepMs, count);
        snaps[slot] = i;
        if (i !== match) return v.decide(slot, false);
        // The first good snap takes it: the other player is out.
        v.res[1 - slot] = v.res[1 - slot] === null ? false : v.res[1 - slot];
        v.decide(slot, true);
      },
      onTimeUp: () => v.timeUp(),
      view: () => ({ cards, stepMs, snaps, res: v.res }),
    };
  },
};
