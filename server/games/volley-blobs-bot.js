/**
 * The computer opponent for Volley Blobs (see `bot` in index.js). It works out where the ball will
 * come down on its side and gets there a human reaction time after it sees it (bot-human.js),
 * just behind the spot so the front of its dome sends the ball on over the net, and jumps as it
 * arrives.
 *   easy:   often misjudges where the ball comes down, and just bumps it back.
 *   normal: closer, and jumps to meet the ball.
 *   hard:   reads it well and jumps to smash it over when the ball's near the net.
 */
import { FIELD, PHYSICS } from './volley-blobs.js';
import { reactionMs } from './bot-human.js';

const SLIP = { easy: 1.1, normal: 0.6, hard: 0.15 }; // how far off it may judge where the ball comes down

export function volleyBlobsBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !(level in SLIP) || !view.ball || !view.blobs) return null;
  const me = view.you;
  // Between points: let go of the stick (a held direction carries on into the next rally).
  if (view.phase !== 'play') return view.blobs[me].move ? { type: 'move', x: 0, botDelayMs: reactionMs(level, rng) } : null;
  const b = view.ball;
  const blob = view.blobs[me];
  const g = view.gravity || 12;
  const half = FIELD.w / 2;
  const toward = me === 0 ? 1 : -1; // the way to the net
  const mine = (x) => (me === 0 ? x < half : x > half);
  const contact = FIELD.blobR + FIELD.ballR; // the height the ball meets a dome at
  // When and where the ball comes down to dome height (off the side walls).
  const disc = b.vy * b.vy + 2 * g * Math.max(0, b.y - contact);
  const t = (b.vy + Math.sqrt(disc)) / g;
  const r = FIELD.ballR;
  const span = FIELD.w - 2 * r;
  let x = b.x - r + b.vx * t;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  if (x > span) x = 2 * span - x;
  x += r;
  let target = me === 0 ? 4 : 12; // home
  let jump = false;
  if (mine(x) || mine(b.x)) {
    // One judgement per flight of the ball (a person's misjudgement lasts the whole flight).
    const id = Math.round(b.vx * 10) + ':' + Math.round(b.vy > 0 ? 1 : 0) + ':' + (view.touches || 0);
    if (!memory.volley || memory.volley.id !== id) memory.volley = { id, slip: (rng() * 2 - 1) * SLIP[level] };
    // Just behind the ball (so the front of the dome sends it forward), more so for a smash.
    const behind = level === 'hard' && Math.abs(x - half) < 3 ? 0.55 : 0.35;
    target = x - toward * behind + memory.volley.slip;
    // Jump to meet it: when it's coming down close above.
    const dx = Math.abs(b.x - blob.x);
    jump = level !== 'easy' && blob.y === 0 && b.vy < 0 && dx < 1.4 && b.y - contact < 2.6 && b.y - contact > 0.6;
  }
  const lo = me === 0 ? FIELD.blobR : half + FIELD.netW / 2 + FIELD.blobR;
  const hi = me === 0 ? half - FIELD.netW / 2 - FIELD.blobR : FIELD.w - FIELD.blobR;
  target = Math.max(lo, Math.min(hi, target));
  const pace = reactionMs(level, rng);
  if (jump) return { type: 'jump', botDelayMs: pace * 0.5 }; // (a jump it saw coming: timed, not reacted)
  // Ease off near the spot: it won't correct again for a reaction time, so don't run past it.
  const move = Math.max(-1, Math.min(1, (target - blob.x) / (PHYSICS.moveSpeed * pace / 1000)));
  if (Math.abs(move) < 0.1 && Math.abs(blob.move || 0) < 0.1) return null;
  return { type: 'move', x: Math.abs(move) < 0.1 ? 0 : move, botDelayMs: pace };
}
