(function () {
  Ark.loadCss('/games/pong/style.css');
  const esc = Ark.escapeHtml;
  const MAX_EXTRAPOLATE_MS = 100;
  const DEADZONE = 0.2;

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // smoothed paddle positions actually drawn
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
      sub = 'First to ' + v.winScore + '. Get ready!';
    } else if (v.phase === 'point') {
      big = v.scores[0] + ' : ' + v.scores[1];
      sub = nameOf(v, v.lastScorer) + ' scores!';
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

  /** Fit a 16:9 canvas into the arena, sharp on high-DPI screens. */
  function resize() {
    if (!view || !arena) return;
    const f = view.field;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / f.w, box.height / f.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(f.w * scale);
    const h = Math.floor(f.h * scale);
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
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, f.w, f.h);

    // Centre line
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 0.08;
    g.setLineDash([0.35, 0.35]);
    g.beginPath();
    g.moveTo(f.w / 2, 0.2);
    g.lineTo(f.w / 2, f.h - 0.2);
    g.stroke();
    g.setLineDash([]);

    // Paddles: ease towards the latest server position to hide the 30 Hz steps.
    if (!shown) shown = view.paddles.slice();
    for (let i = 0; i < 2; i++) shown[i] += (view.paddles[i] - shown[i]) * 0.5;
    g.shadowBlur = 18; // pixels: shadows ignore the canvas transform
    [0, 1].forEach(function (slot) {
      const x = slot === 0 ? f.paddleX : f.w - f.paddleX - f.paddleW;
      g.fillStyle = g.shadowColor = colors[slot];
      g.fillRect(x, shown[slot] - f.paddleH / 2, f.paddleW, f.paddleH);
    });

    // Ball: extrapolate from the last snapshot so it glides between updates.
    if (view.phase !== 'over') {
      const b = view.ball;
      const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
      const x = b.x + b.vx * dt;
      const y = Math.min(f.h - f.ballR, Math.max(f.ballR, b.y + b.vy * dt));
      g.fillStyle = g.shadowColor = '#ffffff';
      g.beginPath();
      g.arc(x, y, f.ballR, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowBlur = 0;

    if (view.rally > 2 && view.phase === 'play') {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.font = '0.5px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('Rally ' + view.rally, f.w / 2, 0.7);
    }
  }

  Ark.register('host', 'pong', {
    padHint: 'Left stick or D-pad ↑↓ to move · A: rematch at the end',
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    // Called every frame for controller players: stick / D-pad -> paddle direction.
    padPoll: function (pad) {
      let v = pad.stick.y;
      v = Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
      if (pad.held.indexOf('UP') !== -1) v = -1;
      if (pad.held.indexOf('DOWN') !== -1) v = 1;
      return { type: 'axis', v: Math.round(v * 10) / 10 };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'pong-host';
      root.innerHTML = '<div class="pong-board"></div><div class="pong-arena"><canvas></canvas><div class="pong-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.pong-board');
      arena = root.querySelector('.pong-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.pong-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
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
      root = board = arena = canvas = overlay = view = shown = null;
      overlayKey = boardKey = '';
    },
  });
})();
