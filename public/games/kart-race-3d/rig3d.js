// Kart Race 3D's movement maths for a racer's 3D model: how far the wheels roll, how far the
// front wheels steer, and where the driver looks (his reactions and the rest of his motion are in
// body3d.js). Plain numbers in and out, so it's testable without WebGL. Sets globalThis.KRRig.
// Signs: field (x, y) is scene (x, z), so a growing pose angle turns the kart towards scene +z, its
// right. A positive turn rate means turning right; angles here carry that sign, and the caller sets
// rotation.y = -angle (a positive rotation.y turns towards the left).
(function () {
  const STEER_MAX = (25 * Math.PI) / 180; // the front wheels turn at most this far
  const HEAD_MAX = (30 * Math.PI) / 180; // the driver looks at most this far into a bend
  const TELEPORT = 3; // a move longer than this in one frame is a jump (respawn, Swap), not driving
  const STEER_PER_TURN = 0.25; // radians of steering per radian-a-second of turning
  const HEAD_PER_TURN = 0.3;
  const TOP_SPEED = 8.5; // the server's KART.maxSpeed: the bob is full from here up
  const BOB = { amp: 0.02, period: 60, dropGain: 0.4, dropMax: 0.05 };
  const clamp = (v, max) => Math.max(-max, Math.min(max, v));

  /** How fast the kart is turning, in radians a second (positive: to the right). */
  function turnRate(prev, pose, dtMs) {
    if (!prev || !(dtMs > 0)) return 0;
    const d = Math.atan2(Math.sin(pose.angle - prev.angle), Math.cos(pose.angle - prev.angle));
    return (d / dtMs) * 1000;
  }

  /** How far a wheel of this radius rolled since prev, in radians: negative when reversing. */
  function roll(prev, pose, radius) {
    if (!prev) return 0;
    const dx = pose.x - prev.x;
    const dy = pose.y - prev.y;
    if (Math.hypot(dx, dy) > TELEPORT) return 0;
    return (dx * Math.cos(pose.angle) + dy * Math.sin(pose.angle)) / radius;
  }

  const steerGoal = (rate) => clamp(rate * STEER_PER_TURN, STEER_MAX);
  const headGoal = (rate) => clamp(rate * HEAD_PER_TURN, HEAD_MAX);
  /** Smoothing: a fifth of the way to the goal each frame (as the lean does). */
  const ease = (cur, goal) => cur + (goal - cur) * 0.2;

  /** The head's bounce: a little with speed, and a dip as the road drops away (dh: height change). */
  function bob(speed, dh, now) {
    const ride = BOB.amp * Math.min(1, Math.abs(speed) / TOP_SPEED) * Math.sin(now / BOB.period);
    return ride - clamp(dh * BOB.dropGain, BOB.dropMax) + 0; // (+0: no -0 when stopped)
  }

  globalThis.KRRig = { STEER_MAX, HEAD_MAX, TELEPORT, turnRate, roll, steerGoal, headGoal, ease, bob };
})();
