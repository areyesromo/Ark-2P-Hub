/**
 * The computer opponent for Reaction Duel (see `bot` in index.js): it never jumps the gun, and
 * taps a human reaction time after GO (bot-human.js): a slow player on Easy, the average on Normal,
 * a quick one on Hard.
 */
import { reactionMs } from './bot-human.js';

export function reactionDuelBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'go' || !['easy', 'normal', 'hard'].includes(level)) return null;
  return { type: 'tap', botDelayMs: reactionMs(level, rng) };
}
