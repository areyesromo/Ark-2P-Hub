/**
 * The computer for Heads-up Hold'em (see `bot` in index.js). It only knows its own two cards and the
 * board. It reckons how often its hand wins against any two cards (by playing the rest out a few
 * hundred times), sets that against what it costs to stay in, and bets with the good ones.
 *   easy:   a rough feel for its hand; calls too often, raises only with strong cards, never bluffs.
 *   normal: a good feel; bets its strong hands, calls when the pot pays for it, bluffs now and then.
 *   hard:   a sharp feel; bets bigger with big hands, steals the blinds, bluffs more on the river.
 */
import { equity } from './holdem-hands.js';

const LEVEL = {
  easy: { sims: 120, noise: 0.12, raiseAt: 0.72, callSlack: 0.08, bluff: 0, steal: 0.1 },
  normal: { sims: 350, noise: 0.05, raiseAt: 0.64, callSlack: 0.02, bluff: 0.08, steal: 0.35 },
  hard: { sims: 700, noise: 0.02, raiseAt: 0.6, callSlack: 0, bluff: 0.16, steal: 0.6 },
};

export function holdemBot(view, level, rng = Math.random) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || view.turn !== view.you || !view.options) return null;
  const me = view.you;
  const o = view.options;
  const hole = view.cards[me];
  if (!hole) return null;
  const eq = Math.max(0, Math.min(1, equity(hole, view.board, L.sims, rng) + (rng() * 2 - 1) * L.noise));
  const pot = view.pot;
  const odds = o.call / (pot + o.call); // the share of the pot it has to put in to stay
  const pace = { botDelayMs: 1200 + rng() * 1600, botFor: view.hand + ':' + view.n };
  const raiseTo = (frac) => {
    if (o.minTo === null) return null;
    const theirs = view.bets[1 - me];
    const want = theirs + Math.round((pot * frac) / 5) * 5;
    return Math.max(o.minTo, Math.min(o.maxTo, want));
  };
  const river = view.street === 'river';
  // Strong: bet or raise (all in with a monster).
  if (eq >= L.raiseAt && o.minTo !== null) {
    const frac = eq > 0.85 && level !== 'easy' ? 1.5 : level === 'hard' ? 0.9 : 0.6;
    const to = eq > 0.9 && level === 'hard' && rng() < 0.4 ? o.maxTo : raiseTo(frac);
    if (to !== null) return { type: 'act', action: 'raise', to, ...pace };
  }
  if (o.check) {
    // Checked to: a bluff, or a steal of the blinds from the button, now and then.
    const stealing = view.street === 'preflop' && view.button === me && rng() < L.steal;
    if ((stealing || (river && rng() < L.bluff)) && o.minTo !== null) return { type: 'act', action: 'raise', to: raiseTo(0.6), ...pace };
    return { type: 'act', action: 'check', ...pace };
  }
  // Facing a bet: stay in when the pot pays for it (Easy hangs on more than it should).
  if (eq + L.callSlack >= odds) {
    if (level === 'hard' && rng() < L.bluff / 2 && o.minTo !== null && !river) return { type: 'act', action: 'raise', to: raiseTo(1), ...pace };
    return { type: 'act', action: 'call', ...pace };
  }
  return { type: 'act', action: 'fold', ...pace };
}
