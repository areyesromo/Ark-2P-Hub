// Curling (server/games/minis/curling.js): the sheet in 3D on the TV, the camera riding behind the
// stone as it slides to the house. Phones: swipe to throw (the angle aims, the speed is the power, a
// curve in it is curl), then tap SWEEP fast while it slides. Controllers: the stick aims, hold A for
// power (the stick sideways as you let go is curl), then mash A to sweep.
(function () {
  const MAX_ANGLE = 0.35; // a swipe this far from straight up the screen is full aim
  const FULL_SPEED = 6; // screen heights a second = full power (a normal quick swipe is about 3/4: the house)
  const METER_MS = 1400;

  let host = null;
  const pads = [null, null];

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div><div class="mi-wind mi-curl-note"></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, mctx: mctx, s: null, gl: null, stones: [], camZ: 0 };
    host = h;
    ArkMini.scene3d(box, { fov: 45 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      const T = gl.THREE;
      gl.scene.background = new T.Color(0x0f172a);
      const S = { half: 1.1, button: 28, back: 32 };
      const ice = new T.Mesh(new T.PlaneGeometry(S.half * 2, S.back + 2), new T.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.15, metalness: 0.05 }));
      ice.rotation.x = -Math.PI / 2;
      ice.position.z = -(S.back + 2) / 2 + 1;
      ice.receiveShadow = true;
      gl.scene.add(ice);
      // The house: rings round the button.
      [[1.8, 0x2563eb], [1.2, 0xf8fafc], [0.6, 0xdc2626], [0.15, 0xf8fafc]].forEach(function (r, i) {
        const ring = new T.Mesh(new T.CircleGeometry(r[0], 48), new T.MeshStandardMaterial({ color: r[1], roughness: 0.3 }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.002 + i * 0.001, -S.button);
        gl.scene.add(ring);
      });
      [-1, 1].forEach(function (side) {
        const board = new T.Mesh(new T.BoxGeometry(0.1, 0.25, S.back + 2), new T.MeshStandardMaterial({ color: 0x475569 }));
        board.position.set(side * (S.half + 0.05), 0.12, -(S.back + 2) / 2 + 1);
        gl.scene.add(board);
      });
      gl.onFrame(function () { frame(h); });
    });
  }

  function stoneMesh(T, slot) {
    const g = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(0.145, 0.145, 0.11, 24), new T.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.2 }));
    body.position.y = 0.055;
    const top = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 20), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[slot], roughness: 0.4 }));
    top.position.y = 0.12;
    const handle = new T.Mesh(new T.BoxGeometry(0.15, 0.04, 0.04), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[slot] }));
    handle.position.y = 0.15;
    g.add(body, top, handle);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function frame(h) {
    if (!h.gl || !h.s) return;
    const s = h.s;
    const T = h.gl.THREE;
    // One mesh per stone (in the order the server lists them; rebuilt if that changes).
    const key = s.stones.map(function (st) { return st.slot; }).join('');
    if (h.key !== key) {
      h.stones.forEach(function (m) { h.gl.scene.remove(m); });
      h.stones = s.stones.map(function (st) { const m = stoneMesh(T, st.slot); h.gl.scene.add(m); m.position.set(st.x, 0, -st.z); return m; });
      h.key = key;
    }
    // The stone waiting to be thrown, in the thrower's colour.
    if (!h.ready || h.readySlot !== s.turn) {
      if (h.ready) h.gl.scene.remove(h.ready);
      h.ready = stoneMesh(T, s.turn);
      h.readySlot = s.turn;
      h.gl.scene.add(h.ready);
    }
    h.ready.visible = s.phase === 'aim';
    s.stones.forEach(function (st, i) {
      const m = h.stones[i];
      m.position.x += (st.x - m.position.x) * 0.4;
      m.position.z += (-st.z - m.position.z) * 0.4;
    });
    // The camera: behind the stone that's furthest along and still moving, else looking at the house.
    const moving = s.stones.filter(function (st) { return st.moving; }).sort(function (a, b) { return b.z - a.z; })[0];
    const want = moving ? Math.min(moving.z, s.sheet.button - 5) : s.phase === 'aim' ? 0 : s.sheet.button - 5;
    h.camZ += (want - h.camZ) * 0.12;
    // A controller player's aim: a line down the ice (and the power, while they hold A).
    const pad = s.phase === 'aim' ? pads[s.turn] : null;
    // The throw clock, counting down on the TV.
    if (s.phase === 'aim' && !pad) {
      const left = Math.max(0, Math.ceil((s.throwBy - h.mctx.t()) / 1000));
      const note = h.box.querySelector('.mi-curl-note');
      const txt = '⏱ ' + left + 's to throw';
      if (left <= 10 && note.dataset.left !== txt) {
        note.dataset.left = txt;
        note.textContent = txt;
      }
    }
    if (!h.aim) {
      h.aim = new T.Mesh(new T.PlaneGeometry(0.03, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
      h.aim.rotation.x = -Math.PI / 2;
      h.gl.scene.add(h.aim);
    }
    h.aim.visible = Boolean(pad);
    if (pad) {
      const a = pad.aim * 0.04;
      h.aim.rotation.z = -a;
      h.aim.position.set(Math.sin(a) * 4, 0.01, -Math.cos(a) * 4);
      const power = pad.charging ? (function () { const u = ((performance.now() - pad.t0) / METER_MS) % 2; return u <= 1 ? u : 2 - u; })() : null;
      const note = h.box.querySelector('.mi-curl-note');
      const txt = power === null ? 'Aim with the stick, hold A' : 'Power ' + Math.round(power * 100) + '%';
      if (note.textContent !== txt) note.textContent = txt;
    }
    h.gl.camera.position.set(0, 2.2, -h.camZ + 3.2);
    h.gl.camera.lookAt(0, 0, -h.camZ - 7);
  }

  function labels(h) {
    const s = h.s;
    const el = h.box.querySelectorAll('.mi-3dlabels > span');
    [0, 1].forEach(function (i) {
      el[i].innerHTML = ArkMini.nameOf({ players: h.mctx.players }, i) + ' · 🥌 ' + (s.stonesEach - s.thrown[i]) + ' left' + (s.sweeping[i] ? ' · 🧹' : '');
    });
    h.box.querySelector('.mi-curl-note').innerHTML = s.phase === 'aim' ? ArkMini.nameOf({ players: h.mctx.players }, s.turn) + ' to throw' : s.phase === 'sliding' ? 'Sweep! 🧹' : '';
  }

  /** A swipe up the screen: its angle, speed and curve (as Bowling's). */
  function swipeThrow(pts, h) {
    const end = pts[pts.length - 1];
    let i = pts.length - 1;
    while (i > 0 && end.t - pts[i - 1].t < 140) i--;
    const a = pts[i];
    const start = pts[0];
    const cx = end.x - start.x;
    const cy = end.y - start.y;
    const len = Math.hypot(cx, cy);
    if (-cy < h * 0.15 || len < 40) return null;
    const speed = Math.hypot(end.x - a.x, end.y - a.y) / Math.max(16, end.t - a.t);
    let bow = 0;
    pts.forEach(function (p) {
      const d = (cx * (p.y - start.y) - cy * (p.x - start.x)) / len;
      if (Math.abs(d) > Math.abs(bow)) bow = d;
    });
    const r2 = function (n) { return Math.round(n * 100) / 100; };
    return {
      type: 'throw',
      aim: r2(Math.max(-1, Math.min(1, Math.atan2(cx, -cy) / MAX_ANGLE))),
      power: r2(Math.max(0, Math.min(1, (speed * 1000) / (h * FULL_SPEED)))),
      curl: r2(Math.max(-1, Math.min(1, (-bow / len) * 5))),
    };
  }

  function phoneApi() {
    let phone = null;
    return {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-curl-phone"><div class="msg"></div><div class="sheet"><span class="stone"></span><span class="hint">⬆️ Swipe up to throw</span></div>' +
          '<button class="primary mi-big-btn sweep hidden">🧹 SWEEP! (tap fast)</button></div>';
        const p = { el: el, mctx: mctx, slot: mctx.slot, s: null, pts: null };
        phone = p;
        const sheet = el.querySelector('.sheet');
        sheet.addEventListener('pointerdown', function (e) {
          if (!p.s || p.s.phase !== 'aim' || p.s.turn !== p.slot) return;
          sheet.setPointerCapture(e.pointerId);
          const r = sheet.getBoundingClientRect();
          p.pts = [{ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }];
        });
        sheet.addEventListener('pointermove', function (e) {
          if (!p.pts) return;
          const r = sheet.getBoundingClientRect();
          p.pts.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp });
          if (p.pts.length > 80) p.pts.shift();
        });
        const up = function () {
          if (!p.pts) return;
          const pts = p.pts;
          p.pts = null;
          const t = pts.length > 2 && swipeThrow(pts, sheet.clientHeight);
          if (!t) return;
          mctx.send(t);
          mctx.vibrate(25);
        };
        sheet.addEventListener('pointerup', up);
        sheet.addEventListener('pointercancel', up);
        el.querySelector('.sweep').addEventListener('pointerdown', function (e) {
          e.preventDefault();
          mctx.send({ type: 'sweep' });
          mctx.vibrate(8);
        });
      },
      update: function (s) {
        if (!phone) return;
        const p = phone;
        p.s = s;
        const me = p.slot;
        const mine = s.turn === me;
        const msg = s.phase === 'aim' ? (mine ? 'Your throw: swipe up the ice (curve it to curl)' : 'Their throw…') : s.phase === 'sliding' ? (mine ? 'Sweep to carry it further!' : 'Their stone is sliding…') : '';
        p.el.querySelector('.msg').textContent = msg + ' · 🥌 ' + (s.stonesEach - s.thrown[me]) + ' left';
        p.el.querySelector('.sheet').classList.toggle('waiting', !(s.phase === 'aim' && mine));
        p.el.querySelector('.sweep').classList.toggle('hidden', !(s.phase === 'sliding' && mine));
      },
      unmount: function () { phone = null; },
    };
  }

  ArkMini.register('curling', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        host.s = s;
        labels(host);
      },
      unmount: function () {
        if (host && host.gl) host.gl.dispose();
        host = null;
        pads[0] = pads[1] = null;
      },
    },
    phone: phoneApi(),
    // Controllers: aim with the stick, hold A for power (the meter swings), let go to throw (the
    // stick sideways then is curl); while it slides, each press of A is a sweep.
    padPoll: function (pad, s, slot) {
      if (!pads[slot]) pads[slot] = { aim: 0, charging: false, t0: 0, n: 0, armed: false };
      const p = pads[slot];
      const held = pad.held.indexOf('A') !== -1 || pad.held.indexOf('RT') !== -1;
      // (A still down from pressing Ready doesn't start a throw: let go first)
      if (!held) p.armed = true;
      if (!p.armed) return null;
      const sx = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      if (s.phase === 'sliding' && s.turn === slot) {
        if (held && !p.wasHeld) {
          p.wasHeld = true;
          p.n++;
          return { type: 'sweep', n: p.n };
        }
        if (!held) p.wasHeld = false;
        return null;
      }
      if (s.phase !== 'aim' || s.turn !== slot) {
        p.charging = false;
        return null;
      }
      if (held) {
        if (!p.charging) {
          p.charging = true;
          p.t0 = performance.now();
        }
        return null;
      }
      if (p.charging) {
        p.charging = false;
        p.wasHeld = true;
        const u = ((performance.now() - p.t0) / METER_MS) % 2;
        p.n++;
        return { type: 'throw', aim: Math.round(p.aim * 100) / 100, power: Math.round((u <= 1 ? u : 2 - u) * 100) / 100, curl: Math.round(sx * 10) / 10, n: p.n };
      }
      p.aim = Math.max(-1, Math.min(1, p.aim + sx * 0.02));
      return null;
    },
    sounds: function (prev, s) {
      if (s.thrown[0] + s.thrown[1] > prev.thrown[0] + prev.thrown[1]) return ['whoosh'];
      if (s.stones.length < prev.stones.length) return ['crash'];
      return [];
    },
  });
})();
