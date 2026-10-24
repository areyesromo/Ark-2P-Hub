// Paint Grab (server/games/minis/paint-grab.js): a 3D floor of tiles on the TV, painted by
// driving over them. Phones steer with the shared move pad; controllers with the stick or D-pad.
(function () {
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_MS = 80;
  const lastPad = ['', ''];
  const BLANK = 0x475569;
  const PAINT = 0xfacc15; // the bucket's paint

  let host = null;

  function hostMount(el, mctx) {
    lastPad[0] = lastPad[1] = '';
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, players: mctx.players, s: null, gl: null, tiles: null, splash: undefined };
    host = h;
    ArkMini.scene3d(box, { fov: 42 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      gl.onFrame(function () { frame(h); });
      if (h.s) { build(h); paint(h); }
    });
  }

  function build(h) {
    if (h.tiles || !h.gl || !h.s) return;
    const T = h.gl.THREE;
    const s = h.s;
    // Field (c, r) → 3D (x, z), centred on the middle of the floor.
    h.at = function (x, y) { return [x - s.cols / 2, y - s.rows / 2]; };
    h.gl.camera.position.set(0, 10.5, 8.5);
    h.gl.camera.lookAt(0, 0, 0.6);
    h.mats = [new T.MeshStandardMaterial({ color: BLANK, roughness: 0.7 }), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[0], roughness: 0.5 }), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[1], roughness: 0.5 })];
    const geo = new T.BoxGeometry(0.94, 0.2, 0.94);
    h.tiles = [];
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const m = new T.Mesh(geo, h.mats[0]);
        const p = h.at(c + 0.5, r + 0.5);
        m.position.set(p[0], -0.1, p[1]);
        h.gl.scene.add(m);
        h.tiles.push(m);
      }
    }
    h.rollers = [0, 1].map(function (i) {
      const g = new T.Group();
      const ball = new T.Mesh(new T.SphereGeometry(0.38, 24, 16), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[i], roughness: 0.3 }));
      ball.position.y = 0.38;
      const ring = new T.Mesh(new T.TorusGeometry(0.4, 0.06, 8, 24), new T.MeshStandardMaterial({ color: 0xffffff }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ball, ring);
      const p = h.at(s.players[i].x, s.players[i].y);
      g.position.set(p[0], 0, p[1]);
      h.gl.scene.add(g);
      return g;
    });
    const bucket = new T.Group();
    const pail = new T.Mesh(new T.CylinderGeometry(0.3, 0.24, 0.45, 20), new T.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.4 }));
    pail.position.y = 0.25;
    const top = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.05, 20), new T.MeshStandardMaterial({ color: PAINT, emissive: 0x854d0e }));
    top.position.y = 0.48;
    bucket.add(pail, top);
    bucket.visible = false;
    h.gl.scene.add(bucket);
    h.bucket = bucket;
  }

  /** Colours the tiles from the view, and pops the splashed ones. */
  function paint(h) {
    if (!h.tiles) return;
    const s = h.s;
    for (let i = 0; i < h.tiles.length; i++) {
      const t = s.tiles[i];
      h.tiles[i].material = h.mats[t === '0' ? 1 : t === '1' ? 2 : 0];
    }
    // The first view after mounting only notes the latest splash (a reconnect doesn't replay it).
    const n = s.splash ? s.splash.n : null;
    if (h.splash !== undefined && n !== null && n !== h.splash) {
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const c = s.splash.c + dc;
          const r = s.splash.r + dr;
          if (c >= 0 && c < s.cols && r >= 0 && r < s.rows) h.tiles[r * s.cols + c].position.y = 0.5;
        }
      }
    }
    h.splash = n;
    if (s.bucket) {
      const p = h.at(s.bucket.c + 0.5, s.bucket.r + 0.5);
      h.bucket.position.set(p[0], 0, p[1]);
    }
    h.bucket.visible = Boolean(s.bucket);
  }

  /** Each frame: rollers glide to the latest view, popped tiles settle, the bucket bobs. */
  function frame(h) {
    if (!h.tiles || !h.s) return;
    h.s.players.forEach(function (pl, i) {
      const g = h.rollers[i];
      const p = h.at(pl.x, pl.y);
      g.position.x += (p[0] - g.position.x) * 0.5;
      g.position.z += (p[1] - g.position.z) * 0.5;
    });
    h.tiles.forEach(function (t) { if (t.position.y > -0.1) t.position.y = Math.max(-0.1, t.position.y - 0.04); });
    if (h.bucket.visible) {
      h.bucket.rotation.y += 0.03;
      h.bucket.position.y = Math.sin(performance.now() / 250) * 0.08;
    }
  }

  function labels(h) {
    const s = h.s;
    const el = h.box.querySelectorAll('.mi-3dlabels > span');
    [0, 1].forEach(function (i) {
      const key = String(s.counts[i]);
      if (el[i].dataset.key === key) return;
      el[i].dataset.key = key;
      el[i].innerHTML = ArkMini.nameOf({ players: h.players }, i) + ' · 🎨 ' + s.counts[i]; // the name comes escaped
    });
  }

  ArkMini.register('paint-grab', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        host.s = s;
        build(host);
        paint(host);
        labels(host);
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-coins-phone"><div class="mine"></div><div class="padbox"></div></div>';
          phone = { el: el, slot: mctx.slot, pad: null, timer: null, last: 0, pending: null, splash: undefined, vibrate: mctx.vibrate };
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
              api: mctx, key: 'ark.paint.controls', verb: 'roll',
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
          const n = s.splash ? s.splash.n : null;
          // A buzz when you grab a bucket (not on the first update after joining).
          if (p.splash !== undefined && n !== null && n !== p.splash && s.splash.slot === p.slot) p.vibrate(120);
          p.splash = n;
          p.el.querySelector('.mine').textContent = '🎨 ' + s.counts[p.slot] + ' tiles · them ' + s.counts[1 - p.slot] + (s.bucket ? ' · 🪣 bucket out!' : '');
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
      if (s.splash && !(prev.splash && prev.splash.n === s.splash.n)) out.push('splash');
      if (s.bucket && !(prev.bucket && prev.bucket.id === s.bucket.id)) out.push('point');
      return out;
    },
  });
})();
