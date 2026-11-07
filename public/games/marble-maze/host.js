// Marble Maze on the TV, in 3D with three.js (served by the hub at /vendor/three/).
// The server runs the physics; this draws the board tilting and the marble
// rolling, smoothing between views so it moves at the screen's frame rate.
(function () {
  Ark.loadCss('/games/marble-maze/style.css');
  const esc = Ark.escapeHtml;
  const MAX_TILT = 0.17; // radians at full tilt (~10°)
  const MARBLE_R = 0.3;
  const HOLE_R = 0.36;
  const WALL_H = 0.6;
  const DEADZONE = 0.2;

  let THREE = null;
  let threeReady = null;
  /** three.js, loaded the first time the game is shown. */
  function loadThree() {
    if (!threeReady) threeReady = import('/vendor/three/three.module.min.js').then(function (m) { THREE = m; });
    return threeReady;
  }

  let root = null;
  let els = null;
  let view = null;
  let viewAt = 0;
  let textKey = '';
  let raf = null;
  let lastFrame = 0;
  let fit = null; // ResizeObserver on the arena
  let gl = null; // { renderer, scene, camera, board, marble, goal, levelName, ... }
  const shown = { x: 0, y: 0, z: 0, tx: 0, ty: 0 };

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function time(ms) {
    const s = ms / 1000;
    return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');
  }

  function stars(n) {
    return n ? new Array(n + 1).join('⭐') : '—';
  }

  // ---- the 3D scene ----

  function setupGl() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    els.arena.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b16, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    scene.add(sun.target);
    gl = { renderer: renderer, scene: scene, camera: camera, sun: sun, board: null, marble: null, goal: null, levelName: null };
  }

  /** Build the board for a level: base, walls, holes, the goal and the marble. */
  function buildBoard(level) {
    if (gl.board) {
      gl.scene.remove(gl.board);
      gl.board.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    }
    const w = level.w;
    const h = level.h;
    const board = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xc8955c, roughness: 0.75 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, h), wood);
    base.position.y = -0.2;
    base.receiveShadow = true;
    board.add(base);
    // Walls: one instanced box per '#'.
    const cells = [];
    level.map.forEach(function (row, y) { for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push([x, y]); });
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.3 }), cells.length);
    const m4 = new THREE.Matrix4();
    cells.forEach(function (c, i) {
      m4.makeTranslation(c[0] + 0.5 - w / 2, WALL_H / 2, c[1] + 0.5 - h / 2);
      walls.setMatrixAt(i, m4);
    });
    walls.castShadow = walls.receiveShadow = true;
    board.add(walls);
    // Holes: dark wells with a rim.
    const holeGeo = new THREE.CircleGeometry(HOLE_R, 32);
    const rimGeo = new THREE.RingGeometry(HOLE_R, HOLE_R + 0.06, 32);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x3f2a14 });
    level.map.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'O' && row[x] !== 'G' && row[x] !== 'S') continue;
        const px = x + 0.5 - w / 2;
        const pz = y + 0.5 - h / 2;
        if (row[x] === 'O') {
          const hole = new THREE.Mesh(holeGeo, holeMat);
          hole.rotation.x = -Math.PI / 2;
          hole.position.set(px, 0.005, pz);
          const rim = new THREE.Mesh(rimGeo, rimMat);
          rim.rotation.x = -Math.PI / 2;
          rim.position.set(px, 0.006, pz);
          board.add(hole, rim);
        } else if (row[x] === 'G') {
          const goal = new THREE.Group();
          const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.8 }));
          pad.rotation.x = -Math.PI / 2;
          pad.position.y = 0.006;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 12, 40), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.7 }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.05;
          goal.add(pad, ring);
          goal.position.set(px, 0, pz);
          gl.goal = ring;
          board.add(goal);
        } else {
          const start = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
          start.rotation.x = -Math.PI / 2;
          start.position.set(px, 0.006, pz);
          board.add(start);
        }
      }
    });
    // The moving parts: sliding blocks on their grooves, belts, the button and its gate.
    gl.movers = [];
    gl.belts = [];
    gl.gates = [];
    gl.button = null;
    const BELT = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
    const groove = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.5 });
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.16, -0.2); arrowShape.lineTo(0.12, 0); arrowShape.lineTo(-0.16, 0.2); arrowShape.lineTo(-0.06, 0); arrowShape.lineTo(-0.16, -0.2);
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    level.map.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        const px = x + 0.5 - w / 2;
        const pz = y + 0.5 - h / 2;
        if (c === '=') {
          const g = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), groove);
          g.rotation.x = -Math.PI / 2;
          g.position.set(px, 0.004, pz);
          board.add(g);
          if (row[x - 1] !== '=') {
            const block = new THREE.Mesh(new THREE.BoxGeometry(0.96, WALL_H, 0.96),
              new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4, metalness: 0.2 }));
            block.castShadow = block.receiveShadow = true;
            block.position.set(px, WALL_H / 2, pz);
            board.add(block);
            gl.movers.push(block);
          }
        } else if (BELT[c]) {
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), beltMat);
          plate.rotation.x = -Math.PI / 2;
          plate.position.set(px, 0.003, pz);
          plate.receiveShadow = true;
          const arrow = new THREE.Mesh(arrowGeo, arrowMat);
          arrow.rotation.x = -Math.PI / 2;
          arrow.rotation.z = -Math.atan2(BELT[c][1], BELT[c][0]);
          arrow.position.set(px, 0.008, pz);
          board.add(plate, arrow);
          gl.belts.push({ mesh: arrow, x: px, z: pz, d: BELT[c] });
        } else if (c === 'b') {
          const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 28),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x7f1d1d, emissiveIntensity: 0.6 }));
          btn.position.set(px, 0.06, pz);
          btn.castShadow = true;
          board.add(btn);
          gl.button = btn;
        } else if (c === 'D') {
          const gate = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_H, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.4 }));
          gate.position.set(px, WALL_H / 2, pz);
          gate.castShadow = true;
          board.add(gate);
          gl.gates.push(gate);
        }
      }
    });
    const marble = new THREE.Mesh(new THREE.SphereGeometry(MARBLE_R, 32, 20),
      new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.65, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }));
    // A stripe so you can see it roll.
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(MARBLE_R * 1.002, 0.03, 8, 40), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    marble.add(stripe);
    marble.castShadow = true;
    board.add(marble);
    gl.scene.add(board);
    gl.board = board;
    gl.marble = marble;
    gl.levelName = level.name;
    gl.size = { w: w, h: h };
    gl.sun.shadow.camera.left = gl.sun.shadow.camera.bottom = -Math.max(w, h);
    gl.sun.shadow.camera.right = gl.sun.shadow.camera.top = Math.max(w, h);
    gl.sun.shadow.camera.updateProjectionMatrix();
    resize();
  }

  /** Fit the renderer to the arena and the camera to the board (seen from the front, a little above). */
  function resize() {
    if (!gl || !els) return;
    const r = els.arena.getBoundingClientRect();
    const W = Math.max(1, Math.floor(r.width));
    const H = Math.max(1, Math.floor(r.height));
    gl.renderer.setSize(W, H);
    gl.camera.aspect = W / H;
    const size = gl.size || { w: 13, h: 9 };
    const fit = Math.max(size.h * 1.15, (size.w * 1.1) / gl.camera.aspect);
    const dist = fit / (2 * Math.tan((gl.camera.fov * Math.PI) / 360));
    gl.camera.position.set(0, dist * 0.86, dist * 0.52);
    gl.camera.lookAt(0, 0, 0.3);
    gl.camera.updateProjectionMatrix();
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    if (!gl || !view || !gl.board) return;
    const v = view;
    const m = v.marble;
    // Where the marble should be now: the last view, moved on by its speed.
    const ahead = v.phase === 'play' ? Math.min(0.1, (performance.now() - viewAt) / 1000) : 0;
    const k = Math.min(1, dt * 18);
    const prevX = shown.x;
    const prevY = shown.y;
    shown.x += (m.x + m.vx * ahead - shown.x) * k;
    shown.y += (m.y + m.vy * ahead - shown.y) * k;
    shown.z += (m.z - shown.z) * k;
    shown.tx += (v.tilt.x - shown.tx) * k;
    shown.ty += (v.tilt.y - shown.ty) * k;
    gl.board.rotation.set(shown.ty * MAX_TILT, 0, -shown.tx * MAX_TILT);
    gl.marble.position.set(shown.x - gl.size.w / 2, MARBLE_R - shown.z * 0.9, shown.y - gl.size.h / 2);
    // Roll: turn about the axis across the direction of travel.
    const dx = shown.x - prevX;
    const dz = shown.y - prevY;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-5) {
      const axis = new THREE.Vector3(dz, 0, -dx).normalize();
      gl.marble.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, dist / MARBLE_R));
    }
    gl.marble.visible = shown.z < 0.95;
    if (gl.goal) gl.goal.scale.setScalar(1 + 0.08 * Math.sin(t / 220));
    // Sliding blocks follow the server; belt arrows creep along; the gate sinks once it's open.
    (v.movers || []).forEach(function (mv, i) {
      const b = gl.movers[i];
      if (!b) return;
      const tx = mv.x + 0.5 - gl.size.w / 2;
      b.position.x += (tx - b.position.x) * k;
    });
    const creep = ((t / 1000) * 0.8) % 1 - 0.5;
    gl.belts.forEach(function (b) {
      b.mesh.position.x = b.x + b.d[0] * creep * 0.6;
      b.mesh.position.z = b.z + b.d[1] * creep * 0.6;
    });
    gl.gates.forEach(function (g) {
      const y = v.gateOpen ? -WALL_H / 2 + 0.01 : WALL_H / 2;
      g.position.y += (y - g.position.y) * Math.min(1, dt * 5);
    });
    if (gl.button) {
      gl.button.position.y = v.gateOpen ? 0.02 : 0.06;
      gl.button.material.color.setHex(v.gateOpen ? 0x22c55e : 0xdc2626);
      gl.button.material.emissive.setHex(v.gateOpen ? 0x15803d : 0x7f1d1d);
    }
    gl.renderer.render(gl.scene, gl.camera);
    els.clock.textContent = time(v.phase === 'play' || v.phase === 'fall' ? v.elapsedMs + (performance.now() - viewAt) : v.elapsedMs);
  }

  // ---- the HUD and messages ----

  function overlayHtml(v) {
    if (v.phase === 'intro') {
      return '<div class="panel"><div class="title">Maze ' + (v.levelIndex + 1) + ' · ' + esc(v.level.name) + '</div>' +
        (v.level.tip ? '<p>' + esc(v.level.tip) + '</p>' : '') + '<p>Par ' + time(v.level.parMs) + ' for ⭐⭐⭐</p><div class="count">' + v.countdown + '</div></div>';
    }
    if (v.phase === 'fall') return '<div class="banner">' + (v.fallBy === 'block' ? '💥 Squashed! Back to the start…' : '🕳️ Down the hole! Back to the start…') + '</div>';
    if (v.phase === 'clear' && v.result) {
      return v.result.cleared
        ? '<div class="panel won"><div class="title">🎉 Made it!</div><p>' + time(v.result.ms) + (v.result.falls ? ' · ' + v.result.falls + ' fall' + (v.result.falls > 1 ? 's' : '') : '') + '</p><div class="stars">' + stars(v.result.stars) + '</div></div>'
        : '<div class="panel"><div class="title">⏱ Out of time</div><p>On to the next maze.</p></div>';
    }
    if (v.phase === 'over') {
      return '<div class="panel"><div class="title">' + v.stars + ' of ' + v.maxStars + ' ⭐</div><table>' +
        v.history.map(function (h) {
          return '<tr><td>' + esc(h.name) + '</td><td>' + (h.cleared ? time(h.ms) : 'out of time') + '</td><td>' + stars(h.stars) + '</td></tr>';
        }).join('') + '</table><p class="muted">Rematch on a phone or with A (or ⚙ change the settings).</p></div>';
    }
    return '';
  }

  function axisText(axis) {
    return axis === 'x' ? '↔ left / right' : axis === 'y' ? '↕ forwards / back' : '✥ everything';
  }

  function render(v) {
    view = v;
    viewAt = performance.now();
    if (gl && v.level.name !== gl.levelName) {
      buildBoard(v.level);
      shown.x = v.marble.x;
      shown.y = v.marble.y;
    }
    const key = JSON.stringify([v.phase, v.levelIndex, v.countdown, v.falls, v.result, v.stars]);
    if (key === textKey) return;
    textKey = key;
    root.className = 'mm-host phase-' + v.phase;
    els.top.innerHTML =
      '<span>🟢 Maze ' + (v.levelIndex + 1) + ' / ' + v.levels + ' <span class="muted">· ' + esc(v.level.name) + '</span></span>' +
      '<span class="muted">par ' + time(v.level.parMs) + (v.falls ? ' · 🕳️ ' + v.falls : '') + '</span>' +
      '<span class="stars">' + v.stars + ' ⭐</span>';
    els.who.innerHTML = nameOf(v, 0) + ' tilts ' + axisText(v.axes[0]) + ' · ' + nameOf(v, 1) + ' tilts ' + axisText(v.axes[1]);
    els.overlay.innerHTML = overlayHtml(v);
  }

  // Controllers: the left stick (or D-pad) tilts the board.
  function padPoll(pad) {
    function dz(a) {
      return Math.abs(a) < DEADZONE ? 0 : (a - Math.sign(a) * DEADZONE) / (1 - DEADZONE);
    }
    let x = dz(pad.stick.x);
    let y = dz(pad.stick.y);
    if (pad.held.indexOf('LEFT') !== -1) x = -1;
    if (pad.held.indexOf('RIGHT') !== -1) x = 1;
    if (pad.held.indexOf('UP') !== -1) y = -1;
    if (pad.held.indexOf('DOWN') !== -1) y = 1;
    return { type: 'move', x: Math.round(x * 20) / 20, y: Math.round(y * 20) / 20 };
  }

  Ark.register('host', 'marble-maze', {
    padHint: 'Left stick or D-pad tilts the board',
    padPoll: padPoll,
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    // A plop into a hole, a chime at the goal.
    sounds: function (prev, v) {
      if (v.phase === 'fall' && prev.phase !== 'fall') return ['drop'];
      if (v.phase === 'clear' && prev.phase !== 'clear') return [v.result && v.result.cleared ? 'correct' : 'wrong'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mm-host';
      root.innerHTML = '<div class="mm-top"></div><div class="mm-arena"><div class="mm-clock">0:00.0</div><div class="mm-overlay"></div></div><div class="mm-who"></div>';
      el.appendChild(root);
      els = {
        top: root.querySelector('.mm-top'),
        arena: root.querySelector('.mm-arena'),
        clock: root.querySelector('.mm-clock'),
        overlay: root.querySelector('.mm-overlay'),
        who: root.querySelector('.mm-who'),
      };
      const mounted = root;
      loadThree().then(function () {
        if (root !== mounted) return;
        try {
          setupGl();
        } catch (e) {
          els.overlay.innerHTML = '<div class="panel"><div class="title">3D isn\'t available</div><p>This browser couldn\'t start WebGL.</p></div>';
          return;
        }
        if (view) {
          textKey = '';
          render(view);
        }
      }).catch(function () {
        els.overlay.innerHTML = '<div class="panel"><div class="title">Couldn\'t load the 3D engine</div></div>';
      });
      if (window.ResizeObserver) {
        fit = new ResizeObserver(resize);
        fit.observe(els.arena);
      } else {
        window.addEventListener('resize', resize);
      }
      raf = requestAnimationFrame(frame);
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (fit) fit.disconnect();
      fit = null;
      if (gl) {
        gl.renderer.dispose();
        if (gl.renderer.forceContextLoss) gl.renderer.forceContextLoss();
      }
      gl = null;
      root = els = view = null;
      textKey = '';
    },
  });
})();
