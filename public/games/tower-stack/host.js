// Tower Stack on the TV, in 3D with three.js. The server (server/games/tower-stack.js) decides
// every drop; this draws the tower (a colour a floor, slowly shifting up the rainbow), the block
// sliding over the top (moved here on the TV's own clock, from how far along the server said it
// was), the pieces that get cut off tumbling away, and a flash for a perfect drop. The camera
// climbs with the tower and pulls back to show it all at the end.
(function () {
  Ark.loadCss('/games/tower-stack/style.css');
  const esc = Ark.escapeHtml;
  const H = 1; // a floor's height

  let THREE = null;
  let threeReady = null;
  function loadThree() {
    if (!threeReady) threeReady = import('/vendor/three/three.module.min.js').then(function (m) { THREE = m; });
    return threeReady;
  }

  let root = null;
  let els = null;
  let view = null;
  let viewAt = 0;
  let gl = null;
  let raf = null;
  let fit = null;
  let hudKey = '';
  let overlayKey = '';
  let lastFrame = 0;
  let colors = null;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  /** A floor's colour: round the rainbow slowly as the tower grows. */
  function floorColor(i) {
    const c = new THREE.Color();
    c.setHSL(((i * 0.023) + 0.55) % 1, 0.55, 0.55);
    return c;
  }

  function offsetAt(ms, speed, amp) {
    const d = ((ms / 1000) * speed) % (4 * amp);
    return d <= 2 * amp ? -amp + d : 3 * amp - d;
  }

  // ---- HUD and overlay ----

  function renderHud(v) {
    const hearts = '❤️'.repeat(Math.max(0, v.lives)) + '🖤'.repeat(Math.max(0, v.maxLives - v.lives));
    const stars = v.targets.map(function (t) { return '<span class="' + (v.height >= t ? 'got' : '') + '">⭐ ' + t + '</span>'; }).join('');
    const who = v.phase === 'drop' || v.phase === 'settle'
      ? nameOf(v, v.turn) + ' drops ' + (v.move ? (v.move.axis === 'x' ? '↔' : '↕') : '')
      : '';
    const html = '<div class="ts-side"><div class="ts-height">' + v.height + '</div><div class="ts-label">floors</div></div>' +
      '<div class="ts-mid"><div class="ts-who">' + who + '</div><div class="ts-combo">' + (v.combo >= 2 ? '✨ Perfect ×' + v.combo + (v.combo >= 3 ? ' · growing' : '') : '') + '</div></div>' +
      '<div class="ts-side right"><div class="ts-hearts">' + hearts + '</div><div class="ts-stars">' + stars + '</div></div>';
    if (html === hudKey) return;
    hudKey = html;
    els.hud.innerHTML = html;
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'intro') {
      html = '<div class="panel"><div class="big">🏗️ Tower Stack</div><div class="sub">Take turns: ' + nameOf(v, 0) + ' drops the blocks sliding ↔, ' + nameOf(v, 1) + ' the ones sliding ↕.<br>' +
        'Whatever hangs over the edge is cut off. Dead on keeps it whole; three in a row and it grows back.</div></div>';
    } else if (v.phase === 'over') {
      html = '<div class="panel"><div class="big">' + (v.stars ? '⭐'.repeat(v.stars) : '🏚️') + '</div><div class="sub"><strong>' + v.height + '</strong> floors' +
        (v.bestCombo >= 3 ? ' · best streak ' + v.bestCombo + ' perfect' : '') + '<br>' + nameOf(v, 0) + ' & ' + nameOf(v, 1) + ', rematch or head back to the lobby from your phones or controllers.</div></div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    els.overlay.innerHTML = html;
    els.overlay.classList.toggle('hidden', !html);
  }

  function render(v) {
    const prev = view;
    view = v;
    viewAt = performance.now();
    if (!els) return;
    renderHud(v);
    renderOverlay(v);
    if (gl) syncTower(v, prev);
  }

  // ---- the 3D scene ----

  function setupGl() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    els.arena.insertBefore(renderer.domElement, els.arena.firstChild);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -12;
    sc.right = sc.top = 12;
    sc.near = 1;
    sc.far = 60;
    scene.add(sun, sun.target);
    // The ground: a soft disc under the tower.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -H;
    ground.receiveShadow = true;
    scene.add(ground);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    gl = { renderer: renderer, scene: scene, camera: camera, sun: sun, geo: geo, blocks: [], moving: null, falling: [], flashes: [], camY: 1, camD: 24, lastN: 0 };
    gl.moving = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    gl.moving.castShadow = true;
    gl.moving.visible = false;
    scene.add(gl.moving);
  }

  function blockMesh(r, y, color) {
    const m = new THREE.Mesh(gl.geo, new THREE.MeshStandardMaterial({ color: color, roughness: 0.45 }));
    m.castShadow = m.receiveShadow = true;
    place(m, r, y);
    gl.scene.add(m);
    return m;
  }

  function place(m, r, y) {
    m.scale.set(Math.max(0.01, r.x1 - r.x0), H, Math.max(0.01, r.z1 - r.z0));
    m.position.set((r.x0 + r.x1) / 2, y + H / 2, (r.z0 + r.z1) / 2);
  }

  /** The tower to match the view: new floors added, all of it rebuilt after a rematch. */
  function syncTower(v, prev) {
    if (v.floors.length < gl.blocks.length || (prev && v.height < prev.height)) {
      gl.blocks.forEach(function (m) { gl.scene.remove(m); m.material.dispose(); });
      gl.blocks = [];
    }
    for (let i = gl.blocks.length; i < v.floors.length; i++) gl.blocks.push(blockMesh(v.floors[i], (i - 1) * H, i === 0 ? 0x475569 : floorColor(i)));
    // What just happened: a piece cut off (or the whole block missed) falls; a perfect one flashes.
    const last = v.last;
    if (!last) gl.lastN = 0; // (a fresh tower)
    if (last && last.n !== gl.lastN) {
      const animate = gl.lastN !== 0 || !!prev; // (not for what had already happened when the TV joined)
      gl.lastN = last.n;
      if (animate) {
        const y = (last.kind === 'miss' ? v.height : v.height - 1) * H;
        if (last.piece) {
          const m = blockMesh(last.piece, y, last.kind === 'miss' ? floorColor(v.height + 1) : floorColor(v.height));
          const out = new THREE.Vector3(m.position.x, 0, m.position.z).normalize();
          gl.falling.push({ m: m, vx: out.x * 2, vz: out.z * 2, vy: 1, spin: new THREE.Vector3(out.z, 0, -out.x).multiplyScalar(3), t: 0 });
        }
        if (last.kind === 'perfect') {
          const top = v.floors[v.floors.length - 1];
          const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
          ring.rotation.x = -Math.PI / 2;
          ring.scale.set(top.x1 - top.x0 + 0.3, top.z1 - top.z0 + 0.3, 1);
          ring.position.set((top.x0 + top.x1) / 2, (v.height - 1) * H + H / 2 + 0.01, (top.z0 + top.z1) / 2);
          gl.scene.add(ring);
          gl.flashes.push({ m: ring, t: 0 });
        }
      }
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    if (!gl || !view) return;
    const v = view;
    // The sliding block, on the TV's clock from where the server said it was.
    if (v.phase === 'drop' && v.move) {
      const top = v.floors[v.floors.length - 1];
      const off = offsetAt(v.move.elapsed + (performance.now() - viewAt), v.move.speed, v.move.amp);
      const r = v.move.axis === 'x' ? { x0: top.x0 + off, x1: top.x1 + off, z0: top.z0, z1: top.z1 } : { x0: top.x0, x1: top.x1, z0: top.z0 + off, z1: top.z1 + off };
      place(gl.moving, r, v.height * H);
      gl.moving.material.color.copy(floorColor(v.height + 1));
      gl.moving.material.emissive = gl.moving.material.emissive || new THREE.Color();
      gl.moving.material.emissive.set(colors[v.turn]).multiplyScalar(0.25);
      gl.moving.visible = true;
    } else gl.moving.visible = false;
    // Falling pieces: gravity and a tumble, then gone.
    gl.falling = gl.falling.filter(function (f) {
      f.t += dt;
      f.vy -= 18 * dt;
      f.m.position.x += f.vx * dt;
      f.m.position.z += f.vz * dt;
      f.m.position.y += f.vy * dt;
      f.m.rotation.x += f.spin.x * dt;
      f.m.rotation.z += f.spin.z * dt;
      if (f.t < 2.5) return true;
      gl.scene.remove(f.m);
      f.m.material.dispose();
      return false;
    });
    gl.flashes = gl.flashes.filter(function (f) {
      f.t += dt;
      f.m.material.opacity = Math.max(0, 0.8 - f.t * 1.6);
      f.m.scale.multiplyScalar(1 + dt * 0.6);
      if (f.t < 0.5) return true;
      gl.scene.remove(f.m);
      f.m.geometry.dispose();
      f.m.material.dispose();
      return false;
    });
    // The camera climbs with the tower; at the end it pulls back to show the whole thing.
    const over = v.phase === 'over';
    const wantY = over ? Math.max(4, v.height * H * 0.55) : v.height * H + 1;
    const wantD = over ? Math.max(24, v.height * H * 1.3 + 12) : 24; // (far enough to see the block slide out either side)
    const k = Math.min(1, dt * 2.5);
    gl.camY += (wantY - gl.camY) * k;
    gl.camD += (wantD - gl.camD) * k;
    const a = over ? t / 4000 : Math.PI / 4;
    gl.camera.position.set(Math.cos(a) * gl.camD * 0.7, gl.camY + gl.camD * 0.5, Math.sin(a) * gl.camD * 0.7);
    gl.camera.lookAt(0, gl.camY - (over ? 0 : 3), 0);
    gl.sun.position.set(8, gl.camY + 14, 6);
    gl.sun.target.position.set(0, gl.camY - 4, 0);
    gl.renderer.render(gl.scene, gl.camera);
  }

  function resize() {
    if (!gl || !els) return;
    const r = els.arena.getBoundingClientRect();
    const W = Math.max(1, Math.floor(r.width));
    const Hh = Math.max(1, Math.floor(r.height));
    gl.renderer.setSize(W, Hh);
    gl.camera.aspect = W / Hh;
    gl.camera.updateProjectionMatrix();
  }

  Ark.register('host', 'tower-stack', {
    sounds: function (prev, v) {
      const out = [];
      if (prev.phase === 'intro' && v.phase === 'drop') out.push('go');
      if (v.last && (!prev.last || prev.last.n !== v.last.n)) out.push(v.last.kind === 'perfect' ? 'correct' : v.last.kind === 'miss' ? 'crash' : 'paddle');
      return out;
    },
    padHint: 'A drops the block (on your turn) · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return btn === 'A' || btn === 'RT' ? { type: 'drop' } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'ts-host';
      root.innerHTML = '<div class="ts-hud"></div><div class="ts-arena"><div class="ts-over hidden"></div></div>';
      el.appendChild(root);
      els = { hud: root.querySelector('.ts-hud'), arena: root.querySelector('.ts-arena'), overlay: root.querySelector('.ts-over') };
      const mounted = root;
      loadThree().then(function () {
        if (root !== mounted) return;
        try {
          setupGl();
          resize();
          if (view) syncTower(view, null);
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
          if (o.material) o.material.dispose();
        });
        gl.geo.dispose();
        gl.renderer.dispose();
        if (gl.renderer.forceContextLoss) gl.renderer.forceContextLoss();
      }
      gl = null;
      root = els = view = null;
      hudKey = overlayKey = '';
    },
  });
})();
