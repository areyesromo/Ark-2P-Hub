/**
 * The computer opponent for Pong (see `bot` in index.js). It works out where the ball will cross
 * its paddle's line (off the top and bottom walls) and moves there, a moment after it sees it.
 * Each return it may misjudge it altogether (a miss you can win the point on):
 *   easy:   slow to react, misses about a third, and drifts back to the middle late.
 *   normal: quicker, misses about one in eight.
 *   hard:   quick, misses one in twenty-five, and hits with the paddle's edge to angle the ball.
 */
import { FIELD } from './pong.js';

const LEVEL = {
  easy: { react: [200, 320], miss: 0.3 },
  normal: { react: [120, 200], miss: 0.12 },
  hard: { react: [60, 110], miss: 0.04 },
};

export function pongBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.ball) return null;
  const me = view.you;
  const b = view.ball;
  const x = me === 0 ? FIELD.paddleX + FIELD.paddleW : FIELD.w - FIELD.paddleX - FIELD.paddleW;
  const coming = me === 0 ? b.vx < 0 : b.vx > 0;
  let target = FIELD.h / 2;
  if (coming && b.vx) {
    // Where it crosses our line, bouncing off the top and bottom.
    const t = (x - b.x) / b.vx;
    const r = FIELD.ballR;
    const span = FIELD.h - 2 * r;
    let y = b.y - r + b.vy * t;
    y = ((y % (2 * span)) + 2 * span) % (2 * span);
    if (y > span) y = 2 * span - y;
    target = y + r;
    // A slip of the same size for the whole approach (so it doesn't jitter), new each time it comes.
    const key = Math.sign(b.vx) + ':' + Math.round(b.vx * 10);
    if (!memory.pong || memory.pong.key !== key) {
      const side = rng() < 0.5 ? -1 : 1;
      const reach = FIELD.paddleH / 2 + FIELD.ballR; // further off than this and it misses
      const off = rng() < L.miss
        ? side * reach * (1.1 + rng() * 0.4) // misjudged: it goes past
        : level === 'hard' ? side * FIELD.paddleH * (0.25 + rng() * 0.15) // the edge
          : (rng() * 2 - 1) * reach * (level === 'easy' ? 0.8 : 0.6);
      memory.pong = { key, off };
    }
    target += memory.pong.off;
  } else if (level === 'easy') {
    target = (view.paddles[me] + FIELD.h / 2) / 2; // only half way back
  }
  target = Math.min(FIELD.h, Math.max(0, target));
  const [lo, hi] = L.react;
  return { type: 'move', y: target / FIELD.h, botDelayMs: lo + rng() * (hi - lo) };
}
