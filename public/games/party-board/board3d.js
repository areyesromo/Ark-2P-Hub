// Party Board in 3D (Board view: 3D, Party Island): a sandy island in the sea,
// raised tiles joined by planks, a spinning ⭐, and two toy figures that hop
// space by space while the camera follows whoever's turn it is.
// PB3D.create(el) -> Promise<{ update(view), dispose() }>; uses ArkMini.scene3d.
(function () {
  const HOP_MS = 230;
  const TELE_MS = 520;
  const MOOD_MS = 700;
  const DIE_MS = 650;
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

  function create(el) {
    return ArkMini.scene3d(el, { fov: 42 }).then(function (gl) {
      const T = gl.THREE;
      const scene = gl.scene;
      scene.background = new T.Color(0x0b2a4a);

      // Sea and island.
      const sea = new T.Mesh(new T.PlaneGeometry(160, 160), new T.MeshStandardMaterial({ color: 0x1d6fb8, roughness: 0.35, metalness: 0.1 }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = -0.55;
      scene.add(sea);
      const island = new T.Mesh(new T.CylinderGeometry(14.5, 15.5, 0.9, 64), new T.MeshStandardMaterial({ color: 0xe9d8a6, roughness: 0.95 }));
      island.scale.z = 0.66;
      island.position.y = -0.45;
      island.receiveShadow = true;
      scene.add(island);
      const lawn = new T.Mesh(new T.CylinderGeometry(7.6, 7.6, 0.08, 48), new T.MeshStandardMaterial({ color: 0x4d9a3a, roughness: 1 }));
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

      const s = {
        built: false, tiles: [], star: null, starAt: null, starTarget: null, starFocusUntil: 0,
        figs: [], last: null, die: [], dieKey: '', dieShownAt: 0, cam: new T.Vector3(0, 17, 13), look: new T.Vector3(0, 0, 0),
      };

      function build(v) {
        const plank = new T.MeshStandardMaterial({ color: 0x8d6e4a, roughness: 0.9 });
        v.board.spaces.forEach(function (sp, i) {
          const p = at(T, sp);
          const tile = new T.Mesh(new T.CylinderGeometry(0.62, 0.68, 0.32, 28), new T.MeshStandardMaterial({ color: COLORS[sp.type] || 0x64748b, roughness: 0.5 }));
          tile.position.set(p.x, 0.16, p.z);
          tile.castShadow = tile.receiveShadow = true;
          scene.add(tile);
          let icon = null;
          if (ICON[sp.type]) {
            icon = emojiSprite(T, ICON[sp.type], 0.8);
            icon.position.set(p.x, 0.85, p.z);
            scene.add(icon);
          }
          s.tiles.push({ mesh: tile, icon: icon, type: sp.type });
          sp.next.forEach(function (n) {
            const q = at(T, v.board.spaces[n]);
            const d = q.clone().sub(p);
            const len = Math.max(0.1, d.length() - 1.1);
            const m = new T.Mesh(new T.BoxGeometry(0.28, 0.07, len), plank);
            m.position.copy(p.clone().add(q).multiplyScalar(0.5));
            m.position.y = 0.05;
            m.rotation.y = Math.atan2(d.x, d.z);
            m.receiveShadow = true;
            scene.add(m);
          });
        });
        const star = new T.Mesh(new T.ExtrudeGeometry(starShape(T), { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }),
          new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x8a6d00, roughness: 0.3, metalness: 0.3 }));
        star.castShadow = true;
        scene.add(star);
        s.star = star;
        s.starAt = at(T, v.board.spaces[v.board.star]);
        s.starTarget = s.starAt.clone();
        ['#22d3ee', '#f472b6'].forEach(function (css, slot) {
          const f = figure(T, slot ? 0xf472b6 : 0x22d3ee, v.names[slot], css);
          scene.add(f.group);
          s.figs.push({ f: f, space: v.players[slot].space, from: null, to: null, t0: 0, kind: null, mood: null, moodAt: 0, face: 0 });
        });
        s.built = true;
      }

      /** Where a figure stands on `space` (side by side when both are there). */
      function standing(v, slot, space) {
        const p = at(T, v.board.spaces[space]);
        if (v.players[1 - slot].space === space) p.x += slot ? 0.42 : -0.42;
        p.y = 0.32;
        return p;
      }

      function dieFor(n) {
        const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), dieMaterials(T, n));
        m.castShadow = true;
        scene.add(m);
        return m;
      }

      function update(v) {
        if (!s.built) build(v);
        const now = performance.now();
        const prev = s.last;
        // The star: glides to its new spot (and the camera looks there for a moment).
        const starTo = at(T, v.board.spaces[v.board.star]);
        if (!starTo.equals(s.starTarget)) {
          s.starTarget = starTo;
          s.starFocusUntil = now + 1600;
        }
        // Hazards (Harsh mode) may differ per match: recolour tiles.
        v.board.spaces.forEach(function (sp, i) {
          const t = s.tiles[i];
          if (t && t.type !== sp.type) {
            t.type = sp.type;
            t.mesh.material.color.setHex(COLORS[sp.type] || 0x64748b);
            if (t.icon) { scene.remove(t.icon); t.icon = null; }
            if (ICON[sp.type]) {
              t.icon = emojiSprite(T, ICON[sp.type], 0.8);
              t.icon.position.set(t.mesh.position.x, 0.85, t.mesh.position.z);
              scene.add(t.icon);
            }
          }
        });
        v.players.forEach(function (p, slot) {
          const fig = s.figs[slot];
          if (p.space !== fig.space) {
            const step = v.board.spaces[fig.space].next.indexOf(p.space) !== -1;
            fig.from = fig.f.group.position.clone();
            fig.to = standing(v, slot, p.space);
            fig.t0 = now;
            fig.kind = step ? 'hop' : /Tornado/.test(v.message || '') ? 'spin' : 'warp';
            fig.space = p.space;
          }
          if (prev && prev.phase === 'board' && v.phase === 'board') {
            const was = prev.players[slot];
            if (p.stars > was.stars || p.coins > was.coins) { fig.mood = 'jump'; fig.moodAt = now; }
            else if (p.stars < was.stars || p.coins < was.coins) { fig.mood = 'slump'; fig.moodAt = now; }
          }
        });
        // The die: drops in above the roller and tumbles, then shows the roll.
        const key = v.dice ? v.round + ':' + v.turn + ':' + v.dice.values.join() : '';
        if (key !== s.dieKey) {
          s.die.forEach(function (d) { scene.remove(d.mesh); });
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
          let y = 0.32;
          body.scale.set(1, 1, 1);
          body.rotation.set(0, 0, 0);
          if (!fig.to) {
            fig.to = standing(v, slot, fig.space);
            g.position.copy(fig.to);
          }
          const k = fig.from ? Math.min(1, (now - fig.t0) / (fig.kind === 'hop' ? HOP_MS : TELE_MS)) : 1;
          if (fig.from && k < 1) {
            if (fig.kind === 'hop') {
              g.position.lerpVectors(fig.from, fig.to, k);
              y = 0.32 + Math.sin(k * Math.PI) * 0.9;
              body.scale.set(1 - Math.sin(k * Math.PI) * 0.12, 1 + Math.sin(k * Math.PI) * 0.18, 1);
              fig.face = Math.atan2(fig.to.x - fig.from.x, fig.to.z - fig.from.z);
            } else if (fig.kind === 'spin') {
              g.position.lerpVectors(fig.from, fig.to, k);
              y = 0.32 + Math.sin(k * Math.PI) * 3.5;
              body.rotation.y = k * Math.PI * 8;
            } else {
              // Warp: shrink away, reappear at the target.
              g.position.copy(k < 0.5 ? fig.from : fig.to);
              const sc = Math.abs(1 - k * 2);
              body.scale.set(sc, sc, sc);
            }
          } else {
            if (fig.from) { g.position.copy(fig.to); fig.from = null; }
            // Keep side by side when both share a space.
            const want = standing(v, slot, fig.space);
            g.position.x += (want.x - g.position.x) * 0.15;
            g.position.z += (want.z - g.position.z) * 0.15;
            const turn = v.phase === 'board' && v.turn === slot;
            y = 0.32 + (turn ? Math.abs(Math.sin(t * 3)) * 0.12 : Math.sin(t * 2 + slot) * 0.03);
          }
          if (fig.mood) {
            const m = (now - fig.moodAt) / MOOD_MS;
            if (m >= 1) fig.mood = null;
            else if (fig.mood === 'jump') y += Math.abs(Math.sin(m * Math.PI * 2)) * 0.8;
            else { body.scale.y *= 0.82; body.rotation.x = 0.35 * Math.sin(m * Math.PI); }
          }
          g.position.y = y;
          g.rotation.y += ((fig.face || 0) - g.rotation.y) * 0.2;
        });
        // The star floats and spins, gliding to a new spot.
        s.starAt.lerp(s.starTarget, 0.05);
        s.star.position.set(s.starAt.x, 1.9 + Math.sin(t * 2) * 0.15, s.starAt.z);
        s.star.rotation.y = t * 1.6;
        // The die: tumbles in, then lands showing the roll.
        s.die.forEach(function (d) {
          const roller = s.figs[s.dieTurn].f.group.position;
          const dk = Math.min(1, (now - s.dieShownAt) / DIE_MS);
          d.mesh.position.set(roller.x + (d.k - (s.die.length - 1) / 2) * 1.3, 3.4 + (1 - dk) * 3, roller.z);
          if (dk < 1) {
            d.mesh.rotation.set(t * 9 + d.k, t * 7, t * 5);
          } else if (!d.settled) {
            d.settled = true;
            d.mesh.material = dieMaterials(T, d.n);
            d.mesh.rotation.set(0.35, 0.6, 0);
          }
        });
        // Camera: follows the player whose turn it is; the star when it moves; the whole island otherwise.
        let target;
        let offset;
        if (now < s.starFocusUntil) {
          target = s.starAt.clone();
          offset = new T.Vector3(0, 7, 7.5);
        } else if (v.phase === 'board') {
          target = s.figs[v.turn].f.group.position.clone();
          target.y = 0.5;
          offset = new T.Vector3(0, 8, 8.5);
        } else {
          target = new T.Vector3(0, 0, 0);
          offset = new T.Vector3(0, 17, 13);
        }
        s.look.lerp(target, 0.06);
        s.cam.lerp(target.clone().add(offset), 0.05);
        gl.camera.position.copy(s.cam);
        gl.camera.lookAt(s.look);
      });

      return { update: update, dispose: function () { gl.dispose(); } };
    });
  }

  window.PB3D = { create: create };
})();
