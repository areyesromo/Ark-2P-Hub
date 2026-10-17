(function () {
  Ark.loadCss('/games/bomb-duel/style.css');
  const esc = Ark.escapeHtml;
  const ROWS = [
    { key: 'wins', title: 'Round wins needed', fmt: function (n) { return 'First to ' + n; } },
    { key: 'crates', title: 'Crates', fmt: function (n) { return n < 50 ? 'Few' : n < 75 ? 'Normal' : 'Packed'; } },
  ];
  const ICON = { bomb: '💣', fire: '🔥', speed: '👟' };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const BOMB_BUTTONS = ['A', 'B', 'X', 'RT', 'RB'];
  const DEADZONE = 0.5;

  let root = null;
  let board = null;
  let stats = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let colors = null;
  let shown = null; // eased player positions
  let boardKey = '';
  let statsKey = '';
  let overlayKey = '';
  const pads = {}; // controller players on the setup screen: slot -> { row }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.names[slot].name) + '</span>';
  }

  function renderStats(v) {
    let html = '';
    if (v.players) {
      html = [0, 1].map(function (slot) {
        const p = v.players[slot];
        return '<div class="bd-stat p' + (slot + 1) + '">' + ICON.bomb + '×' + p.bombs + ' &nbsp;' + ICON.fire + '×' + p.range + ' &nbsp;' + ICON.speed + '+' + p.speed + '</div>';
      }).join('<div class="bd-clock"></div>');
    }
    if (html !== statsKey) {
      statsKey = html;
      stats.innerHTML = html;
    }
    const clock = stats.querySelector('.bd-clock');
    if (clock) {
      const s = Math.ceil(v.timeLeftMs / 1000);
      clock.textContent = v.suddenDeath ? '⚠ Sudden death' : v.phase === 'play' ? Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) : '';
      clock.classList.toggle('danger', v.suddenDeath || (v.phase === 'play' && s <= 10));
    }
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'setup') {
      html = '<div class="panel"><div class="title">💣 Bomb Duel</div>' + Ark.setup.html(v, ROWS, Ark.setup.focus({ players: v.names }, ROWS, pads)) +
        '<div class="sub">Pick on your phone, or with a controller (↑↓ row, ←→ change). <strong>Start</strong> (or <strong>A</strong>) when you\'re both ready.</div></div>';
    } else if (v.phase === 'countdown') {
      html = '<div class="panel small"><div class="big">' + (v.countdown || '') + '</div><div class="sub">Round ' + v.round +
        ' · blast crates for power-ups: ' + ICON.bomb + ' more bombs, ' + ICON.fire + ' bigger blasts, ' + ICON.speed + ' speed</div></div>';
    } else if (v.phase === 'roundEnd' && v.result) {
      const r = v.result;
      html = '<div class="panel small"><div class="big">' + (r.draw ? '🤝' : v.scores[0] + ' : ' + v.scores[1]) + '</div><div class="sub">' +
        (r.draw ? 'Both blown up: a draw!' : nameOf(v, r.winner) + ' takes round ' + v.round + '!') + '</div></div>';
    } else if (v.phase === 'over') {
      html = '<div class="panel"><div class="title">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</div>' +
        '<div class="sub">Rematch, change the settings (🎮 Y) or head back to the lobby from your phones or controllers.</div></div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    overlay.innerHTML = html;
  }

  // ---- drawing ----

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function block(g, x, y, top, side) {
    g.fillStyle = side;
    g.fillRect(x, y, 1, 1);
    g.fillStyle = top;
    g.fillRect(x + 0.06, y + 0.04, 0.88, 0.8);
  }

  function crate(g, x, y) {
    g.fillStyle = '#7c4a1e';
    g.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
    g.fillStyle = '#b7792f';
    g.fillRect(x + 0.1, y + 0.1, 0.8, 0.8);
    g.strokeStyle = '#7c4a1e';
    g.lineWidth = 0.09;
    g.beginPath();
    g.moveTo(x + 0.14, y + 0.14);
    g.lineTo(x + 0.86, y + 0.86);
    g.moveTo(x + 0.86, y + 0.14);
    g.lineTo(x + 0.14, y + 0.86);
    g.stroke();
  }

  function bomb(g, b, now) {
    const left = Math.max(0, b.left - (now - viewAt));
    const urgency = 1 - left / view.fuseMs;
    const pulse = 1 + 0.08 * Math.sin(now / (160 - 120 * urgency));
    const cx = b.x + 0.5;
    const cy = b.y + 0.55;
    const r = 0.34 * pulse;
    g.fillStyle = '#111827';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = colors[b.owner];
    g.lineWidth = 0.06;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
    g.fill();
    // Fuse and spark.
    g.strokeStyle = '#d6d3d1';
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(cx + r * 0.5, cy - r * 0.8);
    g.quadraticCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 0.6, cy - r * 1.5);
    g.stroke();
    g.fillStyle = Math.floor(now / 90) % 2 ? '#fde047' : '#f97316';
    g.beginPath();
    g.arc(cx + r * 0.6, cy - r * 1.5, 0.08 + 0.04 * urgency, 0, Math.PI * 2);
    g.fill();
  }

  function flame(g, x, y, now) {
    const flick = 0.06 * Math.sin(now / 40 + x * 3 + y * 5);
    g.fillStyle = '#ea580c';
    rr(g, x + 0.02, y + 0.02, 0.96, 0.96, 0.25);
    g.fill();
    g.fillStyle = '#fbbf24';
    rr(g, x + 0.18 - flick, y + 0.18 - flick, 0.64 + flick * 2, 0.64 + flick * 2, 0.2);
    g.fill();
    g.fillStyle = '#fef9c3';
    rr(g, x + 0.34, y + 0.34, 0.32, 0.32, 0.12);
    g.fill();
  }

  function player(g, p, s, slot) {
    const cx = s.x + 0.5;
    const cy = s.y + 0.5;
    g.globalAlpha = p.alive ? 1 : 0.35;
    g.shadowColor = colors[slot];
    g.shadowBlur = p.alive ? 18 : 0;
    g.fillStyle = colors[slot];
    g.beginPath();
    g.arc(cx, cy, 0.36, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#fff';
    g.lineWidth = 0.06;
    g.stroke();
    if (p.alive) {
      // Eyes, looking where it's heading.
      const d = DIRS[p.dir] || [0, 0.3];
      [-1, 1].forEach(function (side) {
        const ex = cx + side * 0.13 + d[0] * 0.08;
        const ey = cy - 0.06 + d[1] * 0.08;
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(ex, ey, 0.09, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#111';
        g.beginPath();
        g.arc(ex + d[0] * 0.035, ey + d[1] * 0.035, 0.045, 0, Math.PI * 2);
        g.fill();
      });
    } else {
      g.strokeStyle = '#111';
      g.lineWidth = 0.08;
      g.beginPath();
      g.moveTo(cx - 0.15, cy - 0.15);
      g.lineTo(cx + 0.15, cy + 0.15);
      g.moveTo(cx + 0.15, cy - 0.15);
      g.lineTo(cx - 0.15, cy + 0.15);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view || !view.players || !colors) {
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const v = view;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / v.w, box.height / v.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(v.w * scale);
    const h = Math.floor(v.h * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const g = canvas.getContext('2d');
    const k = canvas.width / v.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    // Floor and stone pillars.
    for (let y = 0; y < v.h; y++) {
      for (let x = 0; x < v.w; x++) {
        const pillar = x === 0 || y === 0 || x === v.w - 1 || y === v.h - 1 || (x % 2 === 0 && y % 2 === 0);
        if (pillar) block(g, x, y, '#94a3b8', '#475569');
        else {
          g.fillStyle = (x + y) % 2 ? '#3f7d3a' : '#468a40';
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    const at = function (c) { return [c % v.w, Math.floor(c / v.w)]; };
    v.powerups.forEach(function (pu) {
      const xy = at(pu[0]);
      g.fillStyle = 'rgba(15,23,42,0.75)';
      rr(g, xy[0] + 0.1, xy[1] + 0.1, 0.8, 0.8, 0.18);
      g.fill();
      g.font = '0.6px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ICON[pu[1]], xy[0] + 0.5, xy[1] + 0.54);
    });
    v.crates.forEach(function (c) { const xy = at(c); crate(g, xy[0], xy[1]); });
    v.walls.forEach(function (c) { const xy = at(c); block(g, xy[0], xy[1], '#7f1d1d', '#450a0a'); });
    v.bombs.forEach(function (b) { bomb(g, b, now); });
    v.fire.forEach(function (c) { const xy = at(c); flame(g, xy[0], xy[1], now); });
    // Players, eased towards the newest positions and nudged along their heading.
    const dt = v.phase === 'play' ? Math.min(performance.now() - viewAt, 60) / 1000 : 0;
    if (!shown) shown = v.players.map(function (p) { return { x: p.x, y: p.y }; });
    v.players.forEach(function (p, i) {
      const d = p.dir && p.alive ? DIRS[p.dir] : [0, 0];
      const tx = p.x + d[0] * p.speedCells * dt;
      const ty = p.y + d[1] * p.speedCells * dt;
      shown[i].x += (tx - shown[i].x) * 0.6;
      shown[i].y += (ty - shown[i].y) * 0.6;
    });
    [0, 1].sort(function (a, b) { return (v.players[a].alive ? 1 : 0) - (v.players[b].alive ? 1 : 0); })
      .forEach(function (i) { player(g, v.players[i], shown[i], i); });
  }

  // Controllers: D-pad or stick to walk (held), A / B / X / RT to drop a bomb.
  function padPoll(pad, v) {
    if (v.phase !== 'play' && v.phase !== 'countdown') return null;
    const held = pad.held;
    let dir = null;
    ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach(function (d) { if (held.indexOf(d) !== -1) dir = d.toLowerCase(); });
    const sx = pad.stick.x;
    const sy = pad.stick.y;
    if (!dir && Math.max(Math.abs(sx), Math.abs(sy)) > DEADZONE) dir = Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : sy > 0 ? 'down' : 'up';
    return { type: 'move', dir: dir };
  }

  Ark.register('host', 'bomb-duel', {
    // Sound: a thunk when a bomb is dropped, a boom (big for chains), a chime for a power-up, rumbling walls.
    sounds: function (prev, v) {
      const out = [];
      const a = prev.events;
      const b = v.events;
      if (!a || !b) return out;
      if (b.bombs > a.bombs) out.push('drop');
      if (b.booms > a.booms) out.push(b.booms - a.booms > 1 ? 'bigBoom' : 'boom');
      if (b.pickups > a.pickups) out.push('eat');
      if (b.walls > a.walls) out.push('lock');
      if (v.players && prev.players && v.players.some(function (p, i) { return !p.alive && prev.players[i].alive; })) out.push('crash');
      return out;
    },
    padHint: 'D-pad / stick to walk · A / B / X / RT to drop a bomb · Setup: ↑↓ row, ←→ change, A start · End: A rematch, Y settings',
    padPoll: padPoll,
    pad: function (btn, v, slot) {
      if (v.phase === 'setup') {
        if (!pads[slot]) pads[slot] = { row: 0 };
        const input = Ark.setup.pad(btn, v, ROWS, pads[slot]);
        if (view) {
          overlayKey = '';
          renderOverlay(view);
        }
        return input;
      }
      if (v.phase === 'over') {
        if (btn === 'A' || btn === 'START') return { type: 'rematch' };
        return btn === 'Y' ? { type: 'setup' } : null;
      }
      return BOMB_BUTTONS.indexOf(btn) !== -1 ? { type: 'bomb' } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'bd-host';
      root.innerHTML = '<div class="bd-board"></div><div class="bd-stats"></div><div class="bd-arena"><canvas></canvas><div class="bd-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.bd-board');
      stats = root.querySelector('.bd-stats');
      arena = root.querySelector('.bd-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.bd-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (!view || v.round !== view.round || !v.players) shown = null; // a new round: back to the corners
      view = v;
      viewAt = performance.now();
      const key = v.phase === 'setup' ? '' : JSON.stringify([v.scores, v.round, v.winScore, v.names.map(function (n) { return n.name; })]);
      if (key !== boardKey) {
        boardKey = key;
        board.innerHTML = key ? Ark.scoreboardHtml(v.names, v.scores, v.winScore, v.round) : '';
      }
      renderStats(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = board = stats = arena = canvas = overlay = view = shown = null;
      boardKey = statsKey = overlayKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
