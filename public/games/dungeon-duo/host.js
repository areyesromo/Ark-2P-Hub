// Dungeon Duo on the TV, in 3D with three.js (served by the hub at /vendor/three/). The server
// (server/games/dungeon-duo.js) runs everything; this draws the floor (walls, doors, keys, the
// stairs, spikes, plates and gates), the two heroes in your colours, the enemies, bolts and healing circles, with a camera
// that follows you both. Soft shadows from above, and each hero carries a lantern; the walls
// are one instanced mesh, the floor one textured plane.
(function () {
  Ark.loadCss('/games/dungeon-duo/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.2;
  const WALL_H = 1.1;

  let THREE = null;
  let threeReady = null;
  function loadThree() {
    if (!threeReady) threeReady = import('/vendor/three/three.module.min.js').then(function (m) { THREE = m; });
    return threeReady;
  }

  let root = null;
  let els = null;
  let view = null;
  let hudKey = '';
  let overlayKey = '';
  let raf = null;
  let lastFrame = 0;
  let fit = null;
  let gl = null;
  let colors = null;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function clock(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  // ---- HUD and overlays (HTML) ----

  function hearts(h) {
    let s = '';
    for (let i = 0; i < h.max; i++) s += i < h.hp ? '❤️' : '🖤';
    return s;
  }

  function renderHud(v) {
    const side = function (slot) {
      const h = v.heroes[slot];
      const role = h.role === 'fighter' ? '🛡️ Fighter' : '✨ Healer';
      return '<div class="dd-side p' + (slot + 1) + (h.downed ? ' down' : '') + '"><div class="name">' + nameOf(v, slot) + ' <small>' + role + '</small></div>' +
        '<div class="hearts">' + hearts(h) + '</div>' + (h.downed ? '<div class="note">Down! Stand by them to revive</div>' : '') + '</div>';
    };
    const html = side(0) + '<div class="dd-mid"><div class="floor">' + esc(v.floorName) + ' · floor ' + (v.floor + 1) + ' of ' + v.floors + '</div>' +
      '<div class="stats">🗝️ ' + v.keys + ' · continues ' + v.continues + ' · ' + clock(v.timeMs) + '</div></div>' + side(1);
    if (html === hudKey) return;
    hudKey = html;
    els.hud.innerHTML = html;
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'countdown') {
      html = '<div class="big">' + (v.countdown || '') + '</div><div class="sub">' + esc(v.floorName) + ': find the key, open the door, take the stairs down together</div>';
    } else if (v.phase === 'retry') {
      html = '<div class="big">💀</div><div class="sub">You both went down. Back to the start of the floor (' + v.continues + ' continue' + (v.continues === 1 ? '' : 's') + ' left)</div>';
    } else if (v.phase === 'floorClear') {
      html = '<div class="big">⬇️</div><div class="sub">' + esc(v.floorName) + ' cleared!' + (v.floor + 1 < v.floors ? ' Down you go…' : '') + '</div>';
    } else if (v.phase === 'over') {
      html = '<div class="big">' + (v.won ? '⭐'.repeat(v.stars) : '💀') + '</div><div class="sub">' +
        (v.won ? 'Quest complete in ' + clock(v.timeMs) + (v.retries ? ' (' + v.retries + ' retr' + (v.retries === 1 ? 'y' : 'ies') + ')' : ', not one retry') : 'Out of continues: the dungeon wins this time') +
        '<br>' + nameOf(v, 0) + ' & ' + nameOf(v, 1) + ', rematch or head back to the lobby from your phones or controllers.</div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    els.overlay.innerHTML = html;
    els.overlay.classList.toggle('hidden', !html);
  }

  // ---- the 3D scene ----

  function setupGl() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0f19);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    els.arena.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0f19, 14, 30);
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfde68a, 0x111827, 0.8));
    // The light from above follows the camera, so its shadow map stays sharp around the heroes.
    const sun = new THREE.DirectionalLight(0xfff7ed, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -14;
    sc.right = sc.top = 14;
    sc.near = 1;
    sc.far = 40;
    scene.add(sun, sun.target);
    gl = { renderer: renderer, scene: scene, camera: camera, sun: sun, level: null, things: null, mapKey: '', heroes: null, enemies: {}, shots: [], bones: [], circles: [], cam: { x: 0, z: 0, d: 10 }, spikeY: -0.3, gateY: 0 };
  }

  function mat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.8 }, extra || {}));
  }

  /** A stone floor texture (drawn once per floor). */
  function stoneTexture(w, h) {
    const c = document.createElement('canvas');
    const S = 96; // pixels a tile
    c.width = w * S;
    c.height = h * S;
    const g = c.getContext('2d');
    let seed = 7;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const shade = 70 + ((x * 7 + y * 13) % 5) * 6;
        g.fillStyle = 'rgb(' + shade + ',' + (shade - 4) + ',' + (shade - 10) + ')';
        g.fillRect(x * S, y * S, S, S);
        // Speckles and a crack or two, so the stone isn't flat.
        for (let i = 0; i < 60; i++) {
          const d = (rnd() - 0.5) * 30;
          g.fillStyle = 'rgba(' + (d > 0 ? '255,240,220,' : '0,0,0,') + (Math.abs(d) / 120).toFixed(3) + ')';
          g.fillRect(x * S + rnd() * S, y * S + rnd() * S, 2 + rnd() * 5, 2 + rnd() * 5);
        }
        if (rnd() < 0.3) {
          g.strokeStyle = 'rgba(0,0,0,0.3)';
          g.lineWidth = 1.5;
          g.beginPath();
          let cx = x * S + rnd() * S;
          let cy = y * S + rnd() * S;
          g.moveTo(cx, cy);
          for (let i = 0; i < 4; i++) g.lineTo((cx += (rnd() - 0.5) * 30), (cy += (rnd() - 0.5) * 30));
          g.stroke();
        }
        g.strokeStyle = 'rgba(0,0,0,0.45)';
        g.lineWidth = 3;
        g.strokeRect(x * S + 1.5, y * S + 1.5, S - 3, S - 3);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = gl.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function disposeGroup(group) {
    gl.scene.remove(group);
    group.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  /** The floor's walls and stone: rebuilt when the floor changes. */
  function buildLevel(v) {
    if (gl.level) disposeGroup(gl.level);
    const H = v.map.length;
    const W = v.map[0].length;
    const level = new THREE.Group();
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: stoneTexture(W, H), roughness: 0.95 }));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    level.add(floorMesh);
    const walls = [];
    v.map.forEach(function (row, y) { for (let x = 0; x < W; x++) if (row[x] === '#') walls.push([x, y]); });
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1), mat(0x57534e), walls.length);
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    walls.forEach(function (p, i) {
      m.makeTranslation(p[0] + 0.5 - W / 2, WALL_H / 2, p[1] + 0.5 - H / 2);
      wallMesh.setMatrixAt(i, m);
    });
    level.add(wallMesh);
    gl.scene.add(level);
    gl.level = level;
    gl.size = { w: W, h: H };
    gl.floorIndex = v.floor;
    gl.mapKey = '';
  }

  /** Doors, keys and the stairs: rebuilt when the map changes (a key picked up, a door opened). */
  function buildThings(v) {
    if (gl.things) disposeGroup(gl.things);
    const things = new THREE.Group();
    const W = gl.size.w;
    const H = gl.size.h;
    gl.keyMeshes = [];
    gl.plates = [];
    const spikes = [];
    const gate = new THREE.Group(); // every gate's bars, raised and lowered together
    const plateMat = mat(0x78716c, { emissive: 0x000000 });
    const barMat = mat(0x9ca3af, { metalness: 0.7, roughness: 0.35 });
    v.map.forEach(function (row, y) {
      for (let x = 0; x < W; x++) {
        const c = row[x];
        const px = x + 0.5 - W / 2;
        const pz = y + 0.5 - H / 2;
        if (c === 'D') {
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.96, WALL_H * 0.95, 0.96), mat(0x92400e));
          door.position.set(px, WALL_H * 0.475, pz);
          things.add(door);
          const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 1.0), mat(0xfacc15, { metalness: 0.6, roughness: 0.3 }));
          lock.position.set(px, WALL_H * 0.5, pz);
          things.add(lock);
        } else if (c === 'K') {
          const key = new THREE.Group();
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 12), mat(0xfacc15, { metalness: 0.7, roughness: 0.25, emissive: 0x3b2f00 }));
          ring.position.y = 0.16;
          const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), ring.material);
          shaft.position.y = -0.07;
          key.add(ring, shaft);
          key.position.set(px, 0.55, pz);
          things.add(key);
          gl.keyMeshes.push(key);
        } else if (c === 'E') {
          for (let i = 0; i < 3; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(0.9 - i * 0.2, 0.06, 0.9 - i * 0.2), mat(i % 2 ? 0x1f2937 : 0x111827));
            step.position.set(px, 0.03 - i * 0.001, pz);
            things.add(step);
          }
          const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
          glow.rotation.x = -Math.PI / 2;
          glow.position.set(px, 0.08, pz);
          things.add(glow);
        } else if (c === '^') {
          spikes.push([px, pz]);
          const pit = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), mat(0x292524));
          pit.rotation.x = -Math.PI / 2;
          pit.position.set(px, 0.005, pz);
          things.add(pit);
        } else if (c === 'P') {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.7), plateMat);
          plate.position.set(px, 0.025, pz);
          things.add(plate);
        } else if (c === 'G') {
          for (let i = 0; i < 4; i++) {
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, WALL_H, 6), barMat);
            // Bars across whichever way the gateway runs (walls above and below: bars across x).
            const across = (v.map[y - 1] || '')[x] === '#';
            bar.position.set(px + (across ? 0 : (i - 1.5) * 0.24), WALL_H / 2, pz + (across ? (i - 1.5) * 0.24 : 0));
            gate.add(bar);
          }
        }
      }
    });
    // The spikes: four little cones a tile, one instanced mesh, raised and lowered as one.
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.36, 6), mat(0xd6d3d1, { metalness: 0.6, roughness: 0.3 }), Math.max(1, spikes.length * 4));
    cone.count = spikes.length * 4;
    const m = new THREE.Matrix4();
    spikes.forEach(function (p, i) {
      for (let j = 0; j < 4; j++) {
        m.makeTranslation(p[0] + (j % 2 ? 0.2 : -0.2), 0.18, p[1] + (j < 2 ? 0.2 : -0.2));
        cone.setMatrixAt(i * 4 + j, m);
      }
    });
    const spikeGroup = new THREE.Group();
    spikeGroup.add(cone);
    things.add(spikeGroup, gate);
    gl.spikes = spikeGroup;
    gl.gate = gate;
    gl.plateMat = plateMat;
    things.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    gl.scene.add(things);
    gl.things = things;
  }

  /** A hero: a body in the player's colour, a head, and the Fighter's sword and shield or the Healer's staff. */
  function makeHero(role, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.62, 12), mat(color));
    body.position.y = 0.31;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(0xfde4cf));
    head.position.y = 0.78;
    g.add(body, head);
    const parts = { group: g, body: body };
    if (role === 'fighter') {
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), mat(0xe5e7eb, { metalness: 0.8, roughness: 0.2 }));
      sword.position.set(0.3, 0.45, 0.25);
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16), mat(0x60a5fa, { metalness: 0.4 }));
      shield.rotation.x = Math.PI / 2;
      shield.position.set(-0.05, 0.45, 0.32);
      g.add(sword, shield);
      parts.sword = sword;
      parts.shield = shield;
    } else {
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), mat(0x92400e));
      staff.position.set(0.3, 0.45, 0.1);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x86efac }));
      orb.position.set(0.3, 0.92, 0.1);
      g.add(staff, orb);
      parts.orb = orb;
    }
    // The revive ring: the whole ring, drawn as far round as the revive has got (6 indices a segment).
    const reviveRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 24, 1), new THREE.MeshBasicMaterial({ color: 0x86efac, side: THREE.DoubleSide }));
    reviveRing.rotation.x = -Math.PI / 2;
    reviveRing.position.y = 0.05;
    reviveRing.visible = false;
    parts.reviveRing = reviveRing;
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    // A lantern: warm light around each hero, in the dark corners.
    const lamp = new THREE.PointLight(0xffd8a0, 3.5, 5, 1.6);
    lamp.position.set(0, 1.8, 0);
    g.add(lamp);
    gl.scene.add(g, reviveRing);
    parts.shown = null;
    parts.role = role;
    return parts;
  }

  function dropHero(p) {
    disposeGroup(p.group);
    disposeGroup(p.reviveRing);
  }

  function makeEnemy(kind) {
    const g = new THREE.Group();
    const parts = { group: g, kind: kind };
    if (kind === 'slime') {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), mat(0x4ade80, { transparent: true, opacity: 0.88, roughness: 0.3 }));
      blob.scale.set(1, 0.65, 1);
      blob.position.y = 0.22;
      g.add(blob);
      parts.body = blob;
    } else if (kind === 'skeleton') {
      const bone = mat(0xe7e5e4);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.55, 8), bone);
      body.position.y = 0.3;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bone);
      skull.position.y = 0.72;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const eyeGeo = new THREE.SphereGeometry(0.03, 6, 4);
      const el = new THREE.Mesh(eyeGeo, eyeMat);
      const er = new THREE.Mesh(eyeGeo, eyeMat);
      el.position.set(-0.06, 0.74, 0.13);
      er.position.set(0.06, 0.74, 0.13);
      g.add(body, skull, el, er);
      parts.body = body;
    } else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0x7c3aed));
      const wingGeo = new THREE.BoxGeometry(0.34, 0.02, 0.18);
      const wl = new THREE.Mesh(wingGeo, mat(0x4c1d95));
      const wr = new THREE.Mesh(wingGeo, wl.material);
      wl.position.x = -0.24;
      wr.position.x = 0.24;
      g.add(body, wl, wr);
      parts.body = body;
      parts.wings = [wl, wr];
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    gl.scene.add(g);
    return parts;
  }

  /** Where the nearer of the two heroes is shown, from `p`. */
  function nearer(p, heroes) {
    const a = heroes[0].shown;
    const b = heroes[1].shown;
    const q = Math.hypot(a.x - p.x, a.z - p.z) <= Math.hypot(b.x - p.x, b.z - p.z) ? a : b;
    return [q.x, q.z];
  }

  /** Tile coordinates to the scene's. */
  function at(x, y) {
    return [x - gl.size.w / 2, y - gl.size.h / 2];
  }

  function syncScene(v, dt, t) {
    if (gl.floorIndex !== v.floor || !gl.level || gl.mapSrc !== v.floor) {
      buildLevel(v);
      gl.mapSrc = v.floor;
    }
    const mapKey = v.map.join('');
    if (mapKey !== gl.mapKey) {
      gl.mapKey = mapKey;
      buildThings(v);
    }
    const k = Math.min(1, dt * 14);
    // Built again if the roles were swapped in the setup since.
    if (gl.heroes && gl.heroes.some(function (p, i) { return p.role !== v.heroes[i].role; })) {
      gl.heroes.forEach(dropHero);
      gl.heroes = null;
    }
    if (!gl.heroes) gl.heroes = v.heroes.map(function (h, i) { return makeHero(h.role, colors[i]); });
    // Spikes up or down, the gate's bars down while it's open, the plates lit.
    gl.spikeY += ((v.spikesUp ? 0 : -0.3) - gl.spikeY) * Math.min(1, dt * 20);
    if (gl.spikes) gl.spikes.position.y = gl.spikeY;
    gl.gateY += ((v.gateOpen ? -WALL_H * 0.95 : 0) - gl.gateY) * Math.min(1, dt * 10);
    if (gl.gate) gl.gate.position.y = gl.gateY;
    if (gl.plateMat) gl.plateMat.emissive.setHex(v.gateOpen ? 0x166534 : 0x000000);
    v.heroes.forEach(function (h, i) {
      const p = gl.heroes[i];
      const [tx, tz] = at(h.x, h.y);
      if (!p.shown || v.phase !== 'play') p.shown = { x: tx, z: tz };
      p.shown.x += (tx - p.shown.x) * k;
      p.shown.z += (tz - p.shown.z) * k;
      p.group.position.set(p.shown.x, 0, p.shown.z);
      p.group.rotation.y = Math.atan2(h.face[0], h.face[1]);
      p.group.rotation.z = h.downed ? Math.PI / 2 : 0;
      p.group.position.y = h.downed ? 0.25 : 0;
      p.body.material.emissive.setHex(h.hurt && Math.floor(t / 90) % 2 ? 0x7f1d1d : 0x000000);
      if (p.shield) {
        p.shield.position.set(h.blocking ? 0 : -0.05, h.blocking ? 0.42 : 0.45, h.blocking ? 0.38 : 0.3);
        p.shield.scale.setScalar(h.blocking ? 1.25 : 1);
      }
      if (p.sword) p.sword.rotation.y = h.swing ? -1.1 : 0;
      if (p.orb) p.orb.scale.setScalar(h.swing ? 1.6 : 1);
      p.reviveRing.visible = h.downed && h.revive > 0;
      if (p.reviveRing.visible) {
        p.reviveRing.geometry.setDrawRange(0, Math.ceil(h.revive * 24) * 6);
        p.reviveRing.position.set(p.shown.x, 0.05, p.shown.z);
      }
    });
    // Enemies: made and removed as they come and go.
    const seen = {};
    v.enemies.forEach(function (e) {
      const id = e.id + e.kind;
      seen[id] = true;
      let p = gl.enemies[id];
      if (!p) p = gl.enemies[id] = makeEnemy(e.kind);
      const [tx, tz] = at(e.x, e.y);
      if (!p.shown || v.phase !== 'play') p.shown = { x: tx, z: tz }; // no gliding back across the walls on a retry
      p.shown.x += (tx - p.shown.x) * k;
      p.shown.z += (tz - p.shown.z) * k;
      if (e.kind === 'slime') {
        const bob = Math.sin(t / 180 + e.id);
        p.body.scale.set(1 + bob * 0.08, 0.65 - bob * 0.08, 1 + bob * 0.08);
        p.group.position.set(p.shown.x, 0, p.shown.z);
      } else if (e.kind === 'skeleton') {
        p.group.position.set(p.shown.x, 0, p.shown.z);
        const [hx, hz] = gl.heroes[0].shown && gl.heroes[1].shown ? nearer(p.shown, gl.heroes) : [p.shown.x, p.shown.z + 1];
        p.group.rotation.y = Math.atan2(hx - p.shown.x, hz - p.shown.z);
      } else {
        const flap = Math.sin(t / 60 + e.id);
        p.wings[0].rotation.z = flap * 0.7;
        p.wings[1].rotation.z = -flap * 0.7;
        p.group.position.set(p.shown.x, 0.8 + Math.sin(t / 300 + e.id) * 0.08, p.shown.z);
      }
      p.body.material.emissive.setHex(e.hurt ? 0xffffff : 0x000000);
      p.body.material.emissiveIntensity = e.hurt ? 0.6 : 0;
    });
    Object.keys(gl.enemies).forEach(function (id) {
      if (seen[id]) return;
      disposeGroup(gl.enemies[id].group);
      delete gl.enemies[id];
    });
    // Bolts and circles: a small pool each.
    while (gl.shots.length < v.shots.length) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      gl.scene.add(s);
      gl.shots.push(s);
    }
    gl.shots.forEach(function (s, i) {
      s.visible = i < v.shots.length;
      if (s.visible) {
        const [x, z] = at(v.shots[i].x, v.shots[i].y);
        s.position.set(x, 0.5, z);
      }
    });
    // Bones: a pool of little white sticks, spinning.
    const bones = v.bones || [];
    while (gl.bones.length < bones.length) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), mat(0xf5f5f4));
      gl.scene.add(b);
      gl.bones.push(b);
    }
    gl.bones.forEach(function (b, i) {
      b.visible = i < bones.length;
      if (!b.visible) return;
      const [x, z] = at(bones[i].x, bones[i].y);
      b.position.set(x, 0.5, z);
      b.rotation.y = t / 70;
    });
    while (gl.circles.length < v.circles.length) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.3 }));
      c.rotation.x = -Math.PI / 2;
      gl.scene.add(c);
      gl.circles.push(c);
    }
    gl.circles.forEach(function (c, i) {
      c.visible = i < v.circles.length;
      if (!c.visible) return;
      const q = v.circles[i];
      const [x, z] = at(q.x, q.y);
      c.position.set(x, 0.04, z);
      c.scale.setScalar(q.r);
      c.material.opacity = 0.15 + 0.25 * q.left;
    });
    if (gl.keyMeshes) gl.keyMeshes.forEach(function (m) { m.rotation.y = t / 500; });
    // The camera: over the middle of the two heroes, further back the further apart they are.
    const a = gl.heroes[0].shown;
    const b = gl.heroes[1].shown;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const spread = Math.hypot(a.x - b.x, a.z - b.z);
    const want = Math.max(9, spread * 1.3 + 5);
    const ck = Math.min(1, dt * 3);
    gl.cam.x += (mx - gl.cam.x) * ck;
    gl.cam.z += (mz - gl.cam.z) * ck;
    gl.cam.d += (want - gl.cam.d) * ck;
    gl.camera.position.set(gl.cam.x, gl.cam.d * 0.95, gl.cam.z + gl.cam.d * 0.62);
    gl.camera.lookAt(gl.cam.x, 0, gl.cam.z);
    gl.sun.position.set(gl.cam.x - 5, 14, gl.cam.z + 6);
    gl.sun.target.position.set(gl.cam.x, 0, gl.cam.z);
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

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    if (!gl || !view) return;
    syncScene(view, dt, t);
    gl.renderer.render(gl.scene, gl.camera);
  }

  function render(v) {
    view = v;
    if (!els) return;
    renderHud(v);
    if (!els.failed) renderOverlay(v); // keep the reason on screen if the 3D couldn't start
  }

  // Controllers: the stick (or D-pad) walks; A attacks; hold B for the Fighter's shield, press it for the Healer's circle.
  function padPoll(pad, v) {
    if (v.phase !== 'play') return null;
    const held = function (b) { return pad.held.indexOf(b) !== -1; };
    const dz = function (a) { return Math.abs(a) < DEADZONE ? 0 : a; };
    let x = dz(pad.stick.x);
    let y = dz(pad.stick.y);
    if (held('LEFT')) x = -1;
    if (held('RIGHT')) x = 1;
    if (held('UP')) y = -1;
    if (held('DOWN')) y = 1;
    return { type: 'move', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, special: held('B') };
  }

  Ark.register('host', 'dungeon-duo', {
    sounds: function (prev, v) {
      const a = prev.events;
      const b = v.events;
      const out = [];
      if (prev.phase === 'countdown' && v.phase === 'play') out.push('go');
      if (v.phase === 'floorClear' && prev.phase !== 'floorClear') out.push('fanfare');
      if (v.phase === 'retry' && prev.phase !== 'retry') out.push('wrong');
      if (!a || !b) return out;
      if (b.kills > a.kills) out.push('point');
      else if (b.hits > a.hits) out.push('paddle');
      if (b.hurt > a.hurt) out.push('crash');
      if (b.blocked > a.blocked) out.push('lock');
      if (b.thrown > a.thrown) out.push('whoosh');
      if (b.keys > a.keys || b.doors > a.doors) out.push('reveal');
      if (b.revives > a.revives) out.push('correct');
      return out;
    },
    padHint: 'Stick or D-pad walks · A attacks · B: hold for the Fighter\'s shield, press for the Healer\'s circle · A: rematch at the end',
    padPoll: padPoll,
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return v.phase === 'play' && btn === 'A' ? { type: 'attack' } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'dd-host';
      root.innerHTML = '<div class="dd-hud"></div><div class="dd-arena"><div class="dd-over hidden"></div></div>';
      el.appendChild(root);
      els = { hud: root.querySelector('.dd-hud'), arena: root.querySelector('.dd-arena'), overlay: root.querySelector('.dd-over') };
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
          els.failed = true;
        }
      }).catch(function () {
        if (!els) return;
        els.overlay.innerHTML = '<div class="sub">Couldn\'t load the 3D engine.</div>';
        els.overlay.classList.remove('hidden');
        els.failed = true;
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
      hudKey = overlayKey = '';
    },
  });
})();
