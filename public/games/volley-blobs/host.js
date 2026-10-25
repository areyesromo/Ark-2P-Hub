// Volley Blobs on the TV (server/games/volley-blobs.js): a beach court on a canvas. Views come
// ~30 times a second; between them the ball is carried on along its arc and the blobs ease
// towards where they are, so it moves smoothly.
(function () {
  Ark.loadCss('/games/volley-blobs/style.css');
  const esc = Ark.escapeHtml;
  const MAX_EXTRAPOLATE_MS = 100;
  const DEADZONE = 0.25;
  const SAND = 0.7; // units of sand drawn under the court line

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // smoothed blob positions actually drawn
  let overlayKey = '';
  let boardKey = '';
  let colors = null;
  let sky = null; // the sky gradient, made again only when the canvas changes size

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'First to ' + v.winScore + '. ' + nameOf(v, v.serveTo) + ' serves.';
    } else if (v.phase === 'point') {
      big = v.scores[0] + ' : ' + v.scores[1];
      sub = (v.fault === 'touches' ? 'Too many touches! ' : '') + nameOf(v, v.lastScorer) + ' scores!';
    } else if (v.phase === 'over') {
      big = '🏆';
      sub = nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] +
        '</strong><br>Rematch or head back to the lobby from your phones or controllers.';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  /** Fit the court (plus the sand under it) into the arena, sharp on high-DPI screens. */
  function resize() {
    const f = view.field;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / f.w, box.height / (f.h + SAND));
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(f.w * scale);
    const h = Math.floor((f.h + SAND) * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      sky = null;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    const Y = function (y) { return f.h - y; }; // court y (up) to canvas y (down)

    // Sky and sand.
    if (!sky) {
      sky = g.createLinearGradient(0, 0, 0, f.h);
      sky.addColorStop(0, '#0369a1');
      sky.addColorStop(1, '#7dd3fc');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, f.w, f.h);
    g.fillStyle = '#e7c98b';
    g.fillRect(0, f.h, f.w, SAND);

    // Ball: carried on along its arc from the last view.
    const b = view.ball;
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    const bx = Math.min(f.w - f.ballR, Math.max(f.ballR, b.x + b.vx * dt));
    const by = Math.max(f.ballR, b.y + b.vy * dt - (view.gravity * dt * dt) / 2);

    // Its shadow on the sand: smaller and fainter the higher it is.
    if (view.phase !== 'over') {
      const lift = Math.min(1, by / f.h);
      g.fillStyle = 'rgba(0, 0, 0,' + (0.3 - lift * 0.2) + ')';
      g.beginPath();
      g.ellipse(bx, f.h + 0.12, f.ballR * (1.2 - lift * 0.6), 0.08, 0, 0, Math.PI * 2);
      g.fill();
    }

    // The net.
    g.fillStyle = '#f8fafc';
    g.fillRect(f.w / 2 - f.netW / 2, Y(f.netH), f.netW, f.netH);
    g.fillRect(f.w / 2 - f.netW, Y(f.netH) - 0.08, f.netW * 2, 0.16);

    // Blobs: ease towards the latest position, then a dome with an eye that follows the ball.
    if (!shown) shown = view.blobs.map(function (p) { return { x: p.x, y: p.y }; });
    view.blobs.forEach(function (p, slot) {
      const s = shown[slot];
      s.x += (p.x - s.x) * 0.5;
      s.y += (p.y - s.y) * 0.5;
      const cy = Y(s.y);
      g.fillStyle = colors[slot];
      g.beginPath();
      g.arc(s.x, cy, f.blobR, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill();
      const face = slot === 0 ? 1 : -1;
      const ex = s.x + face * f.blobR * 0.4;
      const ey = cy - f.blobR * 0.5;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex, ey, 0.2, 0, Math.PI * 2);
      g.fill();
      const look = Math.atan2(Y(by) - ey, bx - ex);
      g.fillStyle = '#0f172a';
      g.beginPath();
      g.arc(ex + Math.cos(look) * 0.09, ey + Math.sin(look) * 0.09, 0.1, 0, Math.PI * 2);
      g.fill();
    });

    if (view.phase !== 'over') {
      g.fillStyle = '#fde047';
      g.strokeStyle = '#ca8a04';
      g.lineWidth = 0.05;
      g.beginPath();
      g.arc(bx, Y(by), f.ballR, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // Touches used on the side that has the ball: ● used, ○ left.
    if (view.phase === 'play') {
      view.touches.forEach(function (n, slot) {
        if (!n) return;
        g.fillStyle = 'rgba(255, 255, 255, 0.85)';
        g.font = '0.5px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('●'.repeat(n) + '○'.repeat(Math.max(0, view.maxTouches - n)), slot === 0 ? f.w / 4 : (3 * f.w) / 4, 0.8);
      });
    }
  }

  Ark.register('host', 'volley-blobs', {
    sounds: function (prev, v) {
      const out = [];
      if (prev.phase === 'play' && v.phase === 'play' && (v.touches[0] > prev.touches[0] || v.touches[1] > prev.touches[1])) out.push('paddle');
      if (prev.phase === 'play' && v.phase !== 'play') out.push('point');
      return out;
    },
    padHint: 'Left stick or D-pad ← → to move · A to jump · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return btn === 'A' || btn === 'B' ? { type: 'jump' } : null;
    },
    // Every frame for controller players (the hub only sends it when it changes).
    padPoll: function (pad) {
      let x = pad.stick.x;
      x = Math.abs(x) < DEADZONE ? 0 : Math.sign(x);
      if (pad.held.indexOf('LEFT') !== -1) x = -1;
      if (pad.held.indexOf('RIGHT') !== -1) x = 1;
      return { type: 'move', x: x };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'vb-host';
      root.innerHTML = '<div class="vb-board"></div><div class="vb-arena"><canvas></canvas><div class="vb-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.vb-board');
      arena = root.querySelector('.vb-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.vb-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      // A new rally (blobs back on their marks): jump there instead of easing across the court.
      if (view && v.phase !== view.phase && v.phase !== 'play') shown = null;
      view = v;
      viewAt = performance.now();
      const key = v.scores.join(':') + v.players.map(function (p) { return p.name; }).join('|');
      if (key !== boardKey) {
        boardKey = key;
        board.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore);
      }
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = board = arena = canvas = overlay = view = shown = sky = null;
      overlayKey = boardKey = '';
    },
  });
})();
