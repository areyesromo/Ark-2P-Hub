// Bowling Bash (server/games/minis/bowling.js): two 3D lanes on the TV; on the phone you
// swipe the ball up your lane. The swipe's angle is the aim, its speed the power. Phones only.
(function () {
  const BALL_MS = 900; // the ball reaches the pins this far into a roll
  const MAX_ANGLE = 0.5; // radians either side of straight up = full aim
  const FULL_MS = 200; // crossing the whole lane this fast = full power

  const LANE_X = [-2.4, 2.4];
  const PIN_Z = -11;

  function laneText(lane) {
    const k = lane.knocked;
    return 'Roll ' + lane.roll + ' · ' + (k.length ? k.join(' + ') + ' = ' + k.reduce(function (a, b) { return a + b; }, 0) : '0') + ' pins';
  }

  let host = null;

  function hostMount(el, mctx) {
    el.innerHTML = '<div class="mi-3dbox"><div class="mi-3dlabels"><span class="l"></span><span class="r"></span></div></div>';
    const box = el.firstChild;
    const h = { box: box, s: null, gl: null, mctx: mctx, pins: [[], []], balls: [] };
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
      const aim = lane.aim || 0;
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
      // Waiting for the swipe: the ball bobs at the foul line.
      ball.position.set(x0 + aim * 0.72 * k, 0.22 + (lane.stage === 'ready' ? Math.abs(Math.sin(t / 250)) * 0.12 : 0), -0.5 + (PIN_Z + 0.5) * k);
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
      /** Aim (-1..1) and power (0..1) from the last part of a swipe (`pts`: { x, y, t }) on a lane `h` px tall. */
      function swipe(pts, h) {
        const end = pts[pts.length - 1];
        let i = pts.length - 1;
        while (i > 0 && end.t - pts[i - 1].t < 120) i--; // the last ~120 ms: the throw, not the wind-up
        const a = pts[i];
        const dx = end.x - a.x;
        const dy = a.y - end.y; // up is positive
        const dt = Math.max(16, end.t - a.t);
        if (dy < h * 0.08) return null; // not up the lane (or too short)
        const angle = Math.atan2(dx, dy);
        const speed = Math.hypot(dx, dy) / dt; // px per ms
        return {
          aim: Math.round(Math.max(-1, Math.min(1, angle / MAX_ANGLE)) * 100) / 100,
          power: Math.round(Math.min(1, speed / (h / FULL_MS)) * 100) / 100,
        };
      }
      function verdict(r) {
        const side = Math.abs(r.aim) < 0.08 ? 'dead straight' : (r.aim > 0 ? 'right' : 'left') + (Math.abs(r.aim) < 0.35 ? ', a little' : Math.abs(r.aim) < 0.7 ? '' : ', a lot');
        return 'Aim: ' + side + ' · Power ' + Math.round(r.power * 100) + '%';
      }
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-bowl-phone"><div class="msg"></div>' +
            '<div class="lane"><span class="pins">🎳</span><span class="pocket"></span><span class="ball keep-motion p' + (mctx.slot + 1) + '"></span><span class="hint">⬆️ Swipe up</span></div>' +
            '<div class="last"></div></div>';
          const lane = el.querySelector('.lane');
          const ball = el.querySelector('.ball');
          const p = { el: el, slot: mctx.slot, s: null, pts: null };
          phone = p;
          const place = function (x, y, fly) {
            ball.style.transition = fly ? 'left 0.5s ease-out, top 0.5s ease-in, transform 0.5s' : 'none';
            ball.style.left = typeof x === 'number' ? x + 'px' : x;
            ball.style.top = typeof y === 'number' ? y + 'px' : y;
            ball.style.transform = 'translate(-50%, -50%)' + (fly ? ' scale(0.45)' : '');
          };
          // At the foul line, whatever the lane's height turns out to be.
          const home = function () { place('50%', 'calc(100% - 40px)', false); };
          p.home = home;
          requestAnimationFrame(home);
          const ready = function () { return p.s && p.s.lanes[p.slot].stage === 'ready'; };
          lane.addEventListener('pointerdown', function (e) {
            if (!ready()) return;
            lane.setPointerCapture(e.pointerId);
            const r = lane.getBoundingClientRect();
            p.pts = [{ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }];
            place(p.pts[0].x, p.pts[0].y, false);
          });
          lane.addEventListener('pointermove', function (e) {
            if (!p.pts) return;
            const r = lane.getBoundingClientRect();
            p.pts.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp });
            if (p.pts.length > 60) p.pts.shift();
            place(p.pts[p.pts.length - 1].x, p.pts[p.pts.length - 1].y, false);
          });
          const release = function () {
            if (!p.pts) return;
            const pts = p.pts;
            p.pts = null;
            const r = pts.length > 1 && swipe(pts, lane.clientHeight);
            if (!r || !ready()) return home();
            mctx.send({ type: 'bowl', aim: r.aim, power: r.power });
            mctx.vibrate(25);
            p.el.querySelector('.last').textContent = verdict(r);
            // Off it goes: up the lane along the swipe's line.
            const end = pts[pts.length - 1];
            place(Math.max(10, Math.min(lane.clientWidth - 10, end.x + r.aim * lane.clientWidth * 0.3)), 30, true);
          };
          lane.addEventListener('pointerup', release);
          lane.addEventListener('pointercancel', release);
        },
        update: function (s) {
          if (!phone) return;
          const was = phone.s && phone.s.lanes[phone.slot];
          phone.s = s;
          const lane = s.lanes[phone.slot];
          if (lane.stage === 'ready' && was && was.stage !== 'ready') phone.home(); // the second roll
          const what = { ready: 'Swipe the ball up the lane! The pocket is just right of the head pin', rolling: 'Rolling…', done: 'Done!' }[lane.stage];
          phone.el.querySelector('.msg').textContent = what + ' · ' + laneText(lane);
          phone.el.querySelector('.hint').style.visibility = lane.stage === 'ready' ? 'visible' : 'hidden';
        },
        unmount: function () { phone = null; },
      };
    })(),
    sounds: function (prev, s) {
      return s.lanes.some(function (l, i) { return l.stage === 'rolling' && prev.lanes[i].stage !== 'rolling'; }) ? ['boom'] : [];
    },
  });
})();
