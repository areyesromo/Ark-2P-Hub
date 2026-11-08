// Drum Beat (server/games/minis/drum-beat.js): a highway each on the TV, notes falling to the line;
// on the phone, three big lane pads. Controllers: X / A / B (or ← ↓ →) for the three lanes.
(function () {
  const AHEAD_MS = 1600; // a note shows this long before it reaches the line
  const LANE_COLORS = ['#f472b6', '#facc15', '#22d3ee'];
  const GRADE = { perfect: '🎯 Perfect!', good: '👍 Good', miss: '❌ Miss' };

  let host = null;

  function drawHighway(g, x0, w, h, s, slot, t) {
    const laneW = w / s.lanes;
    const lineY = h * 0.85;
    g.fillStyle = 'rgba(15,23,42,0.85)';
    g.fillRect(x0, 0, w, h);
    for (let l = 0; l < s.lanes; l++) {
      g.fillStyle = l % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      g.fillRect(x0 + l * laneW, 0, laneW, h);
    }
    // The line, and a pad at the foot of each lane.
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(x0, lineY - 2, w, 4);
    for (let l = 0; l < s.lanes; l++) {
      g.strokeStyle = LANE_COLORS[l];
      g.lineWidth = 4;
      g.beginPath();
      g.arc(x0 + (l + 0.5) * laneW, lineY, laneW * 0.28, 0, Math.PI * 2);
      g.stroke();
    }
    const hits = new Set(s.hits[slot]);
    s.chart.forEach(function (n, i) {
      const dt = n.t - t;
      if (dt > AHEAD_MS || dt < -250 || hits.has(i)) return;
      const y = lineY - (dt / AHEAD_MS) * lineY;
      g.fillStyle = LANE_COLORS[n.lane];
      g.beginPath();
      g.arc(x0 + (n.lane + 0.5) * laneW, y, laneW * 0.24, 0, Math.PI * 2);
      g.fill();
    });
  }

  function frame() {
    if (!host) return;
    host.raf = requestAnimationFrame(frame);
    const s = host.s;
    const c = host.canvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.floor(r.width * dpr) || c.height !== Math.floor(r.height * dpr)) {
      c.width = Math.floor(r.width * dpr);
      c.height = Math.floor(r.height * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    if (!s) return;
    const w = Math.min(r.width * 0.42, 420);
    const t = host.mctx.t();
    drawHighway(g, r.width / 2 - w - 20, w, r.height, s, 0, t);
    drawHighway(g, r.width / 2 + 20, w, r.height, s, 1, t);
  }

  ArkMini.register('drum-beat', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-drum"><div class="names"><span class="n0"></span><span class="n1"></span></div><canvas></canvas></div>';
        host = { el: el, mctx: mctx, canvas: el.querySelector('canvas'), s: null, raf: null };
        host.raf = requestAnimationFrame(frame);
      },
      update: function (s) {
        if (!host) return;
        host.s = s;
        [0, 1].forEach(function (i) {
          host.el.querySelector('.n' + i).innerHTML = ArkMini.nameOf({ players: host.mctx.players }, i) + ' · <b>' + s.score[i] + '</b>' +
            (s.combo[i] >= 5 ? ' · 🔥 ' + s.combo[i] : '') + (s.last[i] ? ' · ' + GRADE[s.last[i]] : '');
        });
      },
      unmount: function () { if (host) cancelAnimationFrame(host.raf); host = null; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage mi-drum-phone"><div class="msg">Watch the TV: tap a lane as its note hits the line</div>' +
            '<div class="pads">' + [0, 1, 2].map(function (l) { return '<button class="pad" data-lane="' + l + '" style="--lane:' + LANE_COLORS[l] + '"></button>'; }).join('') + '</div></div>';
          phone = { el: el, slot: mctx.slot };
          el.querySelectorAll('.pad').forEach(function (b) {
            b.addEventListener('pointerdown', function (e) {
              e.preventDefault();
              mctx.send({ type: 'hit', lane: Number(b.dataset.lane) });
              mctx.vibrate(10);
              b.classList.remove('flash');
              void b.offsetWidth;
              b.classList.add('flash');
            });
          });
        },
        update: function (s) {
          if (!phone) return;
          const i = phone.slot;
          phone.el.querySelector('.msg').textContent = (s.last[i] ? GRADE[s.last[i]] + ' · ' : '') + s.score[i] + ' points' + (s.combo[i] >= 5 ? ' · 🔥 ' + s.combo[i] + ' in a row' : '') + ' · them ' + s.score[1 - i];
        },
        unmount: function () { phone = null; },
      };
    })(),
    pad: function (btn) {
      const lane = { X: 0, LEFT: 0, A: 1, DOWN: 1, B: 2, RIGHT: 2 }[btn];
      return lane === undefined ? null : { type: 'hit', lane: lane };
    },
    sounds: function (prev, s) {
      for (let i = 0; i < 2; i++) {
        if (s.score[i] !== prev.score[i] || s.last[i] !== prev.last[i]) return [s.last[i] === 'miss' ? 'wrong' : 'tick'];
      }
      return [];
    },
  });
})();
