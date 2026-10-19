// Glass Bridge (server/games/minis/glass-bridge.js): a 3D glass bridge on the TV, ◀ ▶ on the
// phone. Each row has a left and a right panel; one of them is fake.
(function () {
  const FALL_MS = 1500; // as on the server
  const GAP = 1.7; // rows apart (z)
  const LANE = 0.85; // panel centre from the middle (x)
  const PANEL = 1.25;

  const rowZ = function (row) { return 1.2 - row * GAP; }; // row -1: the start platform
  /** Where a runner stands: on the start platform, or on the panel of the row behind them. */
  function spot(r, slot, rows) {
    const off = slot ? 0.22 : -0.22;
    if (r.row === 0) return { x: off * 3, z: rowZ(-1) };
    if (r.row >= rows) return { x: off * 3, z: rowZ(rows) };
    return { x: (r.side ? LANE : -LANE) + off, z: rowZ(r.row - 1) };
  }

  let host = null;

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, s: null, gl: null, mctx: mctx, panels: null, figs: [], pos: [null, null], falls: [{}, {}] };
    host = h;
    ArkMini.scene3d(box, { fov: 40 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      gl.onFrame(function () { frame(h); });
      if (h.s) build(h);
    });
  }

  function build(h) {
    if (h.panels || !h.gl || !h.s) return;
    const T = h.gl.THREE;
    const rows = h.s.rows;
    const glass = new T.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 });
    h.held = new T.MeshStandardMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.6, roughness: 0.1, emissive: 0x14532d });
    const stone = new T.MeshStandardMaterial({ color: 0x475569 });
    const rail = new T.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
    const len = rows * GAP + 2;
    // A steel beam under each lane.
    [-LANE, LANE].forEach(function (x) {
      const m = new T.Mesh(new T.BoxGeometry(0.12, 0.12, len), rail);
      m.position.set(x, -0.14, (rowZ(-1) + rowZ(rows)) / 2);
      h.gl.scene.add(m);
    });
    [-1, rows].forEach(function (row) {
      const m = new T.Mesh(new T.BoxGeometry(4.2, 0.6, 1.6), stone);
      m.position.set(0, -0.3, rowZ(row) + (row < 0 ? 0.2 : -0.2));
      h.gl.scene.add(m);
    });
    const flag = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 4), new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x854d0e }));
    flag.position.set(0, 0.4, rowZ(rows) - 0.4);
    h.gl.scene.add(flag);
    h.panels = [];
    for (let row = 0; row < rows; row++) {
      h.panels.push([0, 1].map(function (side) {
        const m = new T.Mesh(new T.BoxGeometry(PANEL, 0.08, PANEL), glass);
        m.position.set(side ? LANE : -LANE, -0.04, rowZ(row));
        h.gl.scene.add(m);
        return m;
      }));
    }
    h.figs = [0, 1].map(function (p) {
      const g = new T.Group();
      const mat = new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[p], roughness: 0.5 });
      const body = new T.Mesh(new T.CapsuleGeometry(0.2, 0.45, 4, 12), mat);
      body.position.y = 0.45;
      const head = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), mat);
      head.position.y = 0.95;
      g.add(body, head);
      h.gl.scene.add(g);
      return g;
    });
    // From behind the start platform, looking down the bridge.
    h.gl.camera.position.set(0, 6, rowZ(-1) + 5);
    h.gl.camera.lookAt(0, -0.8, rowZ(rows / 2));
  }

  function frame(h) {
    const s = h.s;
    if (!s || !h.panels) return;
    s.broken.forEach(function (b, row) {
      [0, 1].forEach(function (side) {
        const m = h.panels[row][side];
        m.visible = !b[side];
        if (s.solid[row][side]) m.material = h.held;
      });
    });
    const now = performance.now();
    s.runners.forEach(function (r, p) {
      const g = h.figs[p];
      const f = h.falls[p];
      if (r.falling) {
        // Fall through the hole, then appear back at the start.
        const key = r.falling.row + ':' + r.falling.side + ':' + r.falls;
        if (f.key !== key) { f.key = key; f.at = now; f.x = r.falling.side ? LANE : -LANE; f.z = rowZ(r.falling.row); }
      }
      const into = f.at ? now - f.at : Infinity;
      if (into < FALL_MS * 0.8) {
        g.position.set(f.x + (p ? 0.22 : -0.22), -into * into / 40000, f.z);
        h.pos[p] = null;
        return;
      }
      const t = spot(r, p, s.rows);
      const cur = h.pos[p] || { x: t.x, z: t.z, hop: 0 };
      const d = Math.hypot(t.x - cur.x, t.z - cur.z);
      cur.x += (t.x - cur.x) * 0.25;
      cur.z += (t.z - cur.z) * 0.25;
      h.pos[p] = cur;
      g.position.set(cur.x, Math.min(0.6, d * 0.5), cur.z);
    });
  }

  ArkMini.register('glass-bridge', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        host.s = s;
        build(host);
        const lab = function (p) {
          const r = s.runners[p];
          return ArkMini.nameOf({ players: host.mctx.players }, p) + ' · ' + (r.row >= s.rows ? '🏁' : 'row ' + r.row + '/' + s.rows) + (r.falls ? ' · 💥' + r.falls : '');
        };
        host.box.querySelector('.l').innerHTML = lab(0);
        host.box.querySelector('.r').innerHTML = lab(1);
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-bridge-phone"><div class="msg"></div><div class="lr"><button class="primary mi-big-btn" data-side="0">◀</button><button class="primary mi-big-btn" data-side="1">▶</button></div></div>';
          phone = { el: el, slot: mctx.slot };
          el.addEventListener('pointerdown', function (e) {
            const b = e.target.closest('[data-side]');
            if (!b || b.disabled) return;
            mctx.send({ type: 'pick', side: Number(b.getAttribute('data-side')) });
            mctx.vibrate(15);
          });
        },
        update: function (s) {
          if (!phone) return;
          const r = s.runners[phone.slot];
          const them = s.runners[1 - phone.slot];
          phone.el.querySelector('.msg').textContent = (r.falling ? '💥 You fell! Back to the start · ' : '') + 'Row ' + Math.min(r.row + 1, s.rows) + ' of ' + s.rows + ' · them ' + them.row;
          const broken = r.row < s.rows ? s.broken[r.row] : [true, true];
          const held = r.row < s.rows ? s.solid[r.row] : [false, false];
          phone.el.querySelectorAll('[data-side]').forEach(function (b, side) {
            b.disabled = broken[side];
            b.textContent = (side ? '' : '◀ ') + (broken[side] ? '💥' : held[side] ? '✅' : '🪟') + (side ? ' ▶' : '');
          });
        },
        unmount: function () { phone = null; },
      };
    })(),
    pad: function (btn) {
      if (btn === 'LEFT' || btn === 'X') return { type: 'pick', side: 0 };
      if (btn === 'RIGHT' || btn === 'B') return { type: 'pick', side: 1 };
      return null;
    },
    sounds: function (prev, s) {
      const fell = s.runners.some(function (r, i) { return r.falls > prev.runners[i].falls; });
      const step = s.runners.some(function (r, i) { return r.row > prev.runners[i].row; });
      return fell ? ['crash'] : step ? ['drop'] : [];
    },
  });
})();
