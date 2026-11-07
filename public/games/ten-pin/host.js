// Bowling on the TV, in 3D with three.js. The server (server/games/ten-pin.js) works out each
// roll the moment the ball is let go; this plays back the frames it recorded: the ball down the
// lane and the pins flying. The camera sits behind the bowler while they aim, follows the ball
// down the lane and stops by the pins to watch them fall. The score card runs along the top.
// Controllers bowl from here: the stick moves you (and ↑↓ turns your aim), hold A for power
// (the meter swings), push the stick sideways as you let go for spin.
(function () {
  Ark.loadCss('/games/ten-pin/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.25;
  const BALL_R = 0.109;
  const METER_MS = 1400; // the power meter: empty to full and back in twice this

  let THREE = null;
  let threeReady = null;
  function loadThree() {
    if (!threeReady) threeReady = import('/vendor/three/three.module.min.js').then(function (m) { THREE = m; });
    return threeReady;
  }

  let root = null;
  let els = null;
  let view = null;
  let gl = null;
  let raf = null;
  let fit = null;
  let colors = null;
  let cardKey = '';
  let overlayKey = '';
  let lastFrame = 0;
  let play = null; // the roll being played back: { id, roll, start, fallAt: {} }
  const pads = {}; // controller players: slot -> { stance, aim, charging, t0, n }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  // ---- the score card ----

  /** What a frame's boxes show: X a strike, / a spare, – a miss. */
  function marks(f, last) {
    const b = f.balls;
    if (!last) {
      if (b[0] === 10) return ['', 'X'];
      return [b[0] === undefined ? '' : b[0] === 0 ? '–' : b[0], b[1] === undefined ? '' : b[0] + b[1] === 10 ? '/' : b[1] === 0 ? '–' : b[1]];
    }
    const out = [];
    let prev = null; // the first ball of a rack, while its second is to come
    b.forEach(function (n) {
      if (prev === null && n === 10) out.push('X');
      else if (prev !== null && prev + n === 10) {
        out.push('/');
        prev = null;
        return;
      } else out.push(n === 0 ? '–' : n);
      prev = prev === null && n !== 10 ? n : null;
    });
    while (out.length < 3) out.push('');
    return out;
  }

  function cardHtml(v) {
    let head = '<tr><th></th>';
    for (let f = 0; f < v.frames; f++) head += '<th>' + (f + 1) + '</th>';
    head += '<th>Total</th></tr>';
    const rows = [0, 1].map(function (slot) {
      const c = v.cards[slot];
      let row = '<tr class="' + (v.turn === slot && v.phase !== 'over' ? 'up' : '') + '"><td class="who">' + nameOf(v, slot) + '</td>';
      for (let f = 0; f < v.frames; f++) {
        const fr = c.frames[f];
        const last = f === v.frames - 1;
        const m = fr ? marks(fr, last) : last ? ['', '', ''] : ['', ''];
        const now = v.phase !== 'over' && v.turn === slot && v.next && v.next.frame === f;
        row += '<td class="fr' + (last ? ' last' : '') + (now ? ' now' : '') + '"><div class="balls">' + m.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="run">' + (fr && fr.total !== null ? fr.total : '') + '</div></td>';
      }
      return row + '<td class="tot">' + c.total + '</td></tr>';
    });
    return '<table class="tp-card">' + head + rows.join('') + '</table>';
  }

  // ---- overlay ----

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'intro') {
      html = '<div class="panel"><div class="big">🎳 Bowling</div><div class="sub">' + v.frames + ' frames' + (v.bumpers ? ' · bumpers up' : '') + ' · ' + nameOf(v, 0) + ' bowls first<br>' +
        'On your phone: drag the ball to where you stand, then swipe it up the lane. Curve the swipe for spin.</div></div>';
    } else if (v.phase === 'over') {
      const s = v.scores;
      html = '<div class="panel"><div class="big">' + (v.draw ? '🤝 A tie!' : '🏆 ' + nameOf(v, v.winner) + ' wins!') + '</div>' +
        '<div class="sub">' + nameOf(v, 0) + ' <strong>' + s[0] + '</strong> · ' + nameOf(v, 1) + ' <strong>' + s[1] + '</strong>' +
        (v.perfect[0] || v.perfect[1] ? '<br>🎳 A perfect game!' : '') +
        '<br>Rematch or head back to the lobby from your phones or controllers.</div></div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    els.overlay.innerHTML = html;
    els.overlay.classList.toggle('hidden', !html);
  }

  function render(v) {
    if (!play || !v.roll || v.roll.id !== play.id) {
      play = v.roll ? { id: v.roll.id, roll: v.roll, start: performance.now(), fallAt: {}, slot: v.turn, fresh: v.next ? v.next.fresh : true, count: v.standing.length } : null;
    }
    view = v;
    if (!els) return;
    const card = cardHtml(v) + '<div class="tp-up">' + (v.phase === 'over' ? '' : nameOf(v, v.turn) + ' · frame ' + (v.next ? v.next.frame + 1 : '') + (v.next && v.next.ball ? ', ball ' + (v.next.ball + 1) : '')) + '</div>';
    if (card !== cardKey) {
      cardKey = card;
      els.card.innerHTML = card;
    }
    renderOverlay(v);
  }

  // ---- the 3D scene ----

  function mat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6 }, extra || {}));
  }

  /** The lane's wood: boards, the target arrows and the dots, drawn once. */
  function laneTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 4096;
    const g = c.getContext('2d');
    const boards = 39;
    for (let i = 0; i < boards; i++) {
      const tone = 196 + ((i * 37) % 9) * 4;
      g.fillStyle = 'rgb(' + tone + ',' + (tone - 46) + ',' + (tone - 100) + ')';
      g.fillRect((i * c.width) / boards, 0, c.width / boards + 1, c.height);
      g.fillStyle = 'rgba(80,40,10,0.25)';
      g.fillRect((i * c.width) / boards, 0, 1, c.height);
    }
    // (the canvas runs from the foul line at the bottom to the pit at the top: 19.5 m)
    const zy = function (z) { return c.height * (1 - z / 19.5); };
    g.fillStyle = 'rgba(120,20,20,0.85)';
    [5, 10, 15, 20, 25, 30, 35].forEach(function (b, k) {
      const x = (b / boards) * c.width;
      const y = zy(4.6 + Math.abs(k - 3) * 0.3);
      g.beginPath();
      g.moveTo(x, y - 40);
      g.lineTo(x - 5, y);
      g.lineTo(x + 5, y);
      g.fill();
    });
    [3, 5, 8, 11, 14].forEach(function (b) {
      [b, boards - b].forEach(function (bb) {
        g.beginPath();
        g.arc((bb / boards) * c.width, zy(2.1), 2.5, 0, Math.PI * 2);
        g.fill();
      });
    });
    // A sheen of oil on the front part.
    const oil = g.createLinearGradient(0, zy(0), 0, zy(12));
    oil.addColorStop(0, 'rgba(255,255,255,0.10)');
    oil.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = oil;
    g.fillRect(0, zy(12), c.width, zy(0) - zy(12));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = gl.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function pinGeometry() {
    const pts = [[0, 0], [0.026, 0], [0.042, 0.04], [0.058, 0.11], [0.06, 0.14], [0.055, 0.19], [0.036, 0.245], [0.022, 0.27], [0.024, 0.3], [0.031, 0.335], [0.028, 0.36], [0.016, 0.378], [0, 0.381]];
    return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 24);
  }

  function setupGl() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0f19);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    els.arena.insertBefore(renderer.domElement, els.arena.firstChild);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0f19, 22, 40);
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 80);
    gl = { renderer: renderer, scene: scene, camera: camera, cam: { x: 0, y: 2.0, z: 3.6, lx: 0, lz: -6 } };
    scene.add(new THREE.HemisphereLight(0xfff7ed, 0x1f2937, 0.7));
    // Lights down the lane, and a bright one over the pins (the one that casts the shadows there).
    for (let z = 2; z < 18; z += 5) {
      const l = new THREE.PointLight(0xfff1d6, 6, 9, 1.6);
      l.position.set(0, 2.6, -z);
      scene.add(l);
    }
    const spot = new THREE.SpotLight(0xffffff, 60, 12, 0.5, 0.5, 1.4);
    spot.position.set(0, 3.4, -16.2);
    spot.target.position.set(0, 0, -18.8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(-2, 6, 2);
    sun.target.position.set(0, 0, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -2; sc.right = 2; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 30;
    scene.add(sun, sun.target);

    // The lane (z goes away from you, so the game's z is -z here), the approach, the gutters.
    const lane = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 19.5), new THREE.MeshStandardMaterial({ map: laneTexture(), roughness: 0.25, metalness: 0.05 }));
    lane.position.set(0, -0.03, -19.5 / 2);
    lane.receiveShadow = true;
    const approach = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 4.5), mat(0xb98a55, { roughness: 0.45 }));
    approach.position.set(0, -0.031, 2.25);
    approach.receiveShadow = true;
    const foul = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.002, 0.02), mat(0x111827));
    foul.position.set(0, 0.001, 0);
    scene.add(lane, approach, foul);
    // The gutters: a dark channel either side, a little below the lane, and the caps beyond.
    const gutterMat = mat(0x374151, { metalness: 0.4, roughness: 0.4 });
    [-1, 1].forEach(function (side) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 19.5), gutterMat);
      g.position.set(side * 0.63, -0.07, -19.5 / 2);
      g.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 19.5), mat(0x1f2937));
      cap.position.set(side * 0.88, 0.0, -19.5 / 2);
      cap.receiveShadow = true;
      scene.add(g, cap);
    });
    // The pit, and the masking wall over it.
    const pit = new THREE.Mesh(new THREE.BoxGeometry(2, 0.02, 1.5), mat(0x050505));
    pit.position.set(0, -0.25, -20.2);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.1), mat(0x1e3a8a, { emissive: 0x1e3a8a, emissiveIntensity: 0.35 }));
    mask.position.set(0, 1.2, -19.6);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.1), mat(0x0f172a));
    back.position.set(0, 0.4, -21);
    scene.add(pit, mask, back);
    // Bumpers (shown when they're up).
    gl.bumpers = new THREE.Group();
    [-1, 1].forEach(function (side) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 18.2, 6, 12), mat(0xfacc15, { emissive: 0x854d0e, emissiveIntensity: 0.3 }));
      b.rotation.x = Math.PI / 2;
      b.position.set(side * 0.585, 0.08, -9.5);
      gl.bumpers.add(b);
    });
    scene.add(gl.bumpers);

    // The pins and the ball.
    const geo = pinGeometry();
    const white = mat(0xf8fafc, { roughness: 0.25 });
    const red = mat(0xdc2626, { roughness: 0.3 });
    gl.pins = [];
    for (let i = 0; i < 10; i++) {
      const pin = new THREE.Group();
      const body = new THREE.Mesh(geo, white);
      body.castShadow = body.receiveShadow = true;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0245, 0.012, 20), red);
      stripe.position.y = 0.285;
      const stripe2 = stripe.clone();
      stripe2.position.y = 0.305;
      pin.add(body, stripe, stripe2);
      scene.add(pin);
      gl.pins.push(pin);
    }
    gl.ballMat = new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
    gl.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), gl.ballMat);
    gl.ball.castShadow = true;
    // Finger holes, so you can see it roll.
    [[0, 0.03], [-0.025, -0.02], [0.025, -0.02]].forEach(function (h) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), new THREE.MeshBasicMaterial({ color: 0x0b0f19 }));
      hole.position.set(h[0], h[1], BALL_R + 0.0005);
      gl.ball.add(hole);
    });
    scene.add(gl.ball);
    // A controller player's aim: a line of light from the ball.
    gl.aim = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    gl.aim.rotation.x = -Math.PI / 2;
    gl.aim.visible = false;
    scene.add(gl.aim);
  }

  /** Where the roll is `t` ms in: the ball and each pin, between the two recorded frames around it. */
  function rollAt(roll, t) {
    const fr = roll.frames;
    let k = 0;
    while (k < fr.length - 2 && fr[k + 1].t <= t) k++;
    const a = fr[k];
    const b = fr[Math.min(k + 1, fr.length - 1)];
    const u = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
    const lerp = function (p, q) { return p + (q - p) * u; };
    const pins = {};
    a.p.forEach(function (p, j) {
      const q = b.p[j] || p;
      pins[p[0]] = { x: lerp(p[1], q[1]), z: lerp(p[2], q[2]), fall: u < 0.5 ? p[3] : q[3] };
    });
    return { ball: { x: lerp(a.b[0], b.b[0]), z: lerp(a.b[1], b.b[1]) }, pins: pins };
  }

  function placePin(m, x, z, fall, tip) {
    m.visible = true;
    m.position.set(x, z > 19.45 ? -0.3 : 0, -z);
    m.quaternion.identity();
    if (fall !== null && fall !== undefined && tip > 0) {
      // Over it goes, the way it was knocked (its top towards where it's going).
      const dx = Math.sin(fall);
      const dz = -Math.cos(fall);
      m.quaternion.setFromAxisAngle(new THREE.Vector3(dz, 0, -dx), (Math.PI / 2) * tip);
      m.position.y = 0.05 * tip;
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    if (!gl || !view) return;
    const v = view;
    gl.bumpers.visible = !!v.bumpers;
    gl.ballMat.color.set(colors[v.turn] || '#ffffff');
    let ball = { x: v.stance, z: -0.25 };
    let rolling = false;
    let banner = '';
    if (play && v.phase === 'rolling') {
      const tt = performance.now() - play.start;
      const s = rollAt(play.roll, Math.min(tt, play.roll.ms));
      rolling = tt < play.roll.ms;
      ball = s.ball;
      const shown = {};
      Object.keys(s.pins).forEach(function (i) {
        const p = s.pins[i];
        if (p.fall !== null && play.fallAt[i] === undefined) play.fallAt[i] = tt;
        const tip = play.fallAt[i] === undefined ? 0 : Math.min(1, (tt - play.fallAt[i]) / 260);
        placePin(gl.pins[i], p.x, p.z, p.fall, tip);
        shown[i] = true;
      });
      gl.pins.forEach(function (m, i) { if (!shown[i]) m.visible = false; });
      // The verdict once it's all settled.
      if (!rolling) {
        const last = play.roll.frames[play.roll.frames.length - 1];
        const down = last.p.filter(function (p) { return p[3] !== null; }).length;
        if (down === play.count && play.fresh) banner = '<div class="tp-banner strike">STRIKE!</div>';
        else if (down === play.count) banner = '<div class="tp-banner spare">SPARE!</div>';
        else if (play.roll.gutter) banner = '<div class="tp-banner miss">Gutter ball</div>';
        else banner = '<div class="tp-banner">' + down + (down === 1 ? ' pin' : ' pins') + '</div>';
      }
    } else {
      const up = {};
      (v.standing || []).forEach(function (p) {
        up[p.i] = true;
        placePin(gl.pins[p.i], p.x, p.z, null, 0);
      });
      gl.pins.forEach(function (m, i) { if (!up[i]) m.visible = false; });
    }
    if (banner !== els.banner.dataset.key) {
      els.banner.dataset.key = banner;
      els.banner.innerHTML = banner;
    }
    // The ball: rolling over (about the axis across its path), in the gutter a little lower.
    const prev = gl.ball.position.clone();
    const gutter = Math.abs(ball.x) > 0.53;
    gl.ball.position.set(ball.x, BALL_R - (gutter ? 0.07 : 0), -ball.z);
    gl.ball.visible = ball.z < 20.5;
    const mv = gl.ball.position.clone().sub(prev);
    const d = mv.length();
    if (d > 1e-5 && d < 1) gl.ball.rotateOnWorldAxis(new THREE.Vector3(-mv.z, 0, mv.x).normalize(), -d / BALL_R);
    // A controller player's aim and power.
    const pad = pads[v.turn];
    const aiming = v.phase === 'aim' && pad && pad.active;
    gl.aim.visible = !!aiming;
    let meter = '';
    if (aiming) {
      const a = (pad.aim || 0) * 0.045;
      gl.aim.position.set(ball.x + Math.sin(a) * 2.2, 0.003, -(ball.z + Math.cos(a) * 2.2));
      gl.aim.rotation.z = -a;
      if (pad.charging) {
        const p = powerOf(pad);
        meter = '<div class="tp-meter"><span style="height:' + Math.round(p * 100) + '%"></span></div>' + (Math.abs(pad.spin || 0) > 0.05 ? '<div class="tp-spin">' + (pad.spin > 0 ? 'Spin ↪' : '↩ Spin') + '</div>' : '');
      }
    }
    if (meter !== els.meter.dataset.key) {
      els.meter.dataset.key = meter;
      els.meter.innerHTML = meter;
    }
    // The camera: behind the bowler, then after the ball, then by the pins.
    let want;
    if (v.phase === 'intro' || v.phase === 'over') want = { x: 0.9, y: 2.4, z: 3.8, lx: 0, lz: -12 };
    else if (v.phase === 'rolling') {
      const z = Math.min(ball.z, 14.6);
      want = { x: ball.x * 0.3, y: 1.15 - (z / 14.6) * 0.25, z: -z + 3.2, lx: 0, lz: -z - 8 };
      if (z >= 14.6 || !rolling) want = { x: 0, y: 0.95, z: -14.9, lx: 0, lz: -19.2 };
    } else want = { x: v.stance * 0.6, y: 2.0, z: 3.6, lx: 0, lz: -6 }; // (the ball at the bottom, the pins up the lane)
    const k = Math.min(1, dt * (v.phase === 'rolling' ? 5 : 3));
    Object.keys(want).forEach(function (key) { gl.cam[key] += (want[key] - gl.cam[key]) * k; });
    gl.camera.position.set(gl.cam.x, gl.cam.y, gl.cam.z);
    gl.camera.lookAt(gl.cam.lx, 0, gl.cam.lz);
    gl.renderer.render(gl.scene, gl.camera);
  }

  function resize() {
    if (!gl || !els) return;
    const r = els.arena.getBoundingClientRect();
    const W = Math.max(1, Math.floor(r.width));
    const H = Math.max(1, Math.floor(r.height));
    gl.renderer.setSize(W, H);
    gl.camera.aspect = W / H;
    gl.camera.updateProjectionMatrix();
  }

  // ---- controllers ----

  function powerOf(pad) {
    const u = ((performance.now() - pad.t0) / METER_MS) % 2;
    return Math.round((u <= 1 ? u : 2 - u) * 100) / 100;
  }

  /**
   * Read every frame: the stick (or ←→) moves you and ↑↓ turns your aim; hold A to fill the meter,
   * the stick sideways for spin, let go to bowl.
   */
  function padPoll(raw, v, slot) {
    if (!pads[slot]) pads[slot] = { stance: 0, aim: 0, charging: false, t0: 0, n: 0, spin: 0, active: false };
    const p = pads[slot];
    if (v.phase !== 'aim' || v.turn !== slot) {
      p.charging = false;
      p.active = false;
      p.synced = false;
      return null;
    }
    if (!p.synced) {
      p.stance = v.stance;
      p.aim = 0;
      p.synced = true;
    }
    p.active = true;
    const held = raw.held;
    const sx = Math.abs(raw.stick.x) < DEADZONE ? 0 : raw.stick.x;
    const sy = Math.abs(raw.stick.y) < DEADZONE ? 0 : raw.stick.y;
    const lr = held.indexOf('LEFT') !== -1 ? -1 : held.indexOf('RIGHT') !== -1 ? 1 : sx;
    const ud = held.indexOf('UP') !== -1 ? -1 : held.indexOf('DOWN') !== -1 ? 1 : sy;
    const a = held.indexOf('A') !== -1 || held.indexOf('RT') !== -1;
    if (a) {
      if (!p.charging) {
        p.charging = true;
        p.t0 = performance.now();
      }
      p.spin = Math.round(lr * 10) / 10;
      return null;
    }
    if (p.charging) {
      p.charging = false;
      p.n++;
      return { type: 'throw', stance: p.stance, aim: Math.round(p.aim * 100) / 100, power: powerOf(p), spin: p.spin, n: p.n };
    }
    p.stance = Math.max(-v.lane.maxStance, Math.min(v.lane.maxStance, p.stance + lr * 0.008));
    p.aim = Math.max(-1, Math.min(1, p.aim + ud * 0.015));
    return { type: 'stance', x: Math.round(p.stance * 100) / 100 };
  }

  Ark.register('host', 'ten-pin', {
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'rolling' && prev.phase !== 'rolling') out.push('whoosh');
      if (prev.phase === 'rolling' && v.phase !== 'rolling' && v.last) {
        if (v.last.kind === 'strike') out.push('fanfare');
        else if (v.last.kind === 'spare') out.push('correct');
        else if (v.last.count > 0) out.push('crash');
        else out.push('wrong');
      }
      return out;
    },
    padHint: 'Stick ←→ moves you, ↑↓ aims · hold A for power, let go to bowl (stick sideways as you let go for spin) · A: rematch at the end',
    padPoll: padPoll,
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return null; // bowling is read every frame by padPoll
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'tp-host';
      root.innerHTML = '<div class="tp-top"></div><div class="tp-arena"><div class="tp-banner-box"></div><div class="tp-meter-box"></div><div class="tp-over hidden"></div></div>';
      el.appendChild(root);
      els = { card: root.querySelector('.tp-top'), arena: root.querySelector('.tp-arena'), overlay: root.querySelector('.tp-over'), banner: root.querySelector('.tp-banner-box'), meter: root.querySelector('.tp-meter-box') };
      const mounted = root;
      loadThree().then(function () {
        if (root !== mounted) return;
        try {
          setupGl();
          resize();
        } catch (e) {
          els.overlay.innerHTML = '<div class="sub">3D isn\'t available: this browser couldn\'t start WebGL.</div>';
          els.overlay.classList.remove('hidden');
          overlayKey = 'error';
        }
      }).catch(function () {
        if (!els) return;
        els.overlay.innerHTML = '<div class="sub">Couldn\'t load the 3D engine.</div>';
        els.overlay.classList.remove('hidden');
        overlayKey = 'error';
      });
      if (window.ResizeObserver) {
        fit = new ResizeObserver(resize);
        fit.observe(els.arena);
      } else {
        window.addEventListener('resize', resize);
      }
      if (view) render(view);
      raf = requestAnimationFrame(frame);
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (fit) fit.disconnect();
      fit = null;
      if (gl) {
        gl.scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.map) o.material.map.dispose();
          if (o.material) o.material.dispose();
        });
        gl.renderer.dispose();
        if (gl.renderer.forceContextLoss) gl.renderer.forceContextLoss();
      }
      gl = null;
      root = els = view = play = null;
      cardKey = overlayKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
