// Tower Stack (server/games/minis/tower-stack.js): 3D towers on the TV, a
// simple side view on the phone. Tap (or A) drops the swinging block.
(function () {
  const U = 2; // tower units -> 3D units
  const BLOCK_H = 0.5;
  // Same as swingAt in server/games/minis/tower-stack.js.
  function swingAt(ms, swing) {
    return swing.amp * Math.sin((2 * Math.PI * ms) / swing.period);
  }

  let host = null;

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div></div>';
    const box = el.firstChild;
    const h = { el: el, box: box, s: null, gl: null, built: [[], []], swing: [], camY: 2, mctx: mctx };
    host = h;
    ArkMini.scene3d(box, { fov: 45 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      const T = gl.THREE;
      const ground = new T.Mesh(new T.CylinderGeometry(9, 9, 0.2, 48), new T.MeshStandardMaterial({ color: 0x334155 }));
      ground.position.y = -0.1;
      ground.receiveShadow = true;
      gl.scene.add(ground);
      h.mats = ArkMini.P_COLORS.map(function (c) { return new T.MeshStandardMaterial({ color: c, roughness: 0.5 }); });
      h.dead = new T.MeshStandardMaterial({ color: 0x64748b });
      h.swing = [0, 1].map(function (s) {
        const m = new T.Mesh(new T.BoxGeometry(1, BLOCK_H, U), h.mats[s]);
        m.castShadow = true;
        gl.scene.add(m);
        return m;
      });
      gl.onFrame(function () { frame(h); });
      if (h.s) build(h);
    });
  }

  const baseX = function (s) { return s === 0 ? -3.2 : 3.2; };

  function build(h) {
    const T = h.gl.THREE;
    h.s.towers.forEach(function (tower, s) {
      for (let i = h.built[s].length; i < tower.length; i++) {
        const b = tower[i];
        const m = new T.Mesh(new T.BoxGeometry(b.w * U, BLOCK_H, U), h.mats[s]);
        m.position.set(baseX(s) + b.x * U, BLOCK_H / 2 + i * BLOCK_H, 0);
        m.castShadow = m.receiveShadow = true;
        h.gl.scene.add(m);
        h.built[s].push(m);
      }
      if (h.s.out[s]) h.built[s].forEach(function (m) { m.material = h.dead; });
    });
  }

  function frame(h) {
    const s = h.s;
    if (!s) return;
    const t = h.mctx.t();
    let top = 0;
    [0, 1].forEach(function (p) {
      const tower = s.towers[p];
      const last = tower[tower.length - 1];
      top = Math.max(top, tower.length);
      const m = h.swing[p];
      m.visible = !s.out[p] && t >= s.blockStart[p];
      m.scale.x = last.w * U;
      m.position.set(baseX(p) + swingAt(t - s.blockStart[p], s.swing) * U, BLOCK_H / 2 + (tower.length + 1.2) * BLOCK_H, 0);
    });
    h.camY += (Math.max(2, top * BLOCK_H) - h.camY) * 0.05;
    h.gl.camera.position.set(0, h.camY + 3.5, 13);
    h.gl.camera.lookAt(0, h.camY, 0);
  }

  ArkMini.register('tower-stack', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        host.s = s;
        if (host.gl) build(host);
        const lab = function (p) { return ArkMini.nameOf({ players: host.mctx.players }, p) + ' · ' + (s.towers[p].length - 1) + (s.out[p] ? ' 💥' : ''); };
        host.box.querySelector('.l').innerHTML = lab(0);
        host.box.querySelector('.r').innerHTML = lab(1);
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      const pct = function (x) { return 50 + (x / 1.8) * 50; };
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-stack-phone"><div class="msg"></div><div class="side"><i class="swing"></i><i class="top"></i></div><button class="primary mi-big-btn">⬇️ DROP!</button></div>';
          phone = { el: el, slot: mctx.slot, s: null, mctx: mctx };
          el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'drop' }); mctx.vibrate(20); });
          phone.raf = requestAnimationFrame(function draw() {
            phone.raf = requestAnimationFrame(draw);
            const s = phone.s;
            if (!s) return;
            const p = phone.slot;
            const tower = s.towers[p];
            const last = tower[tower.length - 1];
            const sw = phone.el.querySelector('.swing');
            const t = mctx.t();
            sw.style.visibility = !s.out[p] && t >= s.blockStart[p] ? 'visible' : 'hidden';
            sw.style.width = last.w / 3.6 * 100 + '%';
            sw.style.left = pct(swingAt(t - s.blockStart[p], s.swing) - last.w / 2) + '%';
            const tp = phone.el.querySelector('.top');
            tp.style.width = last.w / 3.6 * 100 + '%';
            tp.style.left = pct(last.x - last.w / 2) + '%';
          });
        },
        update: function (s) {
          if (!phone) return;
          phone.s = s;
          const p = phone.slot;
          phone.el.querySelector('.msg').textContent = s.out[p] ? '💥 Your tower is done: ' + (s.towers[p].length - 1) : 'Height ' + (s.towers[p].length - 1) + ' · them ' + (s.towers[1 - p].length - 1);
          phone.el.querySelector('button').disabled = s.out[p];
        },
        unmount: function () { if (phone) cancelAnimationFrame(phone.raf); phone = null; },
      };
    })(),
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'drop' } : null; },
    sounds: function (prev, s) {
      const grew = s.towers.some(function (t, i) { return t.length > prev.towers[i].length; });
      const fell = s.out.some(function (o, i) { return o && !prev.out[i]; });
      return fell ? ['boom'] : grew ? ['drop'] : [];
    },
  });
})();
