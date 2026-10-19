// Ice Rink Sumo (server/games/minis/ice-sumo.js): two pucks on a 3D rink on the TV.
// Phones steer with the shared move pad; controllers with the stick or D-pad.
(function () {
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_MS = 80;
  const lastPad = ['', ''];

  let host = null;

  function hostMount(el, mctx) {
    lastPad[0] = lastPad[1] = '';
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l">' + ArkMini.nameOf({ players: mctx.players }, 0) + '</span><span class="r">' + ArkMini.nameOf({ players: mctx.players }, 1) + '</span></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, s: null, gl: null, pucks: null };
    host = h;
    ArkMini.scene3d(box, { fov: 42 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      gl.camera.position.set(0, 9.5, 8.5);
      gl.camera.lookAt(0, 0, 0.4);
      gl.onFrame(function () { frame(h); });
      if (h.s) build(h);
    });
  }

  function build(h) {
    if (h.pucks || !h.gl || !h.s) return;
    const T = h.gl.THREE;
    const R = h.s.rink;
    const water = new T.Mesh(new T.CylinderGeometry(R + 4, R + 4, 0.1, 64), new T.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.3 }));
    water.position.y = -0.6;
    const ice = new T.Mesh(new T.CylinderGeometry(R, R * 0.92, 0.5, 64), new T.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.08, metalness: 0.1 }));
    ice.position.y = -0.25;
    const edge = new T.Mesh(new T.TorusGeometry(R - 0.05, 0.06, 8, 96), new T.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d }));
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.01;
    const dot = new T.Mesh(new T.CircleGeometry(0.5, 32), new T.MeshStandardMaterial({ color: 0x38bdf8 }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.005;
    h.gl.scene.add(water, ice, edge, dot);
    h.pucks = [0, 1].map(function (p) {
      const g = new T.Group();
      const body = new T.Mesh(new T.CylinderGeometry(h.s.r, h.s.r, 0.4, 32), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[p], roughness: 0.35 }));
      body.position.y = 0.2;
      const top = new T.Mesh(new T.CylinderGeometry(h.s.r * 0.45, h.s.r * 0.45, 0.12, 24), new T.MeshStandardMaterial({ color: 0xffffff }));
      top.position.y = 0.46;
      g.add(body, top);
      h.gl.scene.add(g);
      return g;
    });
  }

  function frame(h) {
    if (!h.pucks || !h.s) return;
    h.s.pucks.forEach(function (p, i) {
      const g = h.pucks[i];
      const off = Math.hypot(p.x, p.y) > h.s.rink;
      g.position.x += (p.x - g.position.x) * 0.5;
      g.position.z += (p.y - g.position.z) * 0.5;
      g.position.y = off ? Math.max(-3, g.position.y - 0.08) : 0;
    });
  }

  ArkMini.register('ice-sumo', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        host.s = s;
        build(host);
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-coins-phone"><div class="mine"></div><div class="padbox"></div></div>';
          phone = { el: el, slot: mctx.slot, pad: null, timer: null, last: 0, pending: null };
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
              api: mctx, key: 'ark.sumo.controls', verb: 'slide',
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
          const me = s.pucks[phone.slot];
          const d = Math.hypot(me.x, me.y) / s.rink;
          phone.el.querySelector('.mine').innerHTML = d > 0.8 ? '<b class="mi-bad">⚠️ Near the edge!</b>' : '🧊 Bump them off!';
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
      const out = [];
      if (s.bumps > prev.bumps) out.push('puck');
      const off = function (v) { return v.pucks.some(function (p) { return Math.hypot(p.x, p.y) > v.rink; }); };
      if (off(s) && !off(prev)) out.push('splash');
      return out;
    },
  });
})();
