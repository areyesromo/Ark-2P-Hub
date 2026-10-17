// Penalty Shootout (server/games/minis/penalty.js): a 3D goal on the TV;
// phones (or the D-pad) pick left / middle / right, in secret.
(function () {
  const SIDE = ['⬅️ Left', '⬆️ Middle', '➡️ Right'];
  const PAD = { LEFT: 0, X: 0, UP: 1, Y: 1, RIGHT: 2, B: 2 };
  const SHOW_MS = 700; // the kick's flight
  let host = null;

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="m"></span><span class="r"></span></div><div class="mi-3dbig"></div></div>';
    const box = el.firstChild;
    const h = { box: box, s: null, gl: null, mctx: mctx, showAt: 0, lastKick: null };
    host = h;
    ArkMini.scene3d(box, { fov: 40 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      const T = gl.THREE;
      const grass = new T.Mesh(new T.PlaneGeometry(40, 30), new T.MeshStandardMaterial({ color: 0x15803d }));
      grass.rotation.x = -Math.PI / 2;
      grass.receiveShadow = true;
      gl.scene.add(grass);
      const white = new T.MeshStandardMaterial({ color: 0xffffff });
      const post = function (x) {
        const m = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 2.6, 12), white);
        m.position.set(x, 1.3, -8);
        m.castShadow = true;
        gl.scene.add(m);
      };
      post(-3.7);
      post(3.7);
      const bar = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 7.6, 12), white);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.6, -8);
      gl.scene.add(bar);
      const net = new T.Mesh(new T.PlaneGeometry(7.4, 2.6), new T.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.25, side: T.DoubleSide }));
      net.position.set(0, 1.3, -9);
      gl.scene.add(net);
      const spot = new T.Mesh(new T.CircleGeometry(0.15, 16), white);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(0, 0.01, 0);
      gl.scene.add(spot);
      h.keeperMats = ArkMini.P_COLORS.map(function (c) { return new T.MeshStandardMaterial({ color: c }); });
      h.keeper = new T.Mesh(new T.CapsuleGeometry ? new T.CapsuleGeometry(0.35, 1.0, 6, 12) : new T.BoxGeometry(0.7, 1.7, 0.4), h.keeperMats[1]);
      h.keeper.castShadow = true;
      gl.scene.add(h.keeper);
      h.ball = new T.Mesh(new T.SphereGeometry(0.2, 20, 16), new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
      h.ball.castShadow = true;
      gl.scene.add(h.ball);
      gl.camera.position.set(0, 2.2, 5.5);
      gl.camera.lookAt(0, 1.2, -8);
      gl.onFrame(function () { frame(h); });
    });
  }

  function frame(h) {
    const s = h.s;
    if (!s) return;
    const keeper = 1 - s.kicker;
    h.keeper.material = h.keeperMats[keeper];
    const showing = s.stage === 'show' && s.last;
    const k = showing ? Math.min(1, (performance.now() - h.showAt) / SHOW_MS) : 0;
    const wob = Math.sin(performance.now() / 300) * 0.3;
    if (showing) {
      const dive = (s.last.dive - 1) * 2.3;
      h.keeper.position.set(dive * k, 0.85 - (s.last.dive === 1 ? 0 : 0.35 * k), -7.7);
      h.keeper.rotation.z = s.last.dive === 1 ? 0 : -Math.sign(dive) * 1.2 * k;
      const tx = s.last.shot === null ? 5.5 : (s.last.shot - 1) * 2.5;
      const saved = !s.last.goal && s.last.shot !== null;
      const kk = saved ? Math.min(k, 0.92) : k;
      h.ball.position.set(tx * kk, 0.2 + 1.0 * kk + Math.sin(kk * Math.PI) * 0.5, -7.9 * kk);
    } else {
      h.keeper.position.set(wob, 0.85, -7.7);
      h.keeper.rotation.z = 0;
      h.ball.position.set(0, 0.2, 0);
    }
  }

  function dots(s, p) {
    let out = '';
    for (let i = 0; i < s.kicks; i++) out += i < s.taken[p] ? '●' : '○';
    return out;
  }

  ArkMini.register('penalty', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        if (s.stage === 'show' && host.lastKick !== s.kick) { host.lastKick = s.kick; host.showAt = performance.now(); }
        host.s = s;
        const P = host.mctx.players;
        const nm = function (p) { return ArkMini.nameOf({ players: P }, p); };
        host.box.querySelector('.mi-3dlabels .l').innerHTML = nm(0) + ' ⚽ ' + s.goals[0] + ' <small>' + dots(s, 0) + '</small>';
        host.box.querySelector('.mi-3dlabels .r').innerHTML = '<small>' + dots(s, 1) + '</small> ' + s.goals[1] + ' ⚽ ' + nm(1);
        host.box.querySelector('.mi-3dlabels .m').innerHTML = s.stage === 'pick'
          ? nm(s.kicker) + ' shoots ' + (s.picked[s.kicker] ? '✔' : '…') + ' · ' + nm(1 - s.kicker) + ' in goal ' + (s.picked[1 - s.kicker] ? '✔' : '…')
          : '';
        const big = host.box.querySelector('.mi-3dbig');
        big.textContent = s.stage === 'show' && s.last ? (s.last.goal ? 'GOAL!' : s.last.shot === null ? 'MISSED!' : 'SAVED!') : '';
        big.className = 'mi-3dbig' + (s.stage === 'show' ? ' on' : '');
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-pk-phone"><div class="msg"></div><div class="sides">' +
            SIDE.map(function (label, i) { return '<button class="ghost" data-side="' + i + '">' + label + '</button>'; }).join('') + '</div><div class="last"></div></div>';
          phone = { el: el, slot: mctx.slot };
          el.addEventListener('pointerdown', function (e) {
            const b = e.target.closest('[data-side]');
            if (!b || b.disabled) return;
            mctx.send({ type: 'pick', side: Number(b.getAttribute('data-side')) });
            mctx.vibrate(20);
          });
        },
        update: function (s) {
          if (!phone) return;
          const me = phone.slot;
          const kicking = s.kicker === me;
          phone.el.querySelector('.msg').innerHTML = s.stage === 'pick'
            ? (kicking ? '⚽ You shoot! Pick a corner' : '🧤 You\'re in goal! Pick where to dive')
            : '';
          phone.el.querySelectorAll('[data-side]').forEach(function (b, i) {
            b.disabled = s.stage !== 'pick' || s.mine !== null;
            b.classList.toggle('on', s.mine === i);
          });
          const l = s.last;
          phone.el.querySelector('.last').innerHTML = s.stage === 'show' && l
            ? '<b class="' + ((l.goal ? l.kicker === me : l.kicker !== me) ? 'mi-ok' : 'mi-bad') + '">' + (l.goal ? 'GOAL!' : l.shot === null ? 'Missed!' : 'Saved!') + '</b>'
            : 'You ' + s.goals[me] + ' · them ' + s.goals[1 - me];
        },
        unmount: function () { phone = null; },
      };
    })(),
    pad: function (btn, s) { return s.stage === 'pick' && PAD[btn] !== undefined ? { type: 'pick', side: PAD[btn] } : null; },
    sounds: function (prev, s) {
      if (s.stage === 'show' && prev.stage !== 'show' && s.last) return [s.last.goal ? 'fanfare' : 'wrong'];
      return [];
    },
  });
})();
