/**
 * The computer teammate for Tower Stack (see `bot` in index.js). On its turn it watches the
 * sliding block and drops as it crosses the middle of the tower, like a person timing a tap,
 * after a moment to see it come (it never drops the instant its block appears). Its timing is a
 * little off by its level:
 *   easy:   loose (perfect now and then, often a cut, the odd miss on a fast tower).
 *   normal: mostly close.
 *   hard:   nearly always perfect.
 */
import { STACK } from './tower-stack.js';

const LEVEL = {
  easy: { sd: 110, see: 700 },
  normal: { sd: 45, see: 500 },
  hard: { sd: 22, see: 350 },
};
const gauss = (rng) => (rng() + rng() + rng() + rng() - 2) / 0.577; // (about one either side, mostly)

export function towerStackBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'drop' || !view.move || view.turn !== view.you) return null;
  const { speed, amp, elapsed } = view.move;
  // How far it has slid (along its back-and-forth), and the next time it's over the middle
  // (it crosses at amp and 3*amp of every 4*amp), not before it's had a look.
  const d = ((elapsed / 1000) * speed) % (4 * amp);
  const earliest = d + (L.see / 1000) * speed;
  let next = amp;
  while (next < earliest) next += 2 * amp;
  const waitMs = ((next - d) / speed) * 1000;
  // (the game reads the block where it was STACK.lagMs before the drop arrives)
  return { type: 'drop', botDelayMs: Math.max(0, waitMs + STACK.lagMs + gauss(rng) * L.sd), botFor: view.height + ':' + view.lives };
}
