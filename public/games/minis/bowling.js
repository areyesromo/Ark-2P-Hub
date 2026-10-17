// Bowling Bash (server/games/minis/bowling.js): two 3D lanes on the TV; the
// phone shows your aim arrow and power meter. Tap (or A) twice per roll.
(function () {
  const ROLL_MS = 1500; // as the server
  const BALL_MS = 900; // the ball reaches the pins this far into a roll
  // Same as aimAt / powerAt in server/games/minis/bowling.js.
  function aimAt(ms) { return Math.sin((2 * Math.PI * ms) / 1400); }
  function powerAt(ms) { const p = (ms % 1000) / 1000; return p < 0.5 ? p * 2 : 2 - p * 2; }

  const LANE_X = [-2.4, 2.4];
  const PIN_Z = -11;

  function laneText(lane) {
    const k = lane.knocked;
    return 'Roll ' + lane.roll + ' · ' + (k.length ? k.join(' + ') + ' = ' + k.reduce(function (a, b) { return a + b; }, 0) : '0') + ' pins';
  }

  let host = null;

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div>' +
      '<div class="mi-power l"><i></i></div><div class="mi-power r"><i></i></div></div>';
    const box = el.firstChild;
    const h = { box: box, s: null, gl: null, mctx: mctx, pins: [[], []], balls: [], arrows: [] };
    host = h;
    ArkMini.scene3d(box, { fov: 42 }).then(function (gl) {
      if (host !== h) return gl.dispose();
      h.gl = gl;
      const T = gl.THREE;
      const wood = new T.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });
      const white = new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      const red = new T.MeshStandardMaterial({ color: 0xdc2626 });
      [0, 1].forEach(function (p) {
        const lane = new T.Mesh(new T.BoxGeometry(2.4, 0.1, 15), wood);
        lane.position.set(LANE_X[p], -0.05, -6.5);
        lane.receiveShadow = true;
        gl.scene.add(lane);
        h.pins[p] = [];
        for (let i = 0; i < 10; i++) {
          const pin = new T.Group();
          const body = new T.Mesh(new T.CylinderGeometry(0.09, 0.13, 0.6, 12), white);
          body.position.y = 0.3;
          const band = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.06, 12), red);
          band.position.y = 0.45;
          body.castShadow = true;
          pin.add(body, band);
          gl.scene.add(pin);
          h.pins[p].push(pin);
        }
        const ball = new T.Mesh(new T.SphereGeometry(0.22, 20, 16), new T.MeshStandardMaterial({ color: ArkMini.P_COLORS[p], roughness: 0.3 }));
        ball.castShadow = true;
        gl.scene.add(ball);
        h.balls.push(ball);
        const arrow = new T.Mesh(new T.ConeGeometry(0.14, 0.6, 12), new T.MeshStandardMaterial({ color: 0xfacc15 }));
        arrow.rotation.x = -Math.PI / 2;
        gl.scene.add(arrow);
        h.arrows.push(arrow);
      });
      gl.camera.position.set(0, 5.5, 5);
      gl.camera.lookAt(0, 0, -7);
      gl.onFrame(function () { frame(h); });
    });
  }

  function frame(h) {
    const s = h.s;
    if (!s) return;
    const t = h.mctx.t();
    s.lanes.forEach(function (lane, p) {
      const x0 = LANE_X[p];
      const into = t - lane.since;
      const rolling = lane.stage === 'rolling';
      const aim = lane.stage === 'aim' ? aimAt(Math.max(0, into)) : lane.aim || 0;
      // Pins: standing ones up; the ones knocked this roll tip over once the ball arrives.
      const fallen = rolling && into > BALL_MS;
      s.pins.forEach(function (pin, i) {
        const m = h.pins[p][i];
        const standing = lane.standing.indexOf(i) !== -1;
        const justHit = rolling && !standing && h.prevStanding && h.prevStanding[p] && h.prevStanding[p].indexOf(i) !== -1;
        m.visible = standing || justHit;
        m.position.set(x0 + pin.x * 0.6, 0, PIN_Z - pin.z);
        m.rotation.z = justHit && fallen ? (pin.x >= aim * 0.72 ? -1.4 : 1.4) : 0;
      });
      const ball = h.balls[p];
      const k = rolling ? Math.min(1, into / BALL_MS) : 0;
      ball.visible = lane.stage !== 'done';
      ball.position.set(x0 + aim * 0.72 * k, 0.22, -0.5 + (PIN_Z + 0.5) * k);
      const arrow = h.arrows[p];
      arrow.visible = lane.stage === 'aim';
      arrow.position.set(x0 + aim * 0.5, 0.1, -1.6);
      arrow.rotation.z = -aim * 0.6;
      const bar = h.box.querySelector('.mi-power.' + (p ? 'r' : 'l'));
      bar.style.visibility = lane.stage === 'power' ? 'visible' : 'hidden';
      bar.firstChild.style.height = (lane.stage === 'power' ? powerAt(Math.max(0, into)) : 0) * 100 + '%';
    });
  }

  ArkMini.register('bowling', {
    host: {
      mount: hostMount,
      update: function (s) {
        if (!host) return;
        // Remember what stood before each roll, to tip over just those pins.
        if (!host.prevStanding) host.prevStanding = s.lanes.map(function (l) { return l.standing.slice(); });
        s.lanes.forEach(function (l, p) {
          if (l.stage !== 'rolling') host.prevStanding[p] = l.standing.slice();
        });
        host.s = s;
        const lab = function (p) { return ArkMini.nameOf({ players: host.mctx.players }, p) + ' · ' + laneText(s.lanes[p]); };
        host.box.querySelector('.mi-3dlabels .l').innerHTML = lab(0);
        host.box.querySelector('.mi-3dlabels .r').innerHTML = lab(1);
      },
      unmount: function () { if (host && host.gl) host.gl.dispose(); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-bowl-phone"><div class="msg"></div><div class="aim"><i>⬆️</i></div><div class="mi-power"><i></i></div><button class="primary mi-big-btn">🎳 TAP!</button></div>';
          phone = { el: el, slot: mctx.slot, s: null };
          el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'tap' }); mctx.vibrate(15); });
          phone.raf = requestAnimationFrame(function draw() {
            phone.raf = requestAnimationFrame(draw);
            const s = phone.s;
            if (!s) return;
            const lane = s.lanes[phone.slot];
            const into = Math.max(0, mctx.t() - lane.since);
            const aim = phone.el.querySelector('.aim');
            aim.style.visibility = lane.stage === 'aim' ? 'visible' : 'hidden';
            aim.firstChild.style.transform = 'rotate(' + aimAt(into) * 35 + 'deg)';
            const pw = phone.el.querySelector('.mi-power');
            pw.style.visibility = lane.stage === 'power' ? 'visible' : 'hidden';
            pw.firstChild.style.height = powerAt(into) * 100 + '%';
          });
        },
        update: function (s) {
          if (!phone) return;
          phone.s = s;
          const lane = s.lanes[phone.slot];
          const what = { aim: 'Tap to aim (the pocket is just right of centre)', power: 'Tap for power (not too much!)', rolling: 'Rolling…', done: 'Done!' }[lane.stage];
          phone.el.querySelector('.msg').textContent = what + ' · ' + laneText(lane);
          phone.el.querySelector('button').disabled = lane.stage === 'rolling' || lane.stage === 'done';
        },
        unmount: function () { if (phone) cancelAnimationFrame(phone.raf); phone = null; },
      };
    })(),
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'tap' } : null; },
    sounds: function (prev, s) {
      return s.lanes.some(function (l, i) { return l.stage === 'rolling' && prev.lanes[i].stage !== 'rolling'; }) ? ['boom'] : [];
    },
  });
})();
