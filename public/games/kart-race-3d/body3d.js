// Kart Race 3D's driver motion: how a racer with a skeleton (Rex) moves as he drives. Plain numbers
// in and out, so it's testable without WebGL; karts3d.js puts the pose on the bones. Sets
// globalThis.KRBody.
// The model's frame: x forward, y up, z right. A turn is [axis, angle] about one of those axes,
// right-handed: +x leans right, +z tips back (the chest goes towards -x), +y turns left. Turning right
// (a positive rate) leans right and looks right.
(function () {
  const WHEEL = { ratio: 2.5, max: (60 * Math.PI) / 180 }; // the steering wheel turns more than the wheels
  const LEAN = { perTurn: 0.05, max: (10 * Math.PI) / 180 }; // the body's own lean into a bend
  const PITCH = { boost: (8 * Math.PI) / 180, brake: (6 * Math.PI) / 180 };
  const HEAD = { perTurn: 0.3, max: (30 * Math.PI) / 180, drift: (3 * Math.PI) / 180 };
  const BREATH = { angle: (1.5 * Math.PI) / 180, hz: 0.25 };
  const BLEND = { inMs: 200, outMs: 250 };
  const TAIL = { perTurn: 0.25, max: 0.6, settleMs: 250, jolt: 0.3 };
  const clamp = (v, max) => Math.max(-max, Math.min(max, v));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.sqrt(dot(a, a));
  const unit = (a) => { const l = len(a); return l > 1e-9 ? mul(a, 1 / l) : [1, 0, 0]; };

  /**
   * A critically damped spring towards `goal`, settling in about `settleMs`: the exact step, so a
   * long frame (a dropped one) lands closer to the goal rather than overshooting.
   */
  function spring(state, goal, dtMs, settleMs) {
    const s = state || { x: goal, v: 0 };
    const w = 4.6 / (settleMs / 1000);
    const t = Math.max(0, dtMs) / 1000;
    const c1 = s.x - goal;
    const c2 = s.v + w * c1;
    const e = Math.exp(-w * t);
    return { x: goal + (c1 + c2 * t) * e, v: (c2 - w * (c1 + c2 * t)) * e };
  }

  /**
   * Two bones reaching for `target` (shoulder → elbow → hand, model-space points): the bones keep
   * their rest lengths, the elbow bends towards `pole`, and a target out of reach gets a straight
   * arm pointing at it. Returns { elbow, hand }.
   */
  function ik2(shoulder, elbowRest, handRest, target, pole) {
    const a = len(sub(elbowRest, shoulder));
    const b = len(sub(handRest, elbowRest));
    const to = sub(target, shoulder);
    const dir = len(to) > 1e-9 ? unit(to) : unit(sub(handRest, shoulder));
    const d = Math.max(Math.abs(a - b) + 1e-6, Math.min(len(to), a + b));
    if (d >= a + b - 1e-9) return { elbow: add(shoulder, mul(dir, a)), hand: add(shoulder, mul(dir, a + b)) };
    const along = (a * a - b * b + d * d) / (2 * d);
    const up = Math.sqrt(Math.max(0, a * a - along * along));
    // The bend: the pole's direction with the reach taken out (any sideways direction if they line up).
    let bend = sub(sub(pole, shoulder), mul(dir, dot(sub(pole, shoulder), dir)));
    if (len(bend) < 1e-9) bend = Math.abs(dir[1]) < 0.9 ? [0, -1, 0] : [1, 0, 0];
    bend = unit(sub(bend, mul(dir, dot(bend, dir))));
    const elbow = add(add(shoulder, mul(dir, along)), mul(bend, up));
    return { elbow: elbow, hand: add(shoulder, mul(dir, d)) };
  }

  const ITEM = {
    throw: ['bouncer', 'seeker', 'bomb'],
    drop: ['banana', 'web', 'oil'],
    use: ['turbo', 'goldturbo', 'shield', 'star', 'coinbag', 'magnet', 'hover'],
    point: ['thunder', 'freeze', 'swap'],
  };
  const ARMS = { spin: 'both', win: 'left', sad: 'none', throw: 'right', drop: 'left', use: 'right', point: 'right' };

  /** What the driver is reacting to: a spin-out, then the finish (first: a win), then an item just used. */
  function reaction(k, place, finishing) {
    if (!k) return null;
    let name = null;
    if (k.spin) name = 'spin';
    else if (finishing && k.finished) name = place === 1 ? 'win' : 'sad';
    else if (k.used) name = Object.keys(ITEM).filter(function (n) { return ITEM[n].indexOf(k.used) !== -1; })[0] || null;
    return name ? { name: name, arms: ARMS[name] } : null;
  }

  /** A reaction's weight: in over 0.2 s while it's on, out over 0.25 s after. */
  function blend(state, active, dtMs) {
    const w = state ? state.weight : 0;
    return { weight: active ? Math.min(1, w + dtMs / BLEND.inMs) : Math.max(0, w - dtMs / BLEND.outMs) };
  }

  /**
   * The playing reaction: { name, arms, weight, t (ms since it started) }. A different one waits for
   * the current to fade out, then fades in: nothing snaps.
   */
  function react(state, want, dtMs) {
    const s = state || { name: null, arms: 'none', weight: 0, t: 0 };
    if (want && s.name === want.name) return { name: s.name, arms: s.arms, weight: blend(s, true, dtMs).weight, t: s.t + dtMs };
    if (s.name && s.weight > 0) return { name: s.name, arms: s.arms, weight: blend(s, false, dtMs).weight, t: s.t + dtMs };
    if (want) return { name: want.name, arms: want.arms, weight: blend({ weight: 0 }, true, dtMs).weight, t: dtMs };
    return { name: null, arms: 'none', weight: 0, t: 0 };
  }

  /** A reaction's own turns at weight w, t ms in. */
  function reactionTurns(r, now) {
    const w = r.weight;
    const t = r.t;
    switch (r.name) {
      case 'spin': return { upper_arm_l: [['z', 2 * w]], upper_arm_r: [['z', 2 * w]], head: [['y', 0.35 * Math.sin(now / 70) * w]] };
      case 'win': return { upper_arm_l: [['z', (1.4 + 0.5 * Math.abs(Math.sin(now / 180))) * w]], chest: [['z', 0.1 * w]] };
      case 'sad': return { chest: [['z', -0.26 * w]], head: [['z', -0.35 * w]] };
      case 'throw': {
        // A wind-up over the head, then the throw forward.
        const swing = t < 250 ? (2.4 * t) / 250 : Math.max(0, 2.4 * (1 - (t - 250) / 250));
        return { upper_arm_r: [['z', swing * w]], forearm_r: [['z', 0.5 * swing * w]] };
      }
      case 'drop': return { upper_arm_l: [['z', 1.6 * w], ['y', 1.2 * w]], forearm_l: [['z', 0.4 * w]] };
      case 'use': return { upper_arm_r: [['z', 1.8 * w]] };
      case 'point': return { upper_arm_r: [['z', 0.35 * w]] };
      default: return {};
    }
  }

  /**
   * The driver's pose this frame: the steering wheel's turn, how much each hand holds its grip (1:
   * on the wheel), and the turns for each bone (body, head, breathing and the reaction).
   * input: { steer, rate, speed, boosting, braking, jolt (0..1), now, reaction: react()'s state }.
   */
  function pose(input) {
    const turns = {};
    const put = function (bone, axis, angle) { (turns[bone] = turns[bone] || []).push([axis, angle]); };
    const lean = clamp((input.rate || 0) * LEAN.perTurn, LEAN.max);
    put('spine', 'x', lean / 2);
    put('chest', 'x', lean / 2);
    const pitch = (input.boosting ? PITCH.boost : 0) - (input.braking ? PITCH.brake : 0);
    put('spine', 'z', pitch / 2);
    put('chest', 'z', pitch / 2 + BREATH.angle * Math.sin((2 * Math.PI * BREATH.hz * input.now) / 1000));
    const jolt = input.jolt || 0;
    if (jolt) {
      put('chest', 'z', -0.15 * jolt);
      put('head', 'z', 0.2 * jolt);
    }
    const look = clamp((input.rate || 0) * HEAD.perTurn, HEAD.max);
    put('head', 'y', -look + HEAD.drift * Math.sin((2 * Math.PI * 0.13 * input.now) / 1000));
    put('head', 'x', 0.5 * HEAD.drift * Math.sin((2 * Math.PI * 0.21 * input.now) / 1000));
    const r = input.reaction;
    const ik = { l: 1, r: 1 };
    if (r && r.name) {
      const extra = reactionTurns(r, input.now);
      Object.keys(extra).forEach(function (bone) { extra[bone].forEach(function (t) { put(bone, t[0], t[1]); }); });
      if (r.arms === 'both' || r.arms === 'left') ik.l = 1 - r.weight;
      if (r.arms === 'both' || r.arms === 'right') ik.r = 1 - r.weight;
    }
    return { wheel: clamp(WHEEL.ratio * (input.steer || 0), WHEEL.max), ikWeight: ik, turns: turns };
  }

  /**
   * The tail: three springs that trail opposite the bend (the tip most) and dip on a jolt.
   * state: { springs: [{ x, v } x3], dip: [...], yaw: [...], pitch: [...] }.
   */
  function tail(state, rate, speed, jolt, dtMs) {
    const s = state || { springs: [null, null, null], dips: [null, null, null] };
    const springs = [];
    const dips = [];
    for (let i = 0; i < 3; i++) {
      const share = (i + 1) / 3;
      springs.push(spring(s.springs[i] || { x: 0, v: 0 }, clamp(-(rate || 0) * TAIL.perTurn * share, TAIL.max), dtMs, TAIL.settleMs));
      dips.push(spring(s.dips[i] || { x: 0, v: 0 }, -(jolt || 0) * TAIL.jolt * share, dtMs, TAIL.settleMs));
    }
    return { springs: springs, dips: dips, yaw: springs.map(function (p) { return p.x; }), pitch: dips.map(function (p) { return p.x; }) };
  }

  globalThis.KRBody = { WHEEL: WHEEL, spring: spring, ik2: ik2, reaction: reaction, blend: blend, react: react, pose: pose, tail: tail };
})();
