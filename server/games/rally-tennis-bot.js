/**
 * The computer opponent for Rally Tennis (see `bot` in index.js). Timing a swing isn't a reaction
 * but an anticipation: you watch the ball come and swing when it gets to you, a little early or
 * late each time. So it swings at the right moment give or take its level's timing error (a new
 * one each shot), and aims away from you on the harder levels.
 *   easy:   timing off by about 190 ms (about one swing in six a whiff), never aims.
 *   normal: about 150 ms (one in ten), aims now and then.
 *   hard:   about 125 ms (one in twenty, and wide ones it aims can go out), and aims for the side
 *           you're not on.
 */
import { reactionMs } from './bot-human.js';

const LEVEL = { easy: { timing: 190, aims: 0 }, normal: { timing: 150, aims: 0.4 }, hard: { timing: 125, aims: 0.9 } };

export function rallyTennisBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L) return null;
  if (view.yourServe) return { type: 'swing', botDelayMs: 800 + rng() * 1400 }; // (a moment to get set)
  if (!view.yourShot || view.swingInMs === null || view.swingInMs === undefined) return null;
  // This shot's judgement: how early or late it'll be, and where it means to put it.
  if (!memory.tennis || memory.tennis.id !== view.shotId) {
    const them = view.positions[1 - view.you];
    const side = them < view.court.w / 2 ? 1 : -1; // the side they're not on (aim is TV left / right for both)
    const dir = rng() < L.aims ? side : 0;
    memory.tennis = { id: view.shotId, error: gauss(rng) * L.timing, aim: dir };
  }
  const plan = memory.tennis;
  if (plan.aim !== view.aim) return { type: 'aim', dir: plan.aim, botDelayMs: reactionMs(level, rng) };
  return { type: 'swing', botDelayMs: Math.max(0, view.swingInMs + plan.error) };
}

function gauss(rng) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
