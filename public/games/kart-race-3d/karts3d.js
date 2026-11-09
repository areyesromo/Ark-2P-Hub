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

  /**
   * The racer's 3D model, cloned from the loaded one (the clones share its geometry and texture):
   * the kart, the driver on its seat, and the parts that move. `top`: the driver's head height.
   */
  function rig(THREE, model) {
    const kart = model.kart.clone(true);
    const driver = model.driver.clone(true);
    const seat = kart.getObjectByName('seat');
    if (seat) driver.position.copy(seat.position);
    const group = new THREE.Group();
    group.add(kart, driver);
    const part = function (root, name) { return root.getObjectByName(name); };
    const parts = {
      wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(function (n) { return part(kart, n); }).filter(Boolean),
      front: ['wheel_fl', 'wheel_fr'].map(function (n) { return part(kart, n); }).filter(Boolean),
      head: part(driver, 'head'),
      armL: part(driver, 'arm_l'),
      armR: part(driver, 'arm_r'),
    };
    const base = {
      headY: parts.head ? parts.head.position.y : 0,
      headYaw: parts.head ? parts.head.rotation.y : 0,
      armL: parts.armL ? parts.armL.rotation.z : 0,
      armR: parts.armR ? parts.armR.rotation.z : 0,
    };
    group.updateMatrixWorld(true);
    const top = new THREE.Box3().setFromObject(driver).max.y;
    return { group: group, parts: parts, base: base, wheelRadius: model.wheelRadius, top: top };
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
    let last = null; // the last frame { pose, t, h }: for turning, rolling and the road's height
    let lean = 0;
    let steer = 0;
    let look = 0;
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
          look = R.ease(look, R.headGoal(rate));
          p.front.forEach(function (w) { w.rotation.y = -steer; });
          const m = R.moves(R.reaction(k, place), steer, look, now);
          if (p.armL) p.armL.rotation.z = model.base.armL + m.armL;
          if (p.armR) p.armR.rotation.z = model.base.armR + m.armR;
          if (p.head) {
            p.head.rotation.y = model.base.headYaw - m.headYaw;
            const speed = dt > 0 ? (Math.hypot(pose.x - last.pose.x, pose.y - last.pose.y) / dt) * 1000 : 0;
            p.head.position.y = model.base.headY + R.bob(speed, last ? h - last.h : 0, now);
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
