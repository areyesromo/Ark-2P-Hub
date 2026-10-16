(function () {
  Ark.loadCss('/games/air-hockey/style.css');
  const esc = Ark.escapeHtml;
  const MAX_EXTRAPOLATE_MS = 100;
  const DEADZONE = 0.2;
  const RINK = 0.35; // rink border around the playing surface, in table units

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // eased mallet positions actually drawn
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
    } else if (v.phase === 'goal') {
      big = 'GOAL!';
      sub = nameOf(v, v.lastScorer) + ' scores · <strong>' + v.scores[0] + ' : ' + v.scores[1] + '</strong>';
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
    const f = view.field;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / (f.w + 2 * RINK), box.height / (f.h + 2 * RINK));
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor((f.w + 2 * RINK) * scale);
    const h = Math.floor((f.h + 2 * RINK) * scale);
    if (canvas.width !== Math.floor(w * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / (f.w + 2 * RINK);
    g.setTransform(k, 0, 0, k, RINK * k, RINK * k); // table units, origin at the playing surface
    g.clearRect(-RINK, -RINK, f.w + 2 * RINK, f.h + 2 * RINK);

    // Rink + surface
    roundRect(g, -RINK, -RINK, f.w + 2 * RINK, f.h + 2 * RINK, 1.6);
    g.fillStyle = '#1b2036';
    g.fill();
    roundRect(g, 0, 0, f.w, f.h, 1.3);
    g.fillStyle = '#081022';
    g.fill();

    // Markings
    g.strokeStyle = 'rgba(160,190,255,0.18)';
    g.lineWidth = 0.06;
    g.beginPath();
    g.moveTo(f.w / 2, 0);
    g.lineTo(f.w / 2, f.h);
    g.stroke();
    g.beginPath();
    g.arc(f.w / 2, f.h / 2, 1.4, 0, Math.PI * 2);
    g.stroke();
    [0, 1].forEach(function (slot) {
      const x = slot === 0 ? 0 : f.w;
      g.strokeStyle = colors[slot];
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(x, f.h / 2, f.goalH / 2 + 0.6, slot === 0 ? -Math.PI / 2 : Math.PI / 2, slot === 0 ? Math.PI / 2 : Math.PI * 1.5);
      g.stroke();
      g.globalAlpha = 1;
      // Goal mouth glow
      g.fillStyle = g.shadowColor = colors[slot];
      g.shadowBlur = 16;
      g.fillRect(slot === 0 ? -RINK : f.w, f.h / 2 - f.goalH / 2, RINK, f.goalH);
      g.shadowBlur = 0;
    });

    // Mallets: ease towards the latest server positions.
    if (!shown) shown = view.mallets.map(function (m) { return { x: m.x, y: m.y }; });
    view.mallets.forEach(function (m, slot) {
      shown[slot].x += (m.x - shown[slot].x) * 0.5;
      shown[slot].y += (m.y - shown[slot].y) * 0.5;
      const s = shown[slot];
      g.shadowColor = colors[slot];
      g.shadowBlur = 18;
      g.fillStyle = colors[slot];
      g.beginPath();
      g.arc(s.x, s.y, f.malletR, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.arc(s.x, s.y, f.malletR * 0.62, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = colors[slot];
      g.beginPath();
      g.arc(s.x, s.y, f.malletR * 0.32, 0, Math.PI * 2);
      g.fill();
    });

    // Puck: extrapolate between snapshots, kept on the table.
    const p = view.puck;
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    const px = Math.min(f.w + f.puckR, Math.max(-f.puckR, p.x + p.vx * dt));
    const py = Math.min(f.h - f.puckR, Math.max(f.puckR, p.y + p.vy * dt));
    g.shadowColor = '#ffffff';
    g.shadowBlur = 14;
    g.fillStyle = '#f5f7ff';
    g.beginPath();
    g.arc(px, py, f.puckR, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }

  Ark.register('host', 'air-hockey', {
    padHint: 'Left stick or D-pad to move your mallet · A: rematch at the end',
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    // Controllers: the stick moves the mallet in TV directions.
    padPoll: function (pad) {
      function dz(a) {
        return Math.abs(a) < DEADZONE ? 0 : (a - Math.sign(a) * DEADZONE) / (1 - DEADZONE);
      }
      let x = dz(pad.stick.x);
      let y = dz(pad.stick.y);
      if (pad.held.indexOf('LEFT') !== -1 && Math.abs(pad.stick.x) < 0.6) x = -1;
      if (pad.held.indexOf('RIGHT') !== -1 && Math.abs(pad.stick.x) < 0.6) x = 1;
      if (pad.held.indexOf('UP') !== -1 && Math.abs(pad.stick.y) < 0.6) y = -1;
      if (pad.held.indexOf('DOWN') !== -1 && Math.abs(pad.stick.y) < 0.6) y = 1;
      return { type: 'axis', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'ah-host';
      root.innerHTML = '<div class="ah-board"></div><div class="ah-arena"><canvas></canvas><div class="ah-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.ah-board');
      arena = root.querySelector('.ah-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.ah-overlay');
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
