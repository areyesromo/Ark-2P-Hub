// Kart Race 3D's karts. A racer with a 3D model (Rex, see models3d.js) drives it once it has loaded:
// the wheels roll and the front pair steer, the driver's hands follow the wheel, his head looks into
// bends, and he reacts (arms up in a spin-out, a fist pump for a win; the maths is in rig3d.js).
// Until then, and for every other racer, a placeholder built from its kart shape (the 2D outlines)
// in the racer's colour, with wheels and a driver in the player's colour. Every kart leans into
// bends, spins out and shrinks. A player's kart can carry a floating label ("P1") so you can find it
// in a pack. KRKarts.make(THREE, racerId, color, label?, player?) ->
// { obj, racer, marker, set(pose, k, now, place?), dispose() }.
(function () {
  // The 2D kart outlines (public/games/kart-race/host.js SHAPES), nose at +x.
  const SHAPES = {
    classic: [[0.55, 0], [0.3, -0.28], [-0.5, -0.28], [-0.5, 0.28], [0.3, 0.28]],
    long: [[0.75, 0], [0.4, -0.26], [-0.5, -0.26], [-0.5, 0.26], [0.4, 0.26]],
    stubby: [[0.42, 0], [0.25, -0.32], [-0.45, -0.32], [-0.45, 0.32], [0.25, 0.32]],
    wings: [[0.55, 0], [0.3, -0.25], [0.2, -0.25], [0.2, -0.42], [-0.1, -0.42], [-0.1, -0.25], [-0.5, -0.25], [-0.5, 0.25], [-0.1, 0.25], [-0.1, 0.42], [0.2, 0.42], [0.2, 0.25], [0.3, 0.25]],
    boxy: [[0.45, -0.33], [-0.5, -0.33], [-0.5, 0.33], [0.45, 0.33]],
    pointed: [[0.6, 0], [0.1, -0.22], [-0.5, -0.22], [-0.5, 0.22], [0.1, 0.22]],
  };
  const LENGTH = 1.75; // the kart's hit capsule (server KART: 2 * (r + reach))
  const LEAN = { max: 0.15, perTurn: 0.06 }; // roll in a bend: radians per radian-a-second of turning
  const SPIN_MS = 600; // a spin-out turns the kart once round in this long
  const BRAKE_DECEL = 4; // slowing faster than this (units/s²) tips the driver forward
  const JOLT_MS = 150; // a jolt fades in about this long
  const BOB_NOD = 4; // radians of nod per unit of head bob
  const RIM_STEPS = 12; // how finely a hand looks along the rim for a spot it can reach

  /** A label floating over a kart: the text on a rounded tag in `color`, always facing the camera. */
  function tag(THREE, text, color) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(4, 4, 120, 56, 18);
    g.fill();
    g.fillStyle = '#0b0d17';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(0.9, 0.45, 1);
    sprite.renderOrder = 10; // drawn over the karts in front of it
    return sprite;
  }

  /** The placeholder kart: the racer's outline extruded, four wheels, and a driver in `color`. */
  function placeholder(THREE, racer, color) {
    const pts = SHAPES[racer.shape] || SHAPES.classic;
    const xs = pts.map(function (p) { return p[0]; });
    const s = LENGTH / (Math.max.apply(null, xs) - Math.min.apply(null, xs));
    const mid = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2;
    const shape = new THREE.Shape(pts.map(function (p) { return new THREE.Vector2((p[0] - mid) * s, p[1] * s); }));
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    bodyGeo.rotateX(-Math.PI / 2); // the outline lies flat, extruded upward
    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12);
    wheelGeo.rotateX(Math.PI / 2);
    const torsoGeo = new THREE.BoxGeometry(0.3, 0.3, 0.36);
    const headGeo = new THREE.SphereGeometry(0.22, 16, 12);
    const mats = [
      new THREE.MeshLambertMaterial({ color: racer.stripe }),
      new THREE.MeshLambertMaterial({ color: 0x1f2937 }),
      new THREE.MeshLambertMaterial({ color: color }),
    ];
    const group = new THREE.Group();
    group.name = 'placeholder';
    const shell = new THREE.Mesh(bodyGeo, mats[0]);
    shell.position.y = 0.12;
    group.add(shell);
    [[0.55, 0.42], [0.55, -0.42], [-0.55, 0.42], [-0.55, -0.42]].forEach(function (w) {
      const m = new THREE.Mesh(wheelGeo, mats[1]);
      m.position.set(w[0], 0.18, w[1]);
      group.add(m);
    });
    const torso = new THREE.Mesh(torsoGeo, mats[0]);
    torso.position.set(-0.15, 0.55, 0);
    group.add(torso);
    const head = new THREE.Mesh(headGeo, mats[2]);
    head.position.set(-0.15, 0.9, 0);
    group.add(head);
    return {
      group: group,
      top: 0.9 + 0.22, // the head's top, for the tag
      dispose: function () {
        [bodyGeo, wheelGeo, torsoGeo, headGeo].forEach(function (g) { g.dispose(); });
        mats.forEach(function (m) { m.dispose(); });
      },
    };
  }

  const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_l', 'upper_arm_l', 'forearm_l', 'hand_l', 'shoulder_r', 'upper_arm_r',
    'forearm_r', 'hand_r', 'thigh_l', 'shin_l', 'foot_l', 'thigh_r', 'shin_r', 'foot_r', 'tail_1', 'tail_2', 'tail_3'];

  /**
   * The racer's 3D model, cloned from the loaded one (the clones share its geometry and texture; the
   * driver's bones are his own): the kart, the driver on its seat, and the parts that move, with the
   * rest pose they move from. `top`: the driver's head height.
   */
  function rig(THREE, model) {
    const kart = model.kart.clone(true);
    const driver = model.clone ? model.clone(model.driver) : model.driver.clone(true);
    const seat = kart.getObjectByName('seat');
    if (seat) driver.position.copy(seat.position);
    const group = new THREE.Group();
    group.add(kart, driver);
    const part = function (root, name) { return root.getObjectByName(name); };
    const bones = {};
    BONES.forEach(function (n) { const b = part(driver, n); if (b) bones[n] = b; });
    const parts = {
      wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(function (n) { return part(kart, n); }).filter(Boolean),
      front: ['wheel_fl', 'wheel_fr'].map(function (n) { return part(kart, n); }).filter(Boolean),
      steer: part(kart, 'steer'),
      grips: { l: part(kart, 'grip_l'), r: part(kart, 'grip_r') },
      bones: bones,
    };
    group.updateMatrixWorld(true);
    // The rest pose: each bone's own turn, and its parent's (in the model's frame) to turn about
    // the model's axes; the steering wheel's turn on its column.
    const rest = { steer: parts.steer ? parts.steer.quaternion.clone() : null, bones: {} };
    Object.keys(bones).forEach(function (n) {
      const b = bones[n];
      const parentQ = new THREE.Quaternion();
      if (b.parent) b.parent.getWorldQuaternion(parentQ);
      rest.bones[n] = { q: b.quaternion.clone(), parentInv: parentQ.invert() };
    });
    const top = new THREE.Box3().setFromObject(driver).max.y;
    return { group: group, parts: parts, rest: rest, wheelRadius: model.wheelRadius, top: top, can: Boolean(parts.steer && bones.hand_l && bones.hand_r) };
  }

  const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

  /**
   * Put a pose (KRBody.pose) on a model: the steering wheel's turn, every bone's turns (about the
   * model's axes, from its rest), then each hand onto its grip (two-bone reach, by its weight).
   */
  function animate(THREE, model, p, tailState) {
    const P = model.parts;
    const tmp = { q: new THREE.Quaternion(), v: new THREE.Vector3() };
    if (P.steer && model.rest.steer) P.steer.quaternion.copy(model.rest.steer).multiply(tmp.q.setFromAxisAngle(tmp.v.set(0, 1, 0), -p.wheel));
    const turns = Object.assign({}, p.turns);
    if (tailState) {
      ['tail_1', 'tail_2', 'tail_3'].forEach(function (n, i) { turns[n] = [['y', tailState.yaw[i]], ['z', tailState.pitch[i]]]; });
    }
    Object.keys(P.bones).forEach(function (n) {
      const b = P.bones[n];
      const r = model.rest.bones[n];
      b.quaternion.copy(r.q);
      (turns[n] || []).forEach(function (t) {
        const axis = tmp.v.fromArray(AXES[t[0]]).applyQuaternion(r.parentInv);
        b.quaternion.premultiply(tmp.q.setFromAxisAngle(axis, t[1]));
      });
    });
    model.group.updateMatrixWorld(true);
    [['l', -1], ['r', 1]].forEach(function (arm) {
      const s = arm[0];
      const w = p.ikWeight[s];
      const upper = P.bones['upper_arm_' + s];
      const fore = P.bones['forearm_' + s];
      const hand = P.bones['hand_' + s];
      const grip = P.grips[s];
      if (!(w > 0) || !upper || !fore || !hand || !grip) return;
      const local = function (o) { return model.group.worldToLocal(o.getWorldPosition(new THREE.Vector3())); };
      const S = local(upper);
      const reach = S.distanceTo(local(fore)) + local(fore).distanceTo(local(hand));
      const solved = window.KRBody.ik2(S.toArray(), local(fore).toArray(), local(hand).toArray(), onRim(THREE, model, grip, p.wheel, S, reach).toArray(), [S.x, S.y - 0.2, S.z + arm[1] * 0.15]);
      aim(THREE, model.group, upper, fore, new THREE.Vector3().fromArray(solved.elbow), w);
      aim(THREE, model.group, fore, hand, new THREE.Vector3().fromArray(solved.hand), w);
    });
  }

  /**
   * Where a hand holds the rim: its grip, or, when the turned wheel has carried the grip out of
   * reach, the first point back along the rim (towards where the grip was) that the hand can reach:
   * the hand slides round the rim, as a driver's does. In the model's frame.
   */
  function onRim(THREE, model, grip, wheel, shoulder, reach) {
    const up = new THREE.Vector3(0, 1, 0);
    let best = null;
    for (let i = 0; i <= RIM_STEPS; i++) {
      const p = grip.position.clone().applyAxisAngle(up, (i / RIM_STEPS) * wheel); // (back towards its rest spot)
      best = model.group.worldToLocal(grip.parent.localToWorld(p));
      if (best.distanceTo(shoulder) <= reach * 0.995) return best;
    }
    return best;
  }

  /** Turn `bone` so its child moves towards `target` (model frame), by weight w. */
  function aim(THREE, group, bone, child, target, w) {
    const toLocal = function (o) { return group.worldToLocal(o.getWorldPosition(new THREE.Vector3())); };
    const from = toLocal(bone);
    const d0 = toLocal(child).sub(from).normalize();
    const d1 = target.clone().sub(from).normalize();
    const groupInv = group.getWorldQuaternion(new THREE.Quaternion()).invert();
    const turn = new THREE.Quaternion().setFromUnitVectors(d0, d1);
    const now = groupInv.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    const parent = bone.parent ? groupInv.clone().multiply(bone.parent.getWorldQuaternion(new THREE.Quaternion())) : new THREE.Quaternion();
    const want = parent.invert().multiply(turn.multiply(now));
    bone.quaternion.slerp(want, w);
    bone.updateMatrixWorld(true);
  }

  /**
   * A racer's kart. `player`: a player's kart, which gets a ring in their colour under it once the
   * 3D model shows (the model wears the racer's own colours). set(pose, k, now, place): `place` is
   * the kart's 1-based place in the race, for the win reaction.
   */
  function make(THREE, racerId, color, label, player) {
    const racer = window.ArkKartRacers.racer(racerId);
    const body = new THREE.Group(); // leans and spins inside obj
    let stand = placeholder(THREE, racer, color);
    body.add(stand.group);
    const obj = new THREE.Group();
    obj.add(body);
    const marker = label ? tag(THREE, label, color) : null;
    if (marker) {
      marker.position.set(-0.15, stand.top + 0.9, 0); // above the head
      obj.add(marker); // (not in the body: it doesn't lean or spin)
    }
    let model = null; // the racer's 3D model, once it has loaded
    let ring = null;
    let gone = false;

    const loading = window.KRModels && window.KRModels.get(THREE, racer.id);
    if (loading) {
      loading.then(function (m) {
        if (gone) return;
        model = rig(THREE, m);
        body.remove(stand.group);
        stand.dispose();
        stand = null;
        body.add(model.group);
        if (marker) marker.position.set(-0.15, model.top + 0.45, 0);
        if (player) {
          ring = new THREE.Mesh(
            new THREE.RingGeometry(0.95, 1.05, 48),
            new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.02;
          obj.add(ring); // (not in the body: it doesn't lean or spin)
        }
      }, function () { /* no model: the placeholder stays (models3d.js logged why) */ });
    }

    const R = window.KRRig;
    const B = window.KRBody;
    let last = null; // the last frame { pose, t, h }: for turning, rolling and the road's height
    let lean = 0;
    let steer = 0;
    // The driver's motion between frames: the reaction playing, the tail's springs, a jolt fading.
    let reacting = null;
    let tailState = null;
    let jolt = 0;
    let wasSpinning = false;
    let lastSpeed = 0;
    return {
      obj: obj,
      racer: racerId,
      marker: marker,
      set: function (pose, k, now, place) {
        const h = window.ArkKartGeom.heightAt(pose.x, pose.y);
        obj.position.set(pose.x, h, pose.y);
        obj.rotation.y = -pose.angle; // field y is scene z
        const dt = last ? now - last.t : 0;
        const rate = last ? R.turnRate(last.pose, pose, dt) : 0;
        if (dt > 0) lean = R.ease(lean, Math.max(-LEAN.max, Math.min(LEAN.max, rate * LEAN.perTurn)));
        body.rotation.x = lean;
        body.rotation.y = k && k.spin ? ((now % SPIN_MS) / SPIN_MS) * Math.PI * 2 : 0;
        obj.scale.setScalar(k && k.shrunk ? 0.7 : 1);
        if (model) {
          const p = model.parts;
          const rolled = last ? R.roll(last.pose, pose, model.wheelRadius) : 0;
          p.wheels.forEach(function (w) { w.rotation.z -= rolled; }); // rolling forward is a negative turn
          steer = R.ease(steer, R.steerGoal(rate));
          p.front.forEach(function (w) { w.rotation.y = -steer; });
          if (model.can) {
            // The driver: the reaction playing, the tail, a jolt on a spin-out, the body's pose.
            const speed = dt > 0 ? (Math.hypot(pose.x - last.pose.x, pose.y - last.pose.y) / dt) * 1000 : 0;
            const braking = dt > 0 && ((lastSpeed - speed) / dt) * 1000 > BRAKE_DECEL;
            const spinning = Boolean(k && k.spin);
            jolt = spinning && !wasSpinning ? 1 : jolt * Math.exp(-(dt || 0) / JOLT_MS);
            wasSpinning = spinning;
            reacting = B.react(reacting, B.reaction(k, place, Boolean(k && k.finished)), dt || 0);
            tailState = B.tail(tailState, rate, speed, jolt, dt || 0);
            const body = B.pose({ steer: steer, rate: rate, speed: speed, boosting: Boolean(k && k.boosting), braking: braking, jolt: jolt, now: now, reaction: reacting });
            // The head bobs with speed and bumps: as a small nod.
            (body.turns.head = body.turns.head || []).push(['z', R.bob(speed, last ? h - last.h : 0, now) * BOB_NOD]);
            animate(THREE, model, body, tailState);
            lastSpeed = speed;
          }
        }
        last = { pose: pose, t: now, h: h };
      },
      dispose: function () {
        gone = true;
        if (stand) stand.dispose(); // (a model's clones share the loaded geometry: never freed here)
        if (ring) {
          ring.geometry.dispose();
          ring.material.dispose();
        }
        if (marker) {
          marker.material.map.dispose();
          marker.material.dispose();
        }
      },
    };
  }

  window.KRKarts = { make: make };
})();
