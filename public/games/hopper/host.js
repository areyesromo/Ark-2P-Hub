(function () {
  Ark.loadCss('/games/hopper/style.css');
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };
  // The cars' colours are the cars themselves.
  const CARS = ['#ef4444', '#facc15', '#a855f7', '#22d3ee', '#f97316'];
  const MAX_EXTRAPOLATE_MS = 400; // views come a few times a second; the lanes run on by the clock

  let root = null;
  let arena = null;
  let canvas = null;
  let stats = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let statsKey = '';
  let overlayKey = '';

  function resize() {
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / view.w, box.height / view.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(view.w * scale);
    const h = Math.floor(view.h * scale);
    if (canvas.width !== Math.floor(w * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  function positions(v, lane, t) {
    return lane.objs.map(function (x0) {
      const x = (((x0 + lane.dir * lane.speed * t) % v.wrap) + v.wrap) % v.wrap;
      return x - 3;
    });
  }

  // The scene's colours are the place itself: grass, road, river, logs.
  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const v = view;
    const g = canvas.getContext('2d');
    const k = canvas.width / v.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    const live = v.phase === 'play' || v.phase === 'dead';
    const extra = live ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    const t = v.t + extra;

    for (let row = 0; row < v.h; row++) {
      const lane = v.lanes.find(function (l) { return l.row === row; });
      g.fillStyle = !lane ? (row === 0 ? '#166534' : '#15803d') : lane.kind === 'river' ? '#1e3a8a' : '#334155';
      g.fillRect(0, row, v.w, 1);
      if (lane && lane.kind === 'road' && row !== 11) {
        g.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let x = 0.2; x < v.w; x += 1.2) g.fillRect(x, row + 0.97, 0.6, 0.06);
      }
    }
    // Lily pads on the far bank, where the frog is headed.
    g.fillStyle = '#4ade80';
    for (let x = 1; x < v.w; x += 3) {
      g.beginPath();
      g.arc(x + 0.5, 0.5, 0.3, 0.3, Math.PI * 2 - 0.3);
      g.lineTo(x + 0.5, 0.5);
      g.fill();
    }

    v.lanes.forEach(function (lane, i) {
      positions(v, lane, t).forEach(function (x, j) {
        if (lane.kind === 'river') {
          g.fillStyle = '#92400e';
          g.fillRect(x + 0.05, lane.row + 0.15, lane.len - 0.1, 0.7);
          g.fillStyle = '#b45309';
          g.fillRect(x + 0.15, lane.row + 0.3, lane.len - 0.3, 0.12);
        } else {
          g.fillStyle = CARS[(i + j) % CARS.length];
          g.fillRect(x + 0.08, lane.row + 0.15, lane.len - 0.16, 0.7);
          g.fillStyle = 'rgba(15, 23, 42, 0.7)'; // windscreen, at the front
          const front = lane.dir > 0 ? x + lane.len - 0.45 : x + 0.2;
          g.fillRect(front, lane.row + 0.25, 0.25, 0.5);
        }
      });
    });

    // The frog: riding a log between views, it moves with it.
    const f = v.frog;
    let fx = f.x;
    const lane = v.lanes.find(function (l) { return l.row === f.row; });
    if (v.phase === 'play' && lane && lane.kind === 'river') fx += lane.dir * lane.speed * extra;
    if (v.phase === 'dead' && v.death) {
      g.font = '0.9px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(v.death.how === 'water' ? '💦' : v.death.how === 'time' ? '⏰' : '💥', v.death.x + 0.5, v.death.row + 0.55);
    } else if (v.phase !== 'over') {
      g.fillStyle = '#22c55e';
      g.beginPath();
      g.ellipse(fx + 0.5, f.row + 0.55, 0.36, 0.32, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#16a34a'; // legs
      g.fillRect(fx + 0.1, f.row + 0.7, 0.18, 0.18);
      g.fillRect(fx + 0.72, f.row + 0.7, 0.18, 0.18);
      [0.33, 0.67].forEach(function (ex) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(fx + ex, f.row + 0.3, 0.11, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#05070f';
        g.beginPath();
        g.arc(fx + ex, f.row + 0.28, 0.05, 0, Math.PI * 2);
        g.fill();
      });
    }

    // Time left on this go, along the bottom.
    const left = v.phase === 'play' ? Math.max(0, v.timeLeft - extra * 1000) : v.timeLeft;
    g.fillStyle = left < 8000 ? '#ef4444' : '#facc15';
    g.fillRect(0, v.h - 0.1, (v.w * left) / v.lifeMs, 0.1);
  }

  function render(v) {
    let hearts = '';
    for (let i = 0; i < 3; i++) hearts += i < v.lives ? '🐸' : '<span class="gone">🐸</span>';
    const s = '<span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span><span>' + hearts + '</span><span>Crossing <strong>' + v.level + '</strong></span>';
    if (s !== statsKey) {
      statsKey = s;
      stats.innerHTML = s;
    }
    let html = '';
    if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  Ark.register('host', 'hopper', {
    sounds: function (prev, v) {
      if (v.death && (!prev.death || v.death.n !== prev.death.n)) return [v.death.how === 'water' ? 'splash' : 'crash'];
      if (v.lastCross && (!prev.lastCross || v.lastCross.n !== prev.lastCross.n)) return ['fanfare'];
      if (v.frog.row !== prev.frog.row) return ['tick'];
      return [];
    },
    padHint: 'D-pad / arrows hop · Start / P: pause',
    pad: function (btn) {
      if (btn === 'START') return { type: 'pause' };
      return DIRS[btn] ? { type: 'hop', dir: DIRS[btn] } : null;
    },
    overHtml: function (v) {
      return v.crossings + ' crossing' + (v.crossings === 1 ? '' : 's');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hopper-host';
      root.innerHTML = '<div class="hopper-stats"></div><div class="hopper-arena"><canvas></canvas><div class="hopper-overlay"></div></div>';
      el.appendChild(root);
      stats = root.querySelector('.hopper-stats');
      arena = root.querySelector('.hopper-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.hopper-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = arena = canvas = stats = overlay = view = null;
      statsKey = overlayKey = '';
    },
  });
})();
