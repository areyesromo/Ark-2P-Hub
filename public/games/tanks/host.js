(function () {
  Ark.loadCss('/games/tanks/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.2;
  const FIRE_BUTTONS = ['A', 'RT', 'RB', 'X'];

  let root = null;
  let board = null;
  let stats = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // eased tank positions/angles actually drawn
  let overlayKey = '';
  let boardKey = '';
  let statsKey = '';
  let colors = null;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function clock(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function hearts(hp, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < hp ? '♥' : '♡';
    return s;
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Round ' + v.round + ' · 3 hits and you are out · shells bounce once';
    } else if (v.phase === 'roundEnd' && v.result) {
      const r = v.result;
      if (r.draw) {
        big = '💥';
        sub = r.reason === 'time' ? 'Time! Same health. Draw!' : 'Both tanks destroyed. Draw!';
      } else if (r.reason === 'time') {
        big = '⏱';
        sub = 'Time! ' + nameOf(v, r.roundWinner) + ' has more armour left and takes the round';
      } else {
        big = v.scores[0] + ' : ' + v.scores[1];
        sub = nameOf(v, 1 - r.roundWinner) + ' was destroyed. ' + nameOf(v, r.roundWinner) + ' takes the round!';
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

  function renderStats(v) {
    const key = v.tanks.map(function (t) { return t.hp; }).join(':') + '|' + v.timeLeft + v.phase;
    if (key === statsKey) return;
    statsKey = key;
    const low = v.phase === 'play' && v.timeLeft <= 10;
    stats.innerHTML =
      '<span class="hearts p1-text">' + hearts(v.tanks[0].hp, v.tank.hp) + '</span>' +
      '<span class="clock' + (low ? ' low' : '') + '">⏱ ' + clock(v.timeLeft) + '</span>' +
      '<span class="hearts p2-text">' + hearts(v.tanks[1].hp, v.tank.hp) + '</span>';
  }

  function resize() {
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

  function drawTank(g, t, r, color, maxHp) {
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    g.shadowColor = color;
    g.shadowBlur = t.flash ? 30 : 12;
    // Tracks
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(-r * 1.05, -r * 1.05, r * 2.1, r * 0.5);
    g.fillRect(-r * 1.05, r * 0.55, r * 2.1, r * 0.5);
    // Body
    g.fillStyle = t.flash ? '#ffffff' : color;
    g.fillRect(-r * 0.9, -r * 0.62, r * 1.8, r * 1.24);
    // Turret + barrel
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = t.flash ? '#ffffff' : color;
    g.fillRect(0, -r * 0.13, r * 1.35, r * 0.26);
    g.restore();
    // Health pips above the tank (not rotated)
    for (let i = 0; i < maxHp; i++) {
      g.fillStyle = i < t.hp ? color : 'rgba(255,255,255,0.15)';
      g.fillRect(t.x - 0.36 + i * 0.26, t.y - r - 0.32, 0.2, 0.1);
    }
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

    // Floor grid
    g.strokeStyle = 'rgba(90,120,210,0.08)';
    g.lineWidth = 0.03;
    g.beginPath();
    for (let x = 1; x < f.w; x++) { g.moveTo(x, 0); g.lineTo(x, f.h); }
    for (let y = 1; y < f.h; y++) { g.moveTo(0, y); g.lineTo(f.w, y); }
    g.stroke();

    // Cover
    g.fillStyle = '#26304f';
    g.strokeStyle = 'rgba(160,190,255,0.45)';
    g.lineWidth = 0.05;
    view.obstacles.forEach(function (o) {
      g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeRect(o.x, o.y, o.w, o.h);
    });

    // Tanks: ease towards the latest server state (angle along the short way round).
    if (!shown) shown = view.tanks.map(function (t) { return { x: t.x, y: t.y, angle: t.angle }; });
    view.tanks.forEach(function (t, i) {
      const s = shown[i];
      s.x += (t.x - s.x) * 0.5;
      s.y += (t.y - s.y) * 0.5;
      s.angle += Math.atan2(Math.sin(t.angle - s.angle), Math.cos(t.angle - s.angle)) * 0.5;
      const drawn = { x: s.x, y: s.y, angle: s.angle, hp: t.hp, flash: t.flash };
      if (t.alive) {
        drawTank(g, drawn, view.tank.r, colors[i], view.tank.hp);
      } else {
        // Wreck + blast
        g.globalAlpha = 0.35;
        drawTank(g, drawn, view.tank.r, colors[i], view.tank.hp);
        g.globalAlpha = 1;
        const pulse = 0.9 + 0.2 * Math.sin((now || 0) / 90);
        g.fillStyle = 'rgba(255,190,90,0.85)';
        g.shadowColor = '#fb923c';
        g.shadowBlur = 40;
        g.beginPath();
        g.arc(s.x, s.y, pulse, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
      }
    });

    // Shells: extrapolated a little between snapshots, with a short trail.
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, 80) / 1000 : 0;
    view.shells.forEach(function (sh) {
      const x = sh.x + sh.vx * dt;
      const y = sh.y + sh.vy * dt;
      g.strokeStyle = colors[sh.owner];
      g.globalAlpha = 0.5;
      g.lineWidth = view.shellR * 1.2;
      g.beginPath();
      g.moveTo(x - sh.vx * 0.05, y - sh.vy * 0.05);
      g.lineTo(x, y);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#ffffff';
      g.shadowColor = colors[sh.owner];
      g.shadowBlur = 14;
      g.beginPath();
      g.arc(x, y, view.shellR, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    });
  }

  Ark.register('host', 'tanks', {
    // Sound: shots fired, hits, and a big bang when a tank is destroyed.
    sounds: function (prev, v) {
      const out = [];
      if (v.shells.length > prev.shells.length) out.push('shoot');
      v.tanks.forEach(function (t, i) {
        const p = prev.tanks[i];
        if (!p) return;
        if (p.alive && !t.alive) out.push('bigBoom');
        else if (t.hp < p.hp) out.push('boom');
      });
      return out;
    },
    padHint: 'Left stick or D-pad to drive · A / RT to fire · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return FIRE_BUTTONS.indexOf(btn) !== -1 ? { type: 'fire' } : null;
    },
    // Controllers: the stick (or D-pad) points where the tank should go, in TV directions.
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
      return { type: 'move', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'tk-host';
      root.innerHTML =
        '<div class="tk-board"></div><div class="tk-stats"></div>' +
        '<div class="tk-arena"><canvas></canvas><div class="tk-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.tk-board');
      stats = root.querySelector('.tk-stats');
      arena = root.querySelector('.tk-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.tk-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (view && v.round !== view.round) shown = null; // tanks jump back to their start spots
      view = v;
      viewAt = performance.now();
      const key = v.scores.join(':') + v.round + v.players.map(function (p) { return p.name; }).join('|');
      if (key !== boardKey) {
        boardKey = key;
        board.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round);
      }
      renderStats(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = board = stats = arena = canvas = overlay = view = shown = null;
      overlayKey = boardKey = statsKey = '';
    },
  });
})();
