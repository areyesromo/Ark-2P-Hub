(function () {
  Ark.loadCss('/games/sumo/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.2;
  const DASH_BUTTONS = ['A', 'B', 'X', 'RT', 'RB'];

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // eased disc positions actually drawn
  let fell = [0, 0]; // when each disc went over the edge (for the fall animation)
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
      sub = 'Round ' + v.round + ' · shove your rival off the ring · DASH hits harder';
    } else if (v.phase === 'roundEnd' && v.result) {
      const r = v.result;
      if (r.draw) {
        big = '🤝';
        sub = r.reason === 'time' ? "Time's up. Nobody fell: draw!" : 'Both fell off. Draw!';
      } else {
        big = v.scores[0] + ' : ' + v.scores[1];
        sub = nameOf(v, 1 - r.winner) + ' is out of the ring. ' + nameOf(v, r.winner) + ' takes the round!';
      }
    } else if (v.phase === 'over') {
      big = '🏆';
      sub = nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>' +
        '<br>Rematch or head back to the lobby from your phones or controllers.';
    } else if (v.phase === 'play' && v.ring.shrinking) {
      sub = '<span class="shrink">⚠ The ring is shrinking!</span>';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>';
  }

  function resize() {
    const f = view.field;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / f.w, box.height / f.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(f.w * scale);
    if (canvas.width !== Math.floor(w * dpr)) {
      canvas.width = canvas.height = Math.floor(w * dpr);
      canvas.style.width = canvas.style.height = w + 'px';
    }
  }

  function drawRing(g, ring, now) {
    // Where the ring used to reach, faintly.
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 0.05;
    g.beginPath();
    g.arc(ring.x, ring.y, ring.full, 0, Math.PI * 2);
    g.stroke();
    // The clay platform.
    const sand = g.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, ring.r);
    sand.addColorStop(0, '#e2c58e');
    sand.addColorStop(1, '#b8945a');
    g.fillStyle = sand;
    g.beginPath();
    g.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    g.fill();
    // The straw rope edge; it glows red while the ring shrinks.
    g.lineWidth = 0.22;
    g.strokeStyle = '#f2e3b3';
    if (ring.shrinking) {
      g.shadowColor = '#ef4444';
      g.shadowBlur = 24 + 10 * Math.sin(now / 120);
      g.strokeStyle = '#fca5a5';
    }
    g.beginPath();
    g.arc(ring.x, ring.y, ring.r - 0.11, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
    // The two starting lines (shikiri-sen).
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 0.08;
    [-1, 1].forEach(function (s) {
      const x = ring.x + s * Math.min(0.9, ring.r * 0.3);
      g.beginPath();
      g.moveTo(x, ring.y - 0.45);
      g.lineTo(x, ring.y + 0.45);
      g.stroke();
    });
  }

  function drawDisc(g, d, s, i, r, now) {
    const color = colors[i];
    let scale = 1;
    let alpha = 1;
    if (d.out) {
      // Falling off: shrink and fade over half a second.
      if (!fell[i]) fell[i] = now;
      const t = Math.min(1, (now - fell[i]) / 500);
      scale = 1 - 0.6 * t;
      alpha = 1 - 0.8 * t;
    } else {
      fell[i] = 0;
    }
    g.globalAlpha = alpha;
    if (d.dashing) {
      // Speed trail behind a dashing disc.
      g.strokeStyle = color;
      g.globalAlpha = alpha * 0.4;
      g.lineWidth = r * 1.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s.x - d.vx * 0.09, s.y - d.vy * 0.09);
      g.lineTo(s.x, s.y);
      g.stroke();
      g.globalAlpha = alpha;
    }
    g.shadowColor = color;
    g.shadowBlur = d.dashing ? 40 : 16;
    g.fillStyle = color;
    g.beginPath();
    g.arc(s.x, s.y, r * scale, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 0.08;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.stroke();
    // Dash cooldown: a ring that fills back up.
    const ready = 1 - d.dashIn / view.dashCooldownMs;
    g.strokeStyle = ready >= 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    g.lineWidth = 0.07;
    g.beginPath();
    g.arc(s.x, s.y, r * scale + 0.16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, ready)));
    g.stroke();
    g.globalAlpha = 1;
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, f.w, f.h);
    drawRing(g, view.ring, now);
    // Ease towards the newest positions, extrapolated a little along the velocity.
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, 60) / 1000 : 0;
    if (!shown) shown = view.discs.map(function (d) { return { x: d.x, y: d.y }; });
    view.discs.forEach(function (d, i) {
      const s = shown[i];
      s.x += (d.x + d.vx * dt - s.x) * 0.5;
      s.y += (d.y + d.vy * dt - s.y) * 0.5;
    });
    // Draw a disc that's falling first, so the one still standing is on top.
    [0, 1].sort(function (a, b) { return (view.discs[b].out ? 1 : 0) - (view.discs[a].out ? 1 : 0); })
      .forEach(function (i) { drawDisc(g, view.discs[i], shown[i], i, view.playerR, now); });
  }

  // Controllers: the stick (or D-pad) steers, in TV directions.
  function padPoll(pad) {
    function dz(a) {
      return Math.abs(a) < DEADZONE ? 0 : (a - Math.sign(a) * DEADZONE) / (1 - DEADZONE);
    }
    let x = dz(pad.stick.x);
    let y = dz(pad.stick.y);
    if (pad.held.indexOf('LEFT') !== -1 && Math.abs(pad.stick.x) < 0.6) x = -1;
    if (pad.held.indexOf('RIGHT') !== -1 && Math.abs(pad.stick.x) < 0.6) x = 1;
    if (pad.held.indexOf('UP') !== -1 && Math.abs(pad.stick.y) < 0.6) y = -1;
    if (pad.held.indexOf('DOWN') !== -1 && Math.abs(pad.stick.y) < 0.6) y = 1;
    return { type: 'move', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  Ark.register('host', 'sumo', {
    // Sound: a whoosh for each dash, a clack (or a thump for a hard one) for each bump, a crash for a fall.
    sounds: function (prev, v) {
      const out = [];
      if (v.dashes[0] + v.dashes[1] > prev.dashes[0] + prev.dashes[1]) out.push('whoosh');
      if (v.bumps > prev.bumps) out.push(v.lastBump > 0.45 ? 'boom' : 'puck');
      v.discs.forEach(function (d, i) {
        if (d.out && !prev.discs[i].out) out.push('crash');
      });
      return out;
    },
    padHint: 'Stick or D-pad to move · A / B / RT to DASH · A: rematch at the end',
    padPoll: padPoll,
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return DASH_BUTTONS.indexOf(btn) !== -1 ? { type: 'dash' } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'sm-host';
      root.innerHTML = '<div class="sm-board"></div><div class="sm-arena"><canvas></canvas><div class="sm-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.sm-board');
      arena = root.querySelector('.sm-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.sm-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (view && v.round !== view.round) shown = null; // discs jump back to their start spots
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
      root = board = arena = canvas = overlay = view = shown = null;
      fell = [0, 0];
      overlayKey = boardKey = '';
    },
  });
})();
