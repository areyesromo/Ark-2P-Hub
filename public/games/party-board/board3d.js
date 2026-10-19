// Party Board in 3D (Board view: 3D): raised tiles joined by paths, a spinning ⭐,
// and two toy figures that hop space by space while the camera follows whoever's
// turn it is. Each map has its own scenery (THEMES, picked by view.board.theme).
// PB3D.create(el) -> Promise<{ update(view), dispose() }>; uses ArkMini.scene3d.
(function () {
  const HOP_MS = 230;
  const TELE_MS = 520;
  const FLY_MS = 1200; // a warp flight
  const MOOD_MS = 700;
  const DIE_MS = 650;
  const POP_MS = 1200;
  const FIGURES = ['figure-engineer', 'figure-mechanic']; // the miniatures players pick from (models/<name>.glb)
  const PEDESTAL = { x: 0, z: -8, top: 1.6, scale: 1.6 }; // the winner stands on it, bigger // the winner's spot at the end, behind the board // a coin popping up (gained) or falling away (lost)
  const COLORS = { start: 0xf8fafc, blue: 0x2563eb, red: 0xdc2626, event: 0x16a34a, bonus: 0x9333ea, shop: 0xf59e0b, warp: 0x0891b2, thunder: 0xa16207, skull: 0x3f0d12, tornado: 0x6b21a8 };
  const ICON = { start: '🏁', event: '❓', bonus: '🎰', shop: '🛒', warp: '🌀', thunder: '⚡', skull: '💀', tornado: '🌪️' };

  /** Board 0..1 coordinates to the island's ground. */
  function at(T, s) {
    return new T.Vector3((s.x - 0.5) * 22, 0, (s.y - 0.5) * 13);
  }

  function canvasTexture(T, draw, w, h) {
    const c = document.createElement('canvas');
    c.width = w || 128;
    c.height = h || 128;
    draw(c.getContext('2d'), c.width, c.height);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function emojiSprite(T, text, size) {
    const tex = canvasTexture(T, function (g, w, h) {
      g.font = Math.round(h * 0.78) + 'px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + h * 0.04);
    });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(size, size, size);
    return sp;
  }

  /** A round numbered badge (a fork's path number), always facing the camera. */
  function numberSprite(T, n, color) {
    const tex = canvasTexture(T, function (g, w, h) {
      g.beginPath();
      g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.lineWidth = w * 0.06;
      g.strokeStyle = '#fff';
      g.stroke();
      g.font = 'bold ' + Math.round(h * 0.6) + 'px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#0b1020';
      g.fillText(String(n), w / 2, h / 2 + h * 0.04);
    });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false }));
    sp.renderOrder = 10;
    return sp;
  }

  // A fork's two branches: path 1 amber, path 2 violet (as on the 2D board and the phone).
  const ROUTE_COLORS = ['#f59e0b', '#a78bfa'];

  function nameSprite(T, name, color) {
    const tex = canvasTexture(T, function (g, w, h) {
      g.font = 'bold 44px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 8;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.strokeText(name, w / 2, h / 2);
      g.fillStyle = color;
      g.fillText(name, w / 2, h / 2);
    }, 256, 64);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(2.2, 0.55, 1);
    return sp;
  }

  function palm(T, x, z, lean) {
    const g = new T.Group();
    const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 2.6, 8), new T.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }));
    trunk.position.y = 1.3;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = new T.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8, side: T.DoubleSide });
    for (let k = 0; k < 6; k++) {
      const l = new T.Mesh(new T.ConeGeometry(0.22, 1.6, 4), leaf);
      l.position.set(Math.cos((k / 6) * Math.PI * 2) * 0.7, 2.55, Math.sin((k / 6) * Math.PI * 2) * 0.7);
      l.rotation.z = Math.PI / 2;
      l.rotation.y = -(k / 6) * Math.PI * 2;
      l.rotation.x = 0.35;
      l.castShadow = true;
      g.add(l);
    }
    g.position.set(x, 0, z);
    g.rotation.z = lean;
    return g;
  }

  /** A chunky toy figure: body, head with eyes, a little hat; faces +Z. */
  function figure(T, color, name, css) {
    const g = new T.Group();
    const body = new T.Group(); // squashes and tilts; the name stays put
    const mat = new T.MeshStandardMaterial({ color: color, roughness: 0.45 });
    const torso = new T.Mesh(new T.CapsuleGeometry(0.32, 0.42, 6, 14), mat);
    torso.position.y = 0.55;
    torso.castShadow = true;
    const head = new T.Mesh(new T.SphereGeometry(0.31, 20, 14), new T.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.6 }));
    head.position.y = 1.18;
    head.castShadow = true;
    const eyeMat = new T.MeshStandardMaterial({ color: 0x111827 });
    [-0.11, 0.11].forEach(function (x) {
      const e = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), eyeMat);
      e.position.set(x, 1.22, 0.27);
      body.add(e);
    });
    const hat = new T.Mesh(new T.ConeGeometry(0.27, 0.42, 16), mat);
    hat.position.y = 1.6;
    hat.castShadow = true;
    body.add(torso, head, hat);
    g.add(body);
    const label = nameSprite(T, name, css);
    label.position.y = 2.25;
    g.add(label);
    return { group: g, body: body };
  }

  /** Six faces showing `n` (or '?'), for the die. */
  function dieMaterials(T, n) {
    const mats = [];
    for (let i = 0; i < 6; i++) {
      mats.push(new T.MeshStandardMaterial({
        roughness: 0.35,
        map: canvasTexture(T, function (g, w, h) {
          g.fillStyle = '#f8fafc';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#111827';
          g.font = 'bold 76px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(n), w / 2, h / 2 + 4);
        }),
      }));
    }
    return mats;
  }

  function starShape(T) {
    const s = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.32 : 0.75;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  }


  function mat(T, color, extra) {
    return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85 }, extra || {}));
  }

  function shadowed(m) {
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** A flat, rounded ground under the whole board (an ellipse: the corners fit). */
  function ground(T, color, opts) {
    opts = opts || {};
    const g = new T.Mesh(new T.CylinderGeometry(14.5, 15.5, 0.9, 64), mat(T, color, opts.mat));
    g.scale.z = 0.66;
    g.position.y = -0.45;
    g.receiveShadow = true;
    return g;
  }

  function water(T, color, opts) {
    const m = new T.Mesh(new T.PlaneGeometry(160, 160), new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.35, metalness: 0.1 }, opts || {})));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.55;
    return m;
  }

  /** Spots on the ground clear of every tile and path, for props (a fixed order per map). */
  function freeSpots(T, spaces, want, clear) {
    const pts = spaces.map(function (sp) { return at(T, sp); });
    const segs = [];
    spaces.forEach(function (sp, i) {
      sp.next.forEach(function (n) { segs.push([pts[i], pts[n]]); });
    });
    function segDist(p, a, b) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l));
      return Math.hypot(p.x - (a.x + dx * k), p.z - (a.z + dz * k));
    }
    let seed = spaces.length * 7919 + 17;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    const out = [];
    for (let tries = 0; tries < 900 && out.length < want; tries++) {
      // Inside the ground's ellipse, with a margin.
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.9;
      const p = new T.Vector3(Math.cos(a) * r * 14, 0, Math.sin(a) * r * 9.2);
      const ok = pts.every(function (q) { return Math.hypot(p.x - q.x, p.z - q.z) > clear + 0.7; }) &&
        segs.every(function (sg) { return segDist(p, sg[0], sg[1]) > clear; }) &&
        out.every(function (q) { return Math.hypot(p.x - q.x, p.z - q.z) > clear * 1.6; });
      if (ok) out.push(p);
    }
    return out;
  }

  function rock(T, color, size) {
    const m = shadowed(new T.Mesh(new T.DodecahedronGeometry(size, 0), mat(T, color, { flatShading: true })));
    m.position.y = size * 0.4;
    m.rotation.set(size * 3, size * 5, 0);
    return m;
  }

  function pond(T, r) {
    const g = new T.Group();
    const rim = new T.Mesh(new T.CylinderGeometry(r + 0.18, r + 0.25, 0.1, 32), mat(T, 0xd6c08a));
    rim.position.y = 0.02;
    const w = new T.Mesh(new T.CylinderGeometry(r, r, 0.12, 32), mat(T, 0x22d3ee, { roughness: 0.2, metalness: 0.2, emissive: 0x0e4f5c }));
    w.position.y = 0.04;
    g.add(rim, w);
    return g;
  }

  function greenPipe(T, h) {
    const g = new T.Group();
    const green = mat(T, 0x16a34a, { roughness: 0.4, metalness: 0.2 });
    const body = shadowed(new T.Mesh(new T.CylinderGeometry(0.42, 0.42, h, 20), green));
    body.position.y = h / 2;
    const rim = shadowed(new T.Mesh(new T.CylinderGeometry(0.56, 0.56, 0.32, 20), green));
    rim.position.y = h;
    const hole = new T.Mesh(new T.CircleGeometry(0.4, 20), mat(T, 0x052e16));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = h + 0.17;
    g.add(body, rim, hole);
    return g;
  }

  function crate(T) {
    const m = shadowed(new T.Mesh(new T.BoxGeometry(0.8, 0.8, 0.8), mat(T, 0xa16207)));
    m.position.y = 0.4;
    return m;
  }

  function deadTree(T) {
    const g = new T.Group();
    const bark = mat(T, 0x3b2f2f);
    const trunk = shadowed(new T.Mesh(new T.CylinderGeometry(0.1, 0.2, 2, 6), bark));
    trunk.position.y = 1;
    g.add(trunk);
    [[0.6, 1.4, 0.9], [-0.7, 1.1, -0.8], [0.2, 1.8, 0.5]].forEach(function (b) {
      const br = shadowed(new T.Mesh(new T.CylinderGeometry(0.03, 0.07, 1, 5), bark));
      br.position.set(b[0] * 0.4, b[1], 0);
      br.rotation.z = -b[2];
      g.add(br);
    });
    return g;
  }

  function tombstone(T) {
    const g = new T.Group();
    const stone = mat(T, 0x78716c);
    const slab = shadowed(new T.Mesh(new T.BoxGeometry(0.6, 0.6, 0.18), stone));
    slab.position.y = 0.3;
    const top = shadowed(new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.18, 16, 1, false, 0, Math.PI), stone));
    top.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    top.position.y = 0.6;
    g.add(slab, top);
    return g;
  }

  function lantern(T) {
    const g = new T.Group();
    const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 1.3, 6), mat(T, 0x1c1917));
    post.position.y = 0.65;
    const glow = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), new T.MeshStandardMaterial({ color: 0xfdba74, emissive: 0xf97316, emissiveIntensity: 2 }));
    glow.position.y = 1.4;
    g.add(post, glow);
    return g;
  }

  /** The look of each map: background, lights, ground, path style, props and a little motion. */
  const THEMES = {
    island: {
      bg: 0x0b2a4a, link: { color: 0x8d6e4a }, warp: 0x22d3ee,
      scenery: function (T, scene) {
        scene.add(water(T, 0x1d6fb8), ground(T, 0xe9d8a6, { mat: { roughness: 0.95 } }));
        const lawn = new T.Mesh(new T.CylinderGeometry(7.6, 7.6, 0.08, 48), mat(T, 0x4d9a3a, { roughness: 1 }));
        lawn.scale.z = 0.5;
        lawn.position.y = 0.01;
        lawn.receiveShadow = true;
        scene.add(lawn);
        // A few small palms in the middle, kept low so they don't hide the path.
        [[-3.2, -0.4, 0.1], [0.4, 0.5, -0.08], [3.4, -0.6, 0.12]].forEach(function (p) {
          const tree = palm(T, p[0], p[1], p[2]);
          tree.scale.setScalar(0.6);
          scene.add(tree);
        });
      },
    },
    lagoons: {
      bg: 0x0c4a6e, link: { color: 0xc8a165 }, warp: 0x22d3ee,
      scenery: function (T, scene, spaces) {
        scene.add(water(T, 0x0ea5b7, { emissive: 0x053b44 }), ground(T, 0xf5e6b8, { mat: { roughness: 0.95 } }));
        freeSpots(T, spaces, 9, 1.1).forEach(function (p, k) {
          let prop;
          if (k < 3) prop = pond(T, 1 - k * 0.15);
          else if (k < 7) { prop = palm(T, 0, 0, (k % 2 ? 1 : -1) * 0.1); prop.scale.setScalar(0.5); }
          else prop = rock(T, 0xa8a29e, 0.35);
          prop.position.x = p.x;
          prop.position.z = p.z;
          scene.add(prop);
        });
      },
    },
    pipes: {
      bg: 0x111827, link: { pipe: true, color: 0x22c55e }, warp: 0x4ade80, light: { hemi: 0.8, sun: 1.8 },
      scenery: function (T, scene, spaces) {
        scene.add(water(T, 0x0f172a, { roughness: 0.9 }));
        const grid = canvasTexture(T, function (g, w, h) {
          g.fillStyle = '#64748b';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#475569';
          g.lineWidth = 6;
          g.strokeRect(0, 0, w, h);
          g.fillStyle = '#94a3b8';
          [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], 5, 0, 7); g.fill(); });
        });
        grid.wrapS = grid.wrapT = T.RepeatWrapping;
        grid.repeat.set(14, 14);
        scene.add(ground(T, 0xffffff, { mat: { map: grid, roughness: 0.6, metalness: 0.5 } }));
        freeSpots(T, spaces, 9, 1.1).forEach(function (p, k) {
          const prop = k % 3 === 2 ? crate(T) : greenPipe(T, 0.5 + (k % 3) * 0.4);
          prop.position.x = p.x;
          prop.position.z = p.z;
          prop.rotation.y = k;
          scene.add(prop);
        });
      },
    },
    haunted: {
      bg: 0x0f0a1a, fog: [0x1e1530, 26, 55], link: { color: 0x6b6478 }, warp: 0xa855f7, light: { hemi: 0.55, sun: 0.9, sunColor: 0xc4b5fd },
      scenery: function (T, scene, spaces) {
        scene.add(water(T, 0x120c1f, { roughness: 1 }), ground(T, 0x2e2640, { mat: { roughness: 1 } }));
        const ghosts = [];
        freeSpots(T, spaces, 11, 1).forEach(function (p, k) {
          const prop = k % 3 === 0 ? deadTree(T) : k % 3 === 1 ? tombstone(T) : lantern(T);
          if (k % 3 === 0) prop.scale.setScalar(0.75);
          prop.position.x = p.x;
          prop.position.z = p.z;
          prop.rotation.y = k * 1.3;
          scene.add(prop);
          if (k < 4) {
            const gh = emojiSprite(T, '👻', 0.9);
            gh.position.set(p.x, 2.2, p.z);
            gh.material.opacity = 0.75;
            scene.add(gh);
            ghosts.push(gh);
          }
        });
        return function (t) {
          ghosts.forEach(function (g, k) { g.position.y = 2.2 + Math.sin(t * 1.5 + k * 2) * 0.35; });
        };
      },
    },
    volcano: {
      bg: 0x1c0a05, fog: [0x2a0f07, 22, 50], link: { color: 0x44403c, emissive: 0x7c2d12 }, warp: 0xfb923c, light: { hemi: 0.75, sun: 1.6, sunColor: 0xfed7aa },
      scenery: function (T, scene, spaces) {
        const lava = water(T, 0xea580c, { emissive: 0xc2410c, emissiveIntensity: 0.9, roughness: 0.6 });
        scene.add(lava, ground(T, 0x292524, { mat: { flatShading: true } }));
        // The peak itself, behind the board, with a glowing crater and smoke.
        const peak = shadowed(new T.Mesh(new T.CylinderGeometry(1.7, 7, 8, 9, 1, true), mat(T, 0x3f3a36, { flatShading: true })));
        peak.position.set(0, 3.2, -15);
        const crater = new T.Mesh(new T.CircleGeometry(1.6, 16), new T.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 2 }));
        crater.rotation.x = -Math.PI / 2;
        crater.position.set(0, 7.2, -15);
        scene.add(peak, crater);
        const smoke = [];
        for (let k = 0; k < 6; k++) {
          const puff = new T.Mesh(new T.SphereGeometry(0.9, 10, 8), new T.MeshStandardMaterial({ color: 0x57534e, transparent: true, opacity: 0.5 }));
          scene.add(puff);
          smoke.push(puff);
        }
        freeSpots(T, spaces, 8, 1).forEach(function (p, k) {
          const r = rock(T, k % 2 ? 0x1c1917 : 0x44403c, 0.3 + (k % 3) * 0.12);
          r.position.x = p.x;
          r.position.z = p.z;
          scene.add(r);
        });
        return function (t) {
          lava.material.emissiveIntensity = 0.75 + Math.sin(t * 1.3) * 0.2;
          smoke.forEach(function (puff, k) {
            const u = (t * 0.25 + k / smoke.length) % 1;
            puff.position.set(Math.sin(k * 2.1 + t * 0.3) * 1.2, 7.6 + u * 6, -15 + u * 1.5);
            puff.scale.setScalar(0.6 + u * 1.6);
            puff.material.opacity = 0.55 * (1 - u);
          });
        };
      },
    },
  };

  /** A path between two spaces: a plank / stone strip, or (Pipe Works) a pipe. */
  function link(T, look, p, q, material) {
    const d = q.clone().sub(p);
    const len = Math.max(0.1, d.length() - 1.1);
    const m = look.pipe
      ? new T.Mesh(new T.CylinderGeometry(0.16, 0.16, len, 10), material)
      : new T.Mesh(new T.BoxGeometry(0.28, 0.07, len), material);
    m.position.copy(p.clone().add(q).multiplyScalar(0.5));
    m.position.y = look.pipe ? 0.12 : 0.05;
    m.rotation.y = Math.atan2(d.x, d.z);
    if (look.pipe) m.rotation.x = Math.PI / 2;
    // Rotation order: lay the pipe along Z first, then turn it toward the next space.
    m.rotation.order = 'YXZ';
    m.receiveShadow = true;
    return m;
  }

  /** A warp flight: a high arc from where the figure stands to where the warp sends it. */
  function warpArc(T, p, q, top) {
    const mid = p.clone().add(q).multiplyScalar(0.5);
    mid.y = top + 3 + p.distanceTo(q) * 0.18;
    return new T.QuadraticBezierCurve3(new T.Vector3(p.x, top + 0.08, p.z), mid, new T.Vector3(q.x, top + 0.08, q.z));
  }

  /**
   * The tile model, loaded and prepared once per page: its parts merged per material (the
   * face kept apart, to swap per space type), side rivets made low-poly.
   * Resolves { body: [{ geometry, material }], face, scale, lift, top }.
   */
  let tileModelP = null;
  const SIMPLIFY = 0.6; // share of vertices the simplifier removes
  function tileModel(T) {
    if (tileModelP) return tileModelP;
    tileModelP = Promise.all([
      import('/vendor/three-addons/loaders/GLTFLoader.js'),
      import('/vendor/three-addons/utils/BufferGeometryUtils.js'),
      import('/vendor/three-addons/modifiers/SimplifyModifier.js'),
    ]).then(function (mods) {
      return new mods[0].GLTFLoader().loadAsync('/games/party-board/models/tile.glb').then(function (gltf) {
        const merge = mods[1].mergeGeometries;
        gltf.scene.updateMatrixWorld(true);
        const groups = {};
        let face = null;
        gltf.scene.traverse(function (o) {
          if (!o.isMesh) return;
          let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          if (o.name === 'face') { face = g; return; }
          if (/^rivet/.test(o.name)) {
            // A rivet is a few pixels on screen: 24 triangles instead of 320.
            g.computeBoundingBox();
            const c = g.boundingBox.getCenter(new T.Vector3());
            const r = g.boundingBox.getSize(new T.Vector3()).x / 2;
            g = new T.SphereGeometry(r, 6, 4).translate(c.x, c.y, c.z);
          }
          Object.keys(g.attributes).forEach(function (k) { if (k !== 'position') g.deleteAttribute(k); });
          const key = o.material.uuid; // one group per material (names can repeat: a coin's two faces)
          (groups[key] = groups[key] || { material: o.material, parts: [] }).parts.push(g);
        });
        const body = Object.keys(groups).map(function (k) {
          const mat = tone(groups[k].material.clone());
          // Simplified: far fewer triangles, no visible change at board distance.
          const geo = mods[1].mergeVertices(merge(groups[k].parts));
          return { geometry: new mods[2].SimplifyModifier().modify(geo, Math.floor(geo.attributes.position.count * SIMPLIFY)), material: mat };
        });
        const box = new T.Box3().setFromObject(gltf.scene);
        const scale = 1.3 / (box.max.x - box.min.x);
        return { body: body, face: face, scale: scale, lift: -box.min.y * scale, top: (box.max.y - box.min.y) * scale };
      });
    }).catch(function (e) {
      tileModelP = null; // try again on the next board
      throw e;
    });
    return tileModelP;
  }

  /**
   * Model materials for the TV: flat-shaded (the models have no normals), and metals kept
   * half-metal: full metal looks black with nothing to reflect, and a reflection map costs
   * about a third of the frame rate.
   */
  function tone(mat, smooth) {
    mat.flatShading = !smooth;
    mat.metalness = Math.min(mat.metalness, 0.45);
    return mat;
  }

  /**
   * A prop model (models/<name>.glb: coin, die, star), loaded once per page: its parts merged
   * per material and centred; with `simplify` (a share of vertices to remove), simplified,
   * for a model that is always on screen. Resolves { parts: [{ geometry, material }], size }.
   */
  const propP = {};
  function propModel(T, name, simplify) {
    if (propP[name]) return propP[name];
    propP[name] = Promise.all([
      import('/vendor/three-addons/loaders/GLTFLoader.js'),
      import('/vendor/three-addons/utils/BufferGeometryUtils.js'),
      import('/vendor/three-addons/modifiers/SimplifyModifier.js'),
    ]).then(function (mods) {
      return new mods[0].GLTFLoader().loadAsync('/games/party-board/models/' + name + '.glb').then(function (gltf) {
        gltf.scene.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(gltf.scene);
        const c = box.getCenter(new T.Vector3());
        const groups = {};
        gltf.scene.traverse(function (o) {
          if (!o.isMesh) return;
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-c.x, -c.y, -c.z);
          Object.keys(g.attributes).forEach(function (k) { if (k !== 'position' && k !== 'normal' && !(k === 'uv' && o.material.map)) g.deleteAttribute(k); });
          const key = o.material.uuid; // one group per material (names can repeat: a coin's two faces)
          (groups[key] = groups[key] || { material: o.material, parts: [] }).parts.push(g);
        });
        const parts = Object.keys(groups).map(function (k) {
          let geo = mods[1].mergeGeometries(groups[k].parts);
          if (simplify && !geo.attributes.uv) {
            geo = mods[1].mergeVertices(geo);
            geo = new mods[2].SimplifyModifier().modify(geo, Math.floor(geo.attributes.position.count * simplify));
          }
          return { geometry: geo, material: tone(groups[k].material.clone(), Boolean(geo.attributes.normal)) };
        });
        return { parts: parts, size: box.getSize(new T.Vector3()) };
      });
    }).catch(function (e) {
      propP[name] = null; // try again on the next board
      throw e;
    });
    return propP[name];
  }

  /** A new object from a prop model, `size` units across its longest side. */
  function propObject(T, m, size) {
    const g = new T.Group();
    m.parts.forEach(function (p) { g.add(new T.Mesh(p.geometry, p.material)); });
    g.scale.setScalar(size / Math.max(m.size.x, m.size.y, m.size.z));
    return g;
  }

  /** The rolled number on a little brass plate (shown over the model die, which only has 1-6). */
  function numberPlate(T, n) {
    const tex = canvasTexture(T, function (g, w, h) {
      g.fillStyle = '#3b2f1e';
      g.beginPath();
      g.roundRect(4, 4, w - 8, h - 8, 26);
      g.fill();
      g.fillStyle = '#d4a94e';
      g.beginPath();
      g.roundRect(14, 14, w - 28, h - 28, 18);
      g.fill();
      g.fillStyle = '#1f1408';
      g.font = 'bold 110px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), w / 2, h / 2 + 6);
    }, 192, 160);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(1.1, 0.92, 1);
    return sp;
  }

  function create(el) {
    return ArkMini.scene3d(el, { fov: 42 }).then(function (gl) {
      const T = gl.THREE;
      const scene = gl.scene;
      const s = {
        built: false, tiles: [], star: null, starAt: null, starTarget: null, starFocusUntil: 0,
        fork: null, forkKey: '', art: false, faces: {}, steel: null, top: 0.32, apart: 0.42, model: null, props: {}, pops: [], figs: [], sparks: [], victory: null, pedestal: null, confetti: null, tick: null, last: null, die: [], dieKey: '', dieShownAt: 0, cam: new T.Vector3(0, 17, 13), look: new T.Vector3(0, 0, 0),
      };

      function build(v) {
        const look = THEMES[v.board.theme] || THEMES.island;
        s.art = v.board.tiles !== 'classic';
        s.steel = new T.MeshStandardMaterial({ color: 0x8a94a6, roughness: 0.35, metalness: 0.75 });
        scene.background = new T.Color(look.bg);
        if (look.fog) scene.fog = new T.Fog(look.fog[0], look.fog[1], look.fog[2]);
        if (look.light) {
          scene.traverse(function (o) {
            if (o.isHemisphereLight) o.intensity = look.light.hemi;
            if (o.isDirectionalLight) {
              o.intensity = look.light.sun;
              if (look.light.sunColor) o.color.setHex(look.light.sunColor);
            }
          });
        }
        s.tick = look.scenery(T, scene, v.board.spaces) || null;
        // 'art': the tile model (models/tile.glb); 'light': its faces on plain discs.
        if (v.board.tiles === 'art') {
          tileModel(T).then(useModel, function (e) { console.warn('Party Board: no tile model', e); });
          // The star, die and coins: the models replace the plain shapes as they arrive.
          ['star', 'die', 'coin', 'figure-engineer', 'figure-mechanic'].forEach(function (name) {
            propModel(T, name, name === 'star' ? 0.6 : 0).then(function (m) { useProp(name, m); }, function (e) { console.warn('Party Board: no ' + name + ' model', e); });
          });
        }
        const path = mat(T, look.link.color, look.link.pipe ? { roughness: 0.4, metalness: 0.3 } : { emissive: look.link.emissive || 0, roughness: 0.9 });
        v.board.spaces.forEach(function (sp, i) {
          const p = at(T, sp);
          const tile = new T.Mesh(new T.CylinderGeometry(0.62, 0.68, 0.32, 28));
          tile.position.set(p.x, 0.16, p.z);
          tile.castShadow = tile.receiveShadow = true;
          scene.add(tile);
          const t = { mesh: tile, icon: null, face: null };
          s.tiles.push(t);
          dress(t, sp.type, i === v.board.star);
          sp.next.forEach(function (n) {
            scene.add(link(T, look.link, p, at(T, v.board.spaces[n]), path));
          });
        });
        const sparkMat = new T.MeshBasicMaterial({ color: look.warp, transparent: true, opacity: 0.8 });
        for (let k = 0; k < 6; k++) {
          const sp = new T.Mesh(new T.SphereGeometry(0.12 - k * 0.012, 8, 6), sparkMat);
          sp.visible = false;
          scene.add(sp);
          s.sparks.push(sp);
        }
        const star = new T.Mesh(new T.ExtrudeGeometry(starShape(T), { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }),
          new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x8a6d00, roughness: 0.3, metalness: 0.3 }));
        star.castShadow = true;
        scene.add(star);
        s.star = star;
        s.starAt = at(T, v.board.spaces[v.board.star]);
        s.starTarget = s.starAt.clone();
        ['#22d3ee', '#f472b6'].forEach(function (css, slot) {
          const f = figure(T, slot ? 0xf472b6 : 0x22d3ee, v.names[slot], css);
          // A soft round shadow under the figure (real shadows are off): shrinks as it jumps.
          const blob = new T.Mesh(new T.CircleGeometry(0.42, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
          blob.rotation.x = -Math.PI / 2;
          scene.add(f.group, blob);
          s.figs.push({ f: f, blob: blob, space: v.players[slot].space, from: null, to: null, t0: 0, kind: null, mood: null, moodAt: 0, face: 0 });
        });
        s.built = true;
      }

      /**
       * A tile's look for its type: with tile art, the steampunk face on top
       * (the star's face under the star) and a steel rim; else a colour and an icon.
       */
      function dress(t, type, star) {
        const face = s.art ? (star ? 'star' : type) : type;
        if (t.face === face) return;
        t.face = face;
        if (t.icon) { scene.remove(t.icon); t.icon = null; }
        if (s.art) {
          if (t.faceMesh) t.faceMesh.material = artFace(face, true);
          else t.mesh.material = [s.steel, artFace(face), s.steel];
          return;
        }
        t.mesh.material = new T.MeshStandardMaterial({ color: COLORS[type] || 0x64748b, roughness: 0.5 });
        if (ICON[type]) {
          t.icon = emojiSprite(T, ICON[type], 0.8);
          t.icon.position.set(t.mesh.position.x, 0.85, t.mesh.position.z);
          scene.add(t.icon);
        }
      }

      /** One shared material per face image (loaded once); `model`: for the tile model's face. */
      function artFace(face, model) {
        const key = face + (model ? ':model' : '');
        if (!s.faces[key]) {
          const tex = new T.TextureLoader().load('/games/party-board/tiles/' + face + '.webp');
          tex.colorSpace = T.SRGBColorSpace;
          tex.anisotropy = 4;
          if (model) tex.flipY = false; // glTF texture coordinates
          else {
            // A cylinder's cap maps the image a quarter turn off: turn it upright (as seen from the camera).
            tex.center.set(0.5, 0.5);
            tex.rotation = Math.PI / 2;
          }
          // A little self-light so the art reads on dark maps too.
          s.faces[key] = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.1 });
        }
        return s.faces[key];
      }

      /**
       * Swap the plain tiles for the tile model (models/tile.glb) once it loads: its body is
       * drawn for every tile in one batch per material; each tile keeps its own face.
       */
      function useModel(m) {
        if (s.disposed || !s.art) return;
        s.model = m;
        s.top = m.top;
        const matrix = new T.Matrix4();
        m.body.forEach(function (part) {
          const inst = new T.InstancedMesh(part.geometry, part.material, s.tiles.length);
          s.tiles.forEach(function (t, i) {
            matrix.makeScale(m.scale, m.scale, m.scale).setPosition(t.mesh.position.x, m.lift, t.mesh.position.z);
            inst.setMatrixAt(i, matrix);
          });
          scene.add(inst);
        });
        s.tiles.forEach(function (t) {
          t.mesh.visible = false;
          t.faceMesh = new T.Mesh(m.face, artFace(t.face, true));
          t.faceMesh.scale.setScalar(m.scale);
          t.faceMesh.position.set(t.mesh.position.x, m.lift, t.mesh.position.z);
          scene.add(t.faceMesh);
        });
      }

      function useProp(name, m) {
        if (s.disposed) return;
        s.props[name] = m;
        if (FIGURES.indexOf(name) !== -1) [0, 1].forEach(dressFigure);
        if (name === 'star' && s.star) {
          const star = propObject(T, m, 1.4);
          // The prize: a warm glow so it reads from across the board.
          star.children.forEach(function (o) { o.material.emissive.setHex(0x6b4a00); o.material.emissiveIntensity = 0.6; });
          scene.remove(s.star);
          scene.add(star);
          s.star = star;
        }
      }

      /**
       * A player's piece: the miniature they picked (view.characters), once its model is in,
       * with a ring in the player's colour under it; else the toy figure.
       */
      function dressFigure(slot) {
        const fig = s.figs[slot];
        const name = 'figure-' + ((s.last && s.last.characters && s.last.characters[slot]) || ['engineer', 'mechanic'][slot]);
        const m = s.props[name];
        if (!fig || !m || fig.model === name) return;
        fig.model = name;
        fig.f.body.clear();
        const mini = propObject(T, m, 1);
        mini.scale.setScalar(1.05 / m.size.x); // its base a little narrower than a tile
        mini.position.y = (m.size.y / 2) * mini.scale.x;
        fig.f.body.add(mini);
        s.apart = 0.55; // two miniatures on one space stand further apart than toy figures
        if (!fig.ring) {
          fig.ring = new T.Mesh(new T.TorusGeometry(0.56, 0.05, 8, 40), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[slot], emissive: ArkMini.P_COLORS[slot], emissiveIntensity: 0.8 }));
          fig.ring.rotation.x = Math.PI / 2;
          fig.ring.position.y = 0.04;
          fig.f.group.add(fig.ring);
        }
      }

      /** The winner's pedestal (built at the first end), brass with a gold top, and its confetti. */
      function pedestal() {
        if (s.pedestal) return;
        const g = new T.Group();
        const brass = mat(T, 0xb08d57, { roughness: 0.4, metalness: 0.45 });
        const gold = mat(T, 0xe8b931, { roughness: 0.3, metalness: 0.45, emissive: 0x4a3200 });
        [[1.15, 1.3, 0.4, 0.2, brass], [0.8, 0.9, 1.0, 0.9, brass], [1.1, 1.0, 0.2, 1.5, gold]].forEach(function (c) {
          const m = new T.Mesh(new T.CylinderGeometry(c[0], c[1], c[2], 40), c[4]);
          m.position.y = c[3];
          g.add(m);
        });
        g.position.set(PEDESTAL.x, 0, PEDESTAL.z);
        scene.add(g);
        s.pedestal = g;
        const colors = [0xfacc15, 0x22d3ee, 0xf472b6, 0xffffff];
        s.confetti = [];
        for (let k = 0; k < 70; k++) {
          const c = new T.Mesh(new T.PlaneGeometry(0.14, 0.08), new T.MeshBasicMaterial({ color: colors[k % 4], side: T.DoubleSide }));
          c.userData = { x: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 3, y0: Math.random() * 6, v: 0.6 + Math.random() * 0.8, spin: Math.random() * 6 };
          c.visible = false;
          scene.add(c);
          s.confetti.push(c);
        }
      }

      /** Where a winner stands on the pedestal (side by side on a draw). */
      function onPedestal(slot) {
        const two = s.victory.slots.length > 1;
        return new T.Vector3(PEDESTAL.x + (two ? (slot ? 0.55 : -0.55) : 0), PEDESTAL.top, PEDESTAL.z);
      }

      /** Coins pop up from a figure when it gains (fall away when it loses), one per 3 or so. */
      function coinPops(slot, delta, now) {
        if (!s.props.coin || !delta) return;
        const from = s.figs[slot].f.group.position;
        const n = Math.min(6, Math.ceil(Math.abs(delta) / 3));
        for (let k = 0; k < n; k++) {
          const coin = propObject(T, s.props.coin, 0.75);
          coin.visible = false;
          coin.rotation.order = 'YXZ'; // stood on its edge, spinning about the vertical
          scene.add(coin);
          s.pops.push({ obj: coin, size: coin.scale.x, x: from.x, z: from.z, gain: delta > 0, t0: now + k * 90, a: (k / n) * Math.PI * 2 + slot });
        }
      }

      /** Where a figure stands on `space` (side by side when both are there). */
      function standing(v, slot, space) {
        const p = at(T, v.board.spaces[space]);
        if (v.players[1 - slot].space === space) p.x += slot ? s.apart : -s.apart;
        p.y = s.top;
        return p;
      }

      function dieFor(n) {
        if (s.props.die) {
          const d = propObject(T, s.props.die, 1.15);
          scene.add(d);
          return d;
        }
        const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), dieMaterials(T, n));
        m.castShadow = true;
        scene.add(m);
        return m;
      }

      /**
       * At a fork: a big number over each branch's first space and a ring on each of its spaces;
       * the branch a controller points at (`sel`, or -1) glows brighter.
       */
      function forkMarks(v, sel) {
        const p = v.prompt;
        const routes = p && p.kind === 'path' && p.extra.routes;
        const key = routes ? JSON.stringify(routes) + ':' + sel : '';
        if (key === s.forkKey) return;
        s.forkKey = key;
        if (s.fork) { scene.remove(s.fork); s.fork = null; }
        if (!routes) return;
        s.fork = new T.Group();
        const ring = new T.TorusGeometry(0.78, 0.07, 8, 40);
        routes.forEach(function (r, k) {
          const on = sel === k;
          const color = new T.Color(ROUTE_COLORS[k]);
          const m = new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: on ? 1.4 : 0.5 });
          r.forEach(function (i) {
            const ringMesh = new T.Mesh(ring, m);
            const p2 = at(T, v.board.spaces[i]);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.set(p2.x, s.top + 0.06, p2.z);
            if (on) ringMesh.scale.setScalar(1.12);
            s.fork.add(ringMesh);
          });
          const badge = numberSprite(T, k + 1, ROUTE_COLORS[k]);
          const first = at(T, v.board.spaces[r[0]]);
          badge.position.set(first.x, s.top + 2.1, first.z);
          badge.scale.setScalar(on ? 1.5 : 1.15);
          s.fork.add(badge);
        });
        scene.add(s.fork);
      }

      function update(v, opts) {
        if (!s.built) build(v);
        forkMarks(v, opts && opts.forkSel !== undefined ? opts.forkSel : -1);
        const now = performance.now();
        const prev = s.last;
        // The star: glides to its new spot (and the camera looks there for a moment).
        const starTo = at(T, v.board.spaces[v.board.star]);
        if (!starTo.equals(s.starTarget)) {
          s.starTarget = starTo;
          s.starFocusUntil = now + 1600;
        }
        // Hazards (Harsh mode) differ per match, and the star moves: redress tiles.
        v.board.spaces.forEach(function (sp, i) {
          if (s.tiles[i]) dress(s.tiles[i], sp.type, i === v.board.star);
        });
        s.last = v; // dressFigure reads the picks from it
        [0, 1].forEach(dressFigure);
        // The end: the winner (both on a draw) flies up onto the pedestal.
        if (v.phase === 'over' && !s.victory) {
          pedestal();
          s.victory = { t0: now, slots: v.draw ? [0, 1] : [v.winner] };
          s.victory.slots.forEach(function (slot) {
            const fig = s.figs[slot];
            const to = onPedestal(slot);
            fig.from = fig.f.group.position.clone();
            fig.to = to;
            fig.t0 = now;
            fig.kind = 'fly';
            const mid = fig.from.clone().add(to).multiplyScalar(0.5);
            mid.y = PEDESTAL.top + 4;
            fig.curve = new T.QuadraticBezierCurve3(new T.Vector3(fig.from.x, fig.from.y + 0.08, fig.from.z), mid, new T.Vector3(to.x, to.y + 0.08, to.z));
          });
        } else if (v.phase !== 'over' && s.victory) {
          s.victory = null; // a rematch: back to the board
          s.confetti.forEach(function (c) { c.visible = false; });
        }
        v.players.forEach(function (p, slot) {
          const fig = s.figs[slot];
          if (p.space !== fig.space) {
            const was = v.board.spaces[fig.space];
            const step = was.next.indexOf(p.space) !== -1;
            // Took a warp (its counter went up): fly over the board to wherever it sent you.
            const warped = prev && p.warps > prev.players[slot].warps;
            const fly = !step && warped && was.type === 'warp';
            fig.from = fig.f.group.position.clone();
            fig.to = standing(v, slot, p.space);
            fig.t0 = now;
            fig.curve = fly ? warpArc(T, fig.from, fig.to, s.top) : null;
            fig.kind = step ? 'hop' : fly ? 'fly' : /Tornado/.test(v.message || '') ? 'spin' : 'warp';
            fig.space = p.space;
          }
          if (prev && prev.phase === 'board' && v.phase === 'board') {
            const was = prev.players[slot];
            coinPops(slot, p.coins - was.coins, now);
            if (p.stars > was.stars || p.coins > was.coins) { fig.mood = 'jump'; fig.moodAt = now; }
            else if (p.stars < was.stars || p.coins < was.coins) { fig.mood = 'slump'; fig.moodAt = now; }
          }
        });
        // The die: drops in above the roller and tumbles, then shows the roll.
        const key = v.dice ? v.round + ':' + v.turn + ':' + v.dice.values.join() : '';
        if (key !== s.dieKey) {
          s.die.forEach(function (d) { scene.remove(d.mesh); if (d.plate) scene.remove(d.plate); });
          s.die = [];
          s.dieKey = key;
          if (v.dice) {
            s.dieShownAt = now;
            s.dieTurn = v.turn;
            s.die = v.dice.values.map(function (n, k) { return { mesh: dieFor('?'), n: n, k: k, settled: false }; });
          }
        }
        s.last = v;
      }

      gl.onFrame(function () {
        const v = s.last;
        if (!v || !s.built) return;
        const now = performance.now();
        const t = now / 1000;
        // Figures: hop / teleport / idle, plus a mood bounce.
        s.figs.forEach(function (fig, slot) {
          const g = fig.f.group;
          const body = fig.f.body;
          let y = s.top;
          body.scale.set(1, 1, 1);
          body.rotation.set(0, 0, 0);
          if (!fig.to) {
            fig.to = standing(v, slot, fig.space);
            g.position.copy(fig.to);
          }
          const k = fig.from ? Math.min(1, (now - fig.t0) / (fig.kind === 'hop' ? HOP_MS : fig.kind === 'fly' ? FLY_MS : TELE_MS)) : 1;
          if (fig.from && k < 1) {
            if (fig.kind === 'hop') {
              g.position.lerpVectors(fig.from, fig.to, k);
              y = s.top + Math.sin(k * Math.PI) * 0.9;
              body.scale.set(1 - Math.sin(k * Math.PI) * 0.12, 1 + Math.sin(k * Math.PI) * 0.18, 1);
              fig.face = Math.atan2(fig.to.x - fig.from.x, fig.to.z - fig.from.z);
            } else if (fig.kind === 'fly') {
              // Eased along the arc, then settling onto the target spot; a slow spin and a sparkle trail.
              const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
              const pt = fig.curve.getPoint(e);
              g.position.set(pt.x, 0, pt.z);
              y = pt.y - 0.08;
              if (k > 0.85) {
                const b = (k - 0.85) / 0.15;
                g.position.x += (fig.to.x - g.position.x) * b;
                g.position.z += (fig.to.z - g.position.z) * b;
              }
              body.rotation.y = e * Math.PI * 2;
              s.sparks.forEach(function (sp, i) {
                const q = fig.curve.getPoint(Math.max(0, e - 0.035 * (i + 1)));
                sp.visible = e > 0.02 && k < 0.95;
                sp.position.set(q.x, q.y + 0.5, q.z);
              });
            } else if (fig.kind === 'spin') {
              g.position.lerpVectors(fig.from, fig.to, k);
              y = s.top + Math.sin(k * Math.PI) * 3.5;
              body.rotation.y = k * Math.PI * 8;
            } else {
              // Warp: shrink away, reappear at the target.
              g.position.copy(k < 0.5 ? fig.from : fig.to);
              const sc = Math.abs(1 - k * 2);
              body.scale.set(sc, sc, sc);
            }
          } else {
            if (fig.from) {
              g.position.copy(fig.to);
              if (fig.kind === 'fly') s.sparks.forEach(function (sp) { sp.visible = false; });
              fig.from = null;
            }
            const winner = s.victory && s.victory.slots.indexOf(slot) !== -1;
            // Keep side by side when both share a space (a winner: on the pedestal).
            const want = winner ? onPedestal(slot) : standing(v, slot, fig.space);
            g.position.x += (want.x - g.position.x) * 0.15;
            g.position.z += (want.z - g.position.z) * 0.15;
            const turn = v.phase === 'board' && v.turn === slot;
            y = winner ? PEDESTAL.top + Math.abs(Math.sin(t * 2.5)) * 0.25 : s.top + (turn ? Math.abs(Math.sin(t * 3)) * 0.12 : Math.sin(t * 2 + slot) * 0.03);
            if (winner) fig.face = t * 1.4; // a slow victory spin
            const big = winner ? PEDESTAL.scale / (s.victory.slots.length > 1 ? 1.3 : 1) : 1;
            g.scale.setScalar(g.scale.x + (big - g.scale.x) * 0.15);
          }
          if (fig.mood) {
            const m = (now - fig.moodAt) / MOOD_MS;
            if (m >= 1) fig.mood = null;
            else if (fig.mood === 'jump') y += Math.abs(Math.sin(m * Math.PI * 2)) * 0.8;
            else { body.scale.y *= 0.82; body.rotation.x = 0.35 * Math.sin(m * Math.PI); }
          }
          g.position.y = y;
          const lift = Math.max(0, y - (s.victory && s.victory.slots.indexOf(slot) !== -1 && !fig.from ? PEDESTAL.top : s.top));
          const ground = s.victory && s.victory.slots.indexOf(slot) !== -1 && !fig.from ? PEDESTAL.top : s.top;
          fig.blob.position.set(g.position.x, ground + 0.015, g.position.z);
          fig.blob.scale.setScalar(Math.max(0.35, 1 - lift * 0.25) * body.scale.x);
          fig.blob.material.opacity = Math.max(0.12, 0.35 - lift * 0.06);
          if (s.victory && s.victory.slots.indexOf(slot) !== -1 && !fig.from) g.rotation.y = fig.face;
          else g.rotation.y += ((fig.face || 0) - g.rotation.y) * 0.2;
        });
        // Confetti over the pedestal.
        if (s.victory && s.confetti) {
          s.confetti.forEach(function (c) {
            const d = c.userData;
            const y = 7 - ((d.y0 + (now - s.victory.t0) / 1000 * d.v) % 7);
            c.visible = true;
            c.position.set(PEDESTAL.x + d.x + Math.sin(t * 2 + d.spin) * 0.3, y, PEDESTAL.z + d.z);
            c.rotation.set(t * 3 + d.spin, t * 2 + d.spin, 0);
          });
        }
        // The map's own motion (ghosts, smoke, lava).
        if (s.tick) s.tick(t);
        // The star floats and spins, gliding to a new spot.
        s.starAt.lerp(s.starTarget, 0.05);
        s.star.position.set(s.starAt.x, s.top + 3 + Math.sin(t * 2) * 0.15, s.starAt.z); // above a figure on its spot
        s.star.rotation.y = t * 1.6;
        s.star.visible = !s.victory; // the end belongs to the winner
        // The die: tumbles in, then lands showing the roll.
        s.die.forEach(function (d) {
          const roller = s.figs[s.dieTurn].f.group.position;
          const dk = Math.min(1, (now - s.dieShownAt) / DIE_MS);
          d.mesh.position.set(roller.x + (d.k - (s.die.length - 1) / 2) * 1.3, 3.4 + (1 - dk) * 3, roller.z);
          if (dk < 1) {
            d.mesh.rotation.set(t * 9 + d.k, t * 7, t * 5);
          } else if (!d.settled) {
            d.settled = true;
            d.mesh.rotation.set(0.35, 0.6, 0);
            if (d.mesh.isGroup) {
              // The model die has pips for 1-6 only: the roll shows on a plate above it.
              d.plate = numberPlate(T, d.n);
              scene.add(d.plate);
            } else d.mesh.material = dieMaterials(T, d.n);
          }
          if (d.plate) d.plate.position.set(d.mesh.position.x, d.mesh.position.y + 1.15, d.mesh.position.z);
        });
        // Coin pops: up and away when gained; out from overhead and down to the ground when lost.
        s.pops = s.pops.filter(function (c) {
          const u = (now - c.t0) / POP_MS;
          if (u < 0) return true;
          if (u >= 1) { scene.remove(c.obj); return false; }
          c.obj.visible = true;
          const out = (c.gain ? 0.9 : 1.8) * u;
          c.obj.position.set(c.x + Math.cos(c.a) * out, 0, c.z + Math.sin(c.a) * out);
          c.obj.position.y = c.gain ? s.top + 1.9 + u * 2.4 : s.top + 2.4 + Math.sin(u * Math.PI) * 0.8 - u * 2.3;
          c.obj.rotation.set(Math.PI / 2 - 0.3, t * 6 + c.a, 0);
          c.obj.scale.setScalar(c.size * (u > 0.75 ? 1 - (u - 0.75) * 4 : 1));
          return true;
        });
        // Camera: follows a figure flying a warp (a bit higher); else the player whose turn it is;
        // the star when it moves; the whole board otherwise.
        let target;
        let offset;
        const flyer = s.figs.filter(function (fig) { return fig.from && fig.kind === 'fly'; })[0];
        if (flyer) {
          // Between the figure and where it lands, so both stay in view.
          target = flyer.f.group.position.clone().lerp(flyer.to, 0.5);
          target.y = 0.5;
          offset = new T.Vector3(0, 12, 11);
        } else if (now < s.starFocusUntil) {
          target = s.starAt.clone();
          offset = new T.Vector3(0, 7, 7.5);
        } else if (s.victory) {
          // The pedestal on the right of the screen, beside the recap card (on the left).
          target = new T.Vector3(PEDESTAL.x - 2.2, PEDESTAL.top + 1.2, PEDESTAL.z);
          offset = new T.Vector3(0, 2.2, 7.2);
        } else if (v.phase === 'board') {
          target = s.figs[v.turn].f.group.position.clone();
          target.y = 0.5;
          // At a fork, step back a little so both numbered branches are in view.
          offset = v.prompt && v.prompt.kind === 'path' ? new T.Vector3(0, 11, 10) : new T.Vector3(0, 8, 8.5);
        } else {
          target = new T.Vector3(0, 0, 0);
          offset = new T.Vector3(0, 17, 13);
        }
        s.look.lerp(target, flyer ? 0.14 : 0.06);
        s.cam.lerp(target.clone().add(offset), flyer ? 0.1 : 0.05);
        gl.camera.position.copy(s.cam);
        gl.camera.lookAt(s.look);
      });

      return { update: update, dispose: function () { s.disposed = true; gl.dispose(); } };
    });
  }

  window.PB3D = { create: create };
})();
