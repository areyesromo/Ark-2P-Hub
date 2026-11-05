/**
 * The computer opponent for Brick Breaker Duel (see `bot` in index.js). It follows the ball that
 * will reach its paddle first (off the side walls), a human reaction time after it sees it
 * (bot-human.js), and now and then misjudges one altogether (a miss only costs it a moment).
 *   easy:   misses about one in four, and just meets the ball.
 *   normal: misses one in ten, and angles the ball towards its bricks.
 *   hard:   misses one in thirty, and steers the ball at the thickest part of its wall.
 */
import { FIELD } from './brick-duel.js';
import { reactionMs } from './bot-human.js';

const MISS = { easy: 0.25, normal: 0.1, hard: 0.03 };

export function brickDuelBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !(level in MISS) || view.phase !== 'play' || !view.side) return null;
  const side = view.side;
  const w = FIELD.w;
  const r = FIELD.ballR;
  const y = FIELD.paddleY;
  // The ball that gets to the paddle first.
  let ball = null;
  let soonest = Infinity;
  for (const b of side.balls) {
    if (b.held || b.vy <= 0) continue;
    const t = (y - b.y) / b.vy;
    if (t >= 0 && t < soonest) { soonest = t; ball = b; }
  }
  let target = w / 2;
  if (ball) {
    // Where it crosses the paddle's line, bouncing off the side walls.
    const span = w - 2 * r;
    let x = ball.x - r + ball.vx * soonest;
    x = ((x % (2 * span)) + 2 * span) % (2 * span);
    if (x > span) x = 2 * span - x;
    x += r;
    // One decision per ball that comes down (a slip of the same size all the way, as a person's).
    const id = Math.round(ball.vx * 100) + ':' + side.broken;
    if (!memory.brick || memory.brick.id !== id) {
      const half = side.paddleW / 2;
      let off;
      if (rng() < MISS[level]) off = (rng() < 0.5 ? -1 : 1) * (half + r + 0.1 + rng() * 0.4); // misjudged
      else if (level === 'easy') off = (rng() * 2 - 1) * half * 0.6;
      else {
        // Where on the paddle to meet it, to send it at its bricks (an edge sends it off at an angle).
        const aim = level === 'hard' ? thickest(side.bricks) : nearest(side.bricks, x);
        const want = Math.max(-1, Math.min(1, ((aim + 0.5) - x) / 3)); // -1: hard left .. 1: hard right
        off = -want * half * 0.7; // (hit on the right of the paddle to send it left, and so on)
      }
      memory.brick = { id, off };
    }
    target = x + memory.brick.off;
  }
  target = Math.max(0, Math.min(w, target));
  return { type: 'move', x: target / w, botDelayMs: reactionMs(level, rng) };
}

/** The column with the most bricks left in it. */
function thickest(bricks) {
  const n = new Array(FIELD.cols).fill(0);
  for (const [, c] of bricks) n[c]++;
  return n.indexOf(Math.max(...n));
}

/** The column nearest x that still has a brick in it. */
function nearest(bricks, x) {
  let best = Math.floor(x);
  let d = Infinity;
  for (const [, c] of bricks) if (Math.abs(c + 0.5 - x) < d) { d = Math.abs(c + 0.5 - x); best = c; }
  return best;
}
