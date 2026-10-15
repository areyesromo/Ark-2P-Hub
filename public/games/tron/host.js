(function () {
  Ark.loadCss('/games/tron/style.css');
  const esc = Ark.escapeHtml;
  const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  // Controller: D-pad / stick steer; the face buttons work as a diamond too.
  const PAD_DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right', Y: 'up', A: 'down', X: 'left', B: 'right' };

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let overlayKey = '';
  let boardKey = '';
  let colors = null;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Round ' + v.round + ' · first to ' + v.winScore;
    } else if (v.phase === 'crash' && v.result) {
      if (v.result.draw) {
        big = '💥';
        sub = 'Both crashed. Draw!';
      } else {
        big = v.scores[0] + ' : ' + v.scores[1];
        sub = nameOf(v, 1 - v.result.roundWinner) + ' crashed. ' + nameOf(v, v.result.roundWinner) + ' takes the round!';
      }
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

  function resize() {
    const g = view.grid;
    const box = arena.getBoundingClientRect();
    const scale = Math.floor(Math.min(box.width / g.w, box.height / g.h));
    const dpr = window.devicePixelRatio || 1;
    const w = g.w * scale;
    const h = g.h * scale;
    if (canvas.width !== Math.floor(w * dpr)) {
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
    const grid = view.grid;
    const g = canvas.getContext('2d');
    const k = canvas.width / grid.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, grid.w, grid.h);

    // Faint grid
    g.strokeStyle = 'rgba(80,110,200,0.12)';
    g.lineWidth = 0.04;
    g.beginPath();
    for (let x = 4; x < grid.w; x += 4) { g.moveTo(x, 0); g.lineTo(x, grid.h); }
    for (let y = 4; y < grid.h; y += 4) { g.moveTo(0, y); g.lineTo(grid.w, y); }
    g.stroke();

    // Slide the heads forward between ticks so movement looks continuous.
    const frac = view.phase === 'play' ? Math.min(1, (performance.now() - viewAt) / view.tickMs) : 0;

    view.cycles.forEach(function (c, slot) {
      const pts = c.path.map(function (p) { return [p[0] + 0.5, p[1] + 0.5]; });
      const head = pts[pts.length - 1].slice();
      if (!c.crashed && frac > 0) {
        head[0] += STEP[c.dir][0] * frac;
        head[1] += STEP[c.dir][1] * frac;
      }
      g.strokeStyle = g.shadowColor = colors[slot];
      g.shadowBlur = 14; // pixels
      g.lineWidth = 0.55;
      g.lineCap = 'square';
      g.lineJoin = 'miter';
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.lineTo(head[0], head[1]);
      g.stroke();

      if (c.crashed) {
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.shadowColor = colors[slot];
        g.shadowBlur = 40;
        g.beginPath();
        g.arc(head[0], head[1], 1.2, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = '#ffffff';
        g.fillRect(head[0] - 0.4, head[1] - 0.4, 0.8, 0.8);
      }
      g.shadowBlur = 0;
    });
  }

  Ark.register('host', 'tron', {
    padHint: 'D-pad or stick to steer (Y↑ A↓ X← B→ work too) · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return PAD_DIRS[btn] ? { type: 'turn', dir: PAD_DIRS[btn] } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'tron-host';
      root.innerHTML = '<div class="tron-board"></div><div class="tron-arena"><canvas></canvas><div class="tron-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.tron-board');
      arena = root.querySelector('.tron-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.tron-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      const key = v.scores.join(':') + v.round + v.players.map(function (p) { return p.name; }).join('|');
      if (key !== boardKey) {
        boardKey = key;
        board.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round);
      }
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = board = arena = canvas = overlay = view = null;
      overlayKey = boardKey = '';
    },
  });
})();
