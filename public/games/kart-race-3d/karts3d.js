// Kart Race 3D's karts: until a racer has a 3D model, a placeholder built from its kart shape
// (the 2D outlines) in the racer's colour, with wheels and a driver in the player's colour. It
// leans into bends, spins out and shrinks. KRKarts.make(THREE, racerId, color) -> { obj, set(pose, k, now), dispose() }.
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

  function make(THREE, racerId, color) {
    const racer = window.ArkKartRacers.racer(racerId);
    const pts = SHAPES[racer.shape] || SHAPES.classic;
    const xs = pts.map(function (p) { return p[0]; });
    const s = LENGTH / (Math.max.apply(null, xs) - Math.min.apply(null, xs));
    const mid = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2;
    const shape = new THREE.Shape(pts.map(function (p) { return new THREE.Vector2((p[0] - mid) * s, p[1] * s); }));
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    bodyGeo.rotateX(-Math.PI / 2); // the outline lies flat, extruded upward
    const mats = [
      new THREE.MeshLambertMaterial({ color: racer.stripe }),
      new THREE.MeshLambertMaterial({ color: 0x1f2937 }),
      new THREE.MeshLambertMaterial({ color: color }),
    ];
    const body = new THREE.Group(); // leans and spins inside obj
    const shell = new THREE.Mesh(bodyGeo, mats[0]);
    shell.position.y = 0.12;
    body.add(shell);
    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12);
    wheelGeo.rotateX(Math.PI / 2);
    [[0.55, 0.42], [0.55, -0.42], [-0.55, 0.42], [-0.55, -0.42]].forEach(function (w) {
      const m = new THREE.Mesh(wheelGeo, mats[1]);
      m.position.set(w[0], 0.18, w[1]);
      body.add(m);
    });
    const torsoGeo = new THREE.BoxGeometry(0.3, 0.3, 0.36);
    const torso = new THREE.Mesh(torsoGeo, mats[0]);
    torso.position.set(-0.15, 0.55, 0);
    body.add(torso);
    const headGeo = new THREE.SphereGeometry(0.22, 16, 12);
    const head = new THREE.Mesh(headGeo, mats[2]);
    head.position.set(-0.15, 0.9, 0);
    body.add(head);
    const obj = new THREE.Group();
    obj.add(body);

    let last = null; // { angle, t }: for how fast it's turning
    let lean = 0;
    return {
      obj: obj,
      racer: racerId,
      set: function (pose, k, now) {
        obj.position.set(pose.x, window.ArkKartGeom.heightAt(pose.x, pose.y), pose.y);
        obj.rotation.y = -pose.angle; // field y is scene z
        if (last && now > last.t) {
          const d = Math.atan2(Math.sin(pose.angle - last.angle), Math.cos(pose.angle - last.angle));
          const goal = Math.max(-LEAN.max, Math.min(LEAN.max, (d / (now - last.t)) * 1000 * LEAN.perTurn));
          lean += (goal - lean) * 0.2;
        }
        last = { angle: pose.angle, t: now };
        body.rotation.x = lean;
        body.rotation.y = k && k.spin ? ((now % SPIN_MS) / SPIN_MS) * Math.PI * 2 : 0;
        obj.scale.setScalar(k && k.shrunk ? 0.7 : 1);
      },
      dispose: function () {
        [bodyGeo, wheelGeo, torsoGeo, headGeo].forEach(function (g) { g.dispose(); });
        mats.forEach(function (m) { m.dispose(); });
      },
    };
  }

  window.KRKarts = { make: make };
})();
