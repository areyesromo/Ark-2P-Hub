// A computer player's hand, for the games where a phone sends a target and the piece follows it at
// top speed (Air Hockey, Pong). A person's hand doesn't jump to top speed and stop dead: it speeds
// up, eases off as it gets there, and curves round when it changes its mind. The computer's moves
// carry `hand`, how quickly its hand gets going (units / s²), and the game moves its piece with
// handStep instead.

/** The range of `hand` a game accepts (anything else is ignored, as bad input is). */
export const HAND_RANGE = [40, 200];

/** Is `hand` (from a move) one a game should take? Undefined is fine: a plain move. */
export const validHand = (hand) => hand === undefined || (Number.isFinite(hand) && hand >= HAND_RANGE[0] && hand <= HAND_RANGE[1]);

/**
 * One step of a hand at `pos` ({ x, y }) heading for `to`: no faster than `top`, nor than it could
 * still stop at the target, and changing speed or direction by at most `accel` * dt. `hand`
 * ({ vx, vy }) is its speed, kept between steps. Gives the new position.
 */
export function handStep(hand, pos, to, accel, top, dt) {
  const dx = to.x - pos.x;
  const dy = to.y - pos.y;
  const d = Math.hypot(dx, dy);
  const want = d > 1e-6 ? Math.min(top, Math.sqrt(2 * accel * d)) / d : 0;
  let ax = dx * want - hand.vx;
  let ay = dy * want - hand.vy;
  const a = Math.hypot(ax, ay);
  const most = accel * dt;
  if (a > most) {
    ax *= most / a;
    ay *= most / a;
  }
  hand.vx += ax;
  hand.vy += ay;
  const x = pos.x + hand.vx * dt;
  const y = pos.y + hand.vy * dt;
  // Arriving: rather than step past the target by a hair and back (a jitter), it settles on it.
  if ((x - to.x) * dx + (y - to.y) * dy > 0 && Math.hypot(hand.vx, hand.vy) <= 2 * most) {
    hand.vx = 0;
    hand.vy = 0;
    return { x: to.x, y: to.y };
  }
  return { x, y };
}
