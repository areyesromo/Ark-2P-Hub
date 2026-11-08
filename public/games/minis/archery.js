// Archery (server/games/minis/archery.js): two targets down a 3D range on the TV, each player's
// sight wobbling over theirs (less once the bow's held drawn, more as arms tire), arrows where they
// land, a wind flag. Phones: drag to aim, hold DRAW, let go to shoot (or tilt the phone to aim, on
// the https page). Controllers: the stick aims, hold A to draw, let go to shoot.
(function () {
  const SEND_MS = 80;
  const TARGET_X = [-2.2, 2.2];
  const TARGET_Z = -9;
  const SCALE = 1.25; // a target's radius, in the 3D world
  const RINGS = [0xf8fafc, 0xf8fafc, 0x111827, 0x111827, 0x2563eb, 0x2563eb, 0xdc2626, 0xdc2626, 0xfacc15, 0xfacc15]; // (outside in: white, black, blue, red, gold)

  /** As the server's swayAt (server/games/minis/archery.js): keep the two the same. */
  function wobble(ms) {
    if (!isFinite(ms) || ms < 0) return 0.6;
    if (ms < 1200) return 0.6 - 0.45 * (ms / 1200);
    if (ms < 3500) return 0.15;
    return Math.min(1, 0.15 + ((ms - 3500) / 1000) * 0.15);
  }
  function swayAt(t, seed, drawnAt) {
    const a = wobble(drawnAt === null || drawnAt === undefined ? -1 : t - drawnAt);
    return [a * Math.sin(t / 430 + seed * 1.7), a * 0.8 * Math.sin(t / 610 + seed * 2.3)];
  }

  let host = null;
  const pads = [null, null]; // controller aim per slot: { x, y, drawn, key }

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div><div class="mi-wind"></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, mctx: mctx, s: null, gl: null, sights: null, arrows: [[], []], shown: [0, 0] };
    host = h;
    ArkMini.scene3d(box, { fov: 40 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      const T = gl.THREE;
      const grass = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.95 }));
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(0, -1.6, -10);
      grass.receiveShadow = true;
      gl.scene.add(grass);
      TARGET_X.forEach(function (x) {
        const g = new T.Group();
        for (let i = 0; i < 10; i++) {
          const ring = new T.Mesh(new T.CircleGeometry((10 - i) / 10 * SCALE, 48), new T.MeshStandardMaterial({ color: RINGS[i], roughness: 0.7 }));
          ring.position.z = i * 0.002;
          g.add(ring);
        }
        const stand = new T.Mesh(new T.BoxGeometry(0.15, 1.8, 0.15), new T.MeshStandardMaterial({ color: 0x78350f }));
        stand.position.set(0, -1.1, -0.2);
        stand.castShadow = true;
        g.add(stand);
        g.position.set(x, 0.3, TARGET_Z);
        gl.scene.add(g);
      });
      h.sights = [0, 1].map(function (p) {
        const ring = new T.Mesh(new T.RingGeometry(0.12, 0.18, 24), new T.MeshBasicMaterial({ color: ArkMini.P_COLORS[p] }));
        ring.position.z = TARGET_Z + 0.05;
        gl.scene.add(ring);
        return ring;
      });
      h.arrowGeo = new T.CylinderGeometry(0.035, 0.035, 1.1, 8);
      h.fletchGeo = new T.ConeGeometry(0.09, 0.22, 3);
      gl.camera.position.set(0, 1.4, 1);
      gl.camera.lookAt(0, 0.1, TARGET_Z);
      gl.onFrame(function () { frame(h); });
    });
  }

  function frame(h) {
    if (!h.gl || !h.s) return;
    const s = h.s;
    const T = h.gl.THREE;
    const t = h.mctx.t();
    [0, 1].forEach(function (p) {
      const done = s.arrows[p].length >= s.arrowsEach;
      const sw = swayAt(t, s.seeds[p], s.drawnAt[p]);
      h.sights[p].visible = !done;
      h.sights[p].position.x = TARGET_X[p] + (s.aims[p].x + sw[0]) * SCALE;
      h.sights[p].position.y = 0.3 - (s.aims[p].y + sw[1]) * SCALE;
      // Arrows: stuck where they landed (the wind's in it already).
      while (h.arrows[p].length < s.arrows[p].length) {
        const a = s.arrows[p][h.arrows[p].length];
        // A shaft stuck in at a slight angle (so you see it, not just its end), fletched in your colour.
        const m = new T.Group();
        const shaft = new T.Mesh(h.arrowGeo, new T.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.5 }));
        const fletch = new T.Mesh(h.fletchGeo, new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[p] }));
        fletch.position.y = -0.5;
        m.add(shaft, fletch);
        m.rotation.set(Math.PI / 2 - 0.35, 0, (p ? 1 : -1) * 0.25);
        m.position.set(TARGET_X[p] + a.x * SCALE, 0.3 - a.y * SCALE + 0.18, TARGET_Z + 0.5);
        m.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        h.gl.scene.add(m);
        h.arrows[p].push(m);
      }
    });
  }

  function labels(h) {
    const s = h.s;
    const el = h.box.querySelectorAll('.mi-3dlabels > span');
    [0, 1].forEach(function (i) {
      const rings = s.arrows[i].map(function (a) { return a.ring; }).join(' + ');
      el[i].innerHTML = ArkMini.nameOf({ players: h.mctx.players }, i) + ' · 🏹 ' + s.total[i] + (rings ? ' <small>(' + rings + ')</small>' : '');
    });
    const w = s.wind;
    h.box.querySelector('.mi-wind').textContent = '🚩 Wind ' + (Math.abs(w) < 0.05 ? 'calm' : (w > 0 ? '→ ' : '← ') + Math.round(Math.abs(w) * 100) / 10);
  }

  // ---- the phone: the target close up, your sight, DRAW ----

  function phoneApi() {
    let phone = null;
    function draw(p) {
      if (phone !== p) return;
      p.raf = requestAnimationFrame(function () { draw(p); });
      const s = p.s;
      const c = p.canvas;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.floor(r.width * dpr)) {
        c.width = Math.floor(r.width * dpr);
        c.height = Math.floor(r.height * dpr);
      }
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, r.width, r.height);
      if (!s) return;
      const R = Math.min(r.width, r.height) * 0.3;
      const cx = r.width / 2;
      const cy = r.height / 2;
      for (let i = 0; i < 10; i++) {
        g.fillStyle = '#' + RINGS[i].toString(16).padStart(6, '0');
        g.beginPath();
        g.arc(cx, cy, ((10 - i) / 10) * R, 0, Math.PI * 2);
        g.fill();
      }
      s.arrows[p.slot].forEach(function (a) {
        g.fillStyle = '#0f172a';
        g.beginPath();
        g.arc(cx + a.x * R, cy + a.y * R, 4, 0, Math.PI * 2);
        g.fill();
      });
      if (s.arrows[p.slot].length >= s.arrowsEach) return;
      const sw = swayAt(p.mctx.t(), s.seeds[p.slot], s.drawnAt[p.slot]);
      const x = cx + (p.aim.x + sw[0]) * R;
      const y = cy + (p.aim.y + sw[1]) * R;
      g.strokeStyle = getComputedStyle(p.el).getPropertyValue('--me') || '#22d3ee';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.moveTo(x - 18, y);
      g.lineTo(x + 18, y);
      g.moveTo(x, y - 18);
      g.lineTo(x, y + 18);
      g.stroke();
    }
    function sendAim(p, now) {
      const wait = SEND_MS - (Date.now() - p.lastSent);
      if (!now && wait > 0) {
        if (!p.timer) p.timer = setTimeout(function () { p.timer = null; sendAim(p, true); }, wait);
        return;
      }
      p.lastSent = Date.now();
      p.mctx.send({ type: 'aim', x: Math.round(p.aim.x * 1000) / 1000, y: Math.round(p.aim.y * 1000) / 1000 });
    }
    return {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-archery-phone"><div class="msg"></div><canvas class="sight"></canvas>' +
          '<div class="row"><button class="tilt hidden">📱 Tilt to aim</button><button class="primary mi-big-btn draw">🏹 Hold to DRAW</button></div></div>';
        const p = { el: el, mctx: mctx, slot: mctx.slot, s: null, aim: { x: 0, y: 0 }, canvas: el.querySelector('canvas'), drag: null, lastSent: 0, timer: null, tilt: null, raf: null };
        phone = p;
        // Drag anywhere on the target to move the sight (relative: fine control).
        p.canvas.addEventListener('pointerdown', function (e) { p.canvas.setPointerCapture(e.pointerId); p.drag = { x: e.clientX, y: e.clientY, ax: p.aim.x, ay: p.aim.y }; });
        p.canvas.addEventListener('pointermove', function (e) {
          if (!p.drag) return;
          const R = Math.min(p.canvas.clientWidth, p.canvas.clientHeight) * 0.3;
          p.aim.x = Math.max(-1.6, Math.min(1.6, p.drag.ax + (e.clientX - p.drag.x) / R));
          p.aim.y = Math.max(-1.6, Math.min(1.6, p.drag.ay + (e.clientY - p.drag.y) / R));
          sendAim(p, false);
        });
        p.canvas.addEventListener('pointerup', function () { p.drag = null; sendAim(p, true); });
        const drawBtn = el.querySelector('.draw');
        drawBtn.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          try { drawBtn.setPointerCapture(e.pointerId); } catch (err) { /* (no live pointer) */ }
          mctx.send({ type: 'draw', on: true });
          drawBtn.classList.add('on');
        });
        const release = function () {
          if (!drawBtn.classList.contains('on')) return;
          drawBtn.classList.remove('on');
          sendAim(p, true);
          mctx.send({ type: 'shoot' });
          mctx.vibrate(30);
        };
        drawBtn.addEventListener('pointerup', release);
        drawBtn.addEventListener('pointercancel', release);
        // Tilt to aim, where the phone can (the https page).
        Ark.loadScript('/shared/motion.js').then(function () {
          if (phone !== p || !window.ArkMotion) return;
          const btn = el.querySelector('.tilt');
          const stopProbe = ArkMotion.on(function () { stopProbe(); btn.classList.remove('hidden'); });
          btn.addEventListener('click', function () {
            ArkMotion.ask();
            if (p.tilt) { p.tilt(); p.tilt = null; btn.classList.remove('on'); return; }
            btn.classList.add('on');
            p.tilt = ArkMotion.on(function (r) {
              p.aim.x = Math.max(-1.6, Math.min(1.6, r.tilt.right * 3));
              p.aim.y = Math.max(-1.6, Math.min(1.6, -(r.tilt.top - 0.5) * 3));
              sendAim(p, false);
            });
          });
        });
        p.raf = requestAnimationFrame(function () { draw(p); });
      },
      update: function (s) {
        if (!phone) return;
        const p = phone;
        p.s = s;
        const me = p.slot;
        const left = s.arrowsEach - s.arrows[me].length;
        p.el.querySelector('.msg').textContent = (left ? left + ' arrow' + (left > 1 ? 's' : '') + ' left · ' : 'All shot · ') + 'you ' + s.total[me] + ' · them ' + s.total[1 - me] +
          ' · wind ' + (Math.abs(s.wind) < 0.05 ? 'calm' : s.wind > 0 ? '→' : '←');
        p.el.querySelector('.draw').disabled = !left;
      },
      unmount: function () {
        if (phone) {
          cancelAnimationFrame(phone.raf);
          clearTimeout(phone.timer);
          if (phone.tilt) phone.tilt();
        }
        phone = null;
      },
    };
  }

  ArkMini.register('archery', {
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
    // Controllers: the stick moves the sight, hold A to draw, let go to shoot.
    padPoll: function (pad, s, slot) {
      if (!pads[slot]) pads[slot] = { x: s.aims[slot].x, y: s.aims[slot].y, drawn: false, key: '' };
      const p = pads[slot];
      const held = pad.held.indexOf('A') !== -1 || pad.held.indexOf('RT') !== -1;
      if (held && !p.drawn) {
        p.drawn = true;
        return { type: 'draw', on: true };
      }
      if (!held && p.drawn) {
        p.drawn = false;
        return { type: 'shoot', n: s.arrows[slot].length };
      }
      const sx = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      const sy = Math.abs(pad.stick.y) > 0.2 ? pad.stick.y : 0;
      p.x = Math.max(-1.6, Math.min(1.6, p.x + sx * 0.02));
      p.y = Math.max(-1.6, Math.min(1.6, p.y + sy * 0.02));
      const key = p.x.toFixed(2) + ',' + p.y.toFixed(2);
      if (key === p.key) return null;
      p.key = key;
      return { type: 'aim', x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
    },
    sounds: function (prev, s) {
      const shot = [0, 1].some(function (i) { return s.arrows[i].length > prev.arrows[i].length; });
      return shot ? ['shoot'] : [];
    },
  });
})();
