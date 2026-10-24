// Bumper Cars (server/games/minis/bumper-cars.js): two cars in a 3D arena on the TV.
// Phones steer with the shared move pad; controllers with the stick or D-pad. Each car's white
// front bumper shows which end is head-on.
(function () {
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_MS = 80;
  const lastPad = ['', ''];

  let host = null;

  function hostMount(el, mctx) {
    lastPad[0] = lastPad[1] = '';
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, players: mctx.players, s: null, gl: null, cars: null };
    host = h;
    ArkMini.scene3d(box, { fov: 42 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      gl.camera.position.set(0, 12.5, 11);
      gl.camera.lookAt(0, 0, 0.5);
      gl.onFrame(function () { frame(h); });
      if (h.s) build(h);
    });
  }

  function build(h) {
    if (h.cars || !h.gl || !h.s) return;
    const T = h.gl.THREE;
    const R = h.s.arena;
    const floor = new T.Mesh(new T.CylinderGeometry(R, R, 0.3, 64), new T.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
    floor.position.y = -0.15;
    const rail = new T.Mesh(new T.TorusGeometry(R + 0.15, 0.25, 12, 96), new T.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }));
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.2;
    h.gl.scene.add(floor, rail);
    const r = h.s.carR;
    h.cars = [0, 1].map(function (p) {
      // Built facing +x (heading 0); the bumper ring all round, the white front bumper ahead.
      const g = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(r * 1.7, 0.45, r * 1.25), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[p], roughness: 0.35 }));
      body.position.y = 0.35;
      const ring = new T.Mesh(new T.TorusGeometry(r * 0.95, 0.12, 8, 32), new T.MeshStandardMaterial({ color: 0x1f2937 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.15;
      const front = new T.Mesh(new T.BoxGeometry(0.16, 0.24, r * 1.3), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x555555 }));
      front.position.set(r * 0.95, 0.2, 0);
      const seat = new T.Mesh(new T.BoxGeometry(0.3, 0.4, r * 0.8), new T.MeshStandardMaterial({ color: 0x111827 }));
      seat.position.set(-r * 0.4, 0.7, 0);
      g.add(body, ring, front, seat);
      h.gl.scene.add(g);
      return g;
    });
    h.cars.forEach(function (g, i) {
      const c = h.s.cars[i];
      g.position.set(c.x, 0, c.y);
      g.rotation.y = -c.h;
    });
  }

  /** Each frame: glide towards the latest view (updates come about 20 times a second). */
  function frame(h) {
    if (!h.cars || !h.s) return;
    h.s.cars.forEach(function (c, i) {
      const g = h.cars[i];
      g.position.x += (c.x - g.position.x) * 0.5;
      g.position.z += (c.y - g.position.z) * 0.5;
      const want = -c.h;
      g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.5;
    });
  }

  function labels(h) {
    const s = h.s;
    const el = h.box.querySelectorAll('.mi-3dlabels > span');
    [0, 1].forEach(function (i) {
      const key = String(s.points[i]);
      if (el[i].dataset.key === key) return;
      el[i].dataset.key = key;
      el[i].innerHTML = ArkMini.nameOf({ players: h.players }, i) + ' · 💥 ' + s.points[i]; // the name comes escaped
    });
  }

  ArkMini.register('bumper-cars', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        host.s = s;
        build(host);
        labels(host);
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-coins-phone"><div class="mine"></div><div class="padbox"></div></div>';
          phone = { el: el, slot: mctx.slot, pad: null, timer: null, last: 0, pending: null, spun: undefined, vibrate: mctx.vibrate };
          const p = phone;
          function send() {
            p.timer = null;
            if (!p.pending || phone !== p) return;
            p.last = Date.now();
            mctx.send({ type: 'move', x: p.pending.x, y: p.pending.y });
            p.pending = null;
          }
          padReady.then(function () {
            if (phone !== p) return;
            p.pad = window.ArkMovePad.create({
              api: mctx, key: 'ark.bumper.controls', verb: 'drive',
              onMove: function (x, y, now) {
                p.pending = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
                const wait = SEND_MS - (Date.now() - p.last);
                if (now || wait <= 0) { clearTimeout(p.timer); send(); } else if (!p.timer) p.timer = setTimeout(send, wait);
              },
            });
            el.querySelector('.padbox').appendChild(p.pad.el);
          });
        },
        update: function (s) {
          if (!phone) return;
          const p = phone;
          const spun = s.cars[p.slot].spinning;
          // A buzz when you're spun out (not on the first update after joining).
          if (spun && p.spun === false) p.vibrate(300);
          p.spun = spun;
          p.el.querySelector('.mine').innerHTML = (spun ? '<b class="mi-bad">💫 Spun out!</b> · ' : '') + '💥 ' + s.points[p.slot] + ' · them ' + s.points[1 - p.slot];
        },
        unmount: function () {
          if (phone) { clearTimeout(phone.timer); if (phone.pad) phone.pad.destroy(); }
          phone = null;
        },
      };
    })(),
    // Controllers: send the stick / D-pad direction when it changes.
    padPoll: function (pad, s, slot) {
      let x = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      let y = Math.abs(pad.stick.y) > 0.2 ? pad.stick.y : 0;
      if (pad.held.indexOf('LEFT') !== -1) x = -1;
      if (pad.held.indexOf('RIGHT') !== -1) x = 1;
      if (pad.held.indexOf('UP') !== -1) y = -1;
      if (pad.held.indexOf('DOWN') !== -1) y = 1;
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
      const key = x + ',' + y;
      if (key === lastPad[slot]) return null;
      lastPad[slot] = key;
      return { type: 'move', x: x, y: y };
    },
    sounds: function (prev, s) {
      if (!s.bump || (prev.bump && prev.bump.n === s.bump.n)) return [];
      return [s.bump.by === null ? 'puck' : 'crash'];
    },
  });
})();
