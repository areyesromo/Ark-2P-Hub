(function () {
  Ark.loadCss('/games/air-hockey/style.css');
  const tableReady = Ark.loadScript('/games/air-hockey/table.js');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.2;

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
  let trail = []; // the puck's last few spots, drawn fading behind it
  let goalAt = 0; // when the last goal went in (the goal mouth flashes)
  let goalBy = null;

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
      sub = '<span class="ark-result">' + nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] +
        '</strong></span><br>Rematch or head back to the lobby from your phones or controllers.';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  // The TV shows the table sideways: P1's goal on the left, P2's on the right.
  /** The table's air holes: a faint dot grid, so it reads as an air hockey table. */
  function airHoles(g, f) {
    g.fillStyle = 'rgba(160, 190, 255, 0.07)';
    const step = f.w / 32;
    for (let x = step; x < f.w; x += step) {
      for (let y = step; y < f.h; y += step) g.fillRect(x - 0.03, y - 0.03, 0.06, 0.06);
    }
  }

  /** A goal: the goal it went into flashes in the scorer's colour, fading over a second. */
  function goalFlash(g, f, T) {
    const age = (performance.now() - goalAt) / 1000;
    if (goalBy === null || age > 1) return;
    const x = goalBy === 0 ? f.w : 0; // (player 1 scores in the right-hand goal)
    const r = f.goalH * (0.6 + age);
    const glow = g.createRadialGradient(x, f.h / 2, 0, x, f.h / 2, r);
    glow.addColorStop(0, colors[goalBy]);
    glow.addColorStop(1, 'transparent');
    g.globalAlpha = 0.55 * (1 - age);
    g.fillStyle = glow;
    g.fillRect(x - r, f.h / 2 - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    const T = window.ArkAirHockeyTable;
    if (!view || !T || !colors) return;
    const f = view.field;
    const totalW = f.w + 2 * T.RINK;
    const totalH = f.h + 2 * T.RINK;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / totalW, box.height / totalH);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(totalW * scale);
    const h = Math.floor(totalH * scale);
    if (canvas.width !== Math.floor(w * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const g = canvas.getContext('2d');
    const k = canvas.width / totalW;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(k, 0, 0, k, T.RINK * k, T.RINK * k);

    T.drawTable(g, f, colors);
    airHoles(g, f);
    goalFlash(g, f, T);
    shown = T.easeMallets(shown, view);
    shown.forEach(function (m, slot) { T.drawMallet(g, f, m.x, m.y, colors[slot]); });
    const p = T.puckNow(view, performance.now() - viewAt);
    // A short fading trail while it moves (none while it waits for the face-off).
    trail.push({ x: p.x, y: p.y });
    if (trail.length > 10 || view.phase !== 'play') trail.shift();
    if (view.phase !== 'play') trail = [];
    trail.forEach(function (q, i) {
      g.fillStyle = 'rgba(200, 220, 255, ' + (0.03 + (i / trail.length) * 0.22) + ')';
      g.beginPath();
      g.arc(q.x, q.y, f.puckR * (0.45 + 0.55 * (i / trail.length)), 0, Math.PI * 2);
      g.fill();
    });
    T.drawPuck(g, f, p.x, p.y);
  }

  Ark.register('host', 'air-hockey', {
    // Sound: a clack whenever the puck's velocity changes sharply (mallet or wall).
    sounds: function (prev, v) {
      if (prev.phase !== 'play' || v.phase !== 'play') return [];
      const dv = Math.hypot(v.puck.vx - prev.puck.vx, v.puck.vy - prev.puck.vy);
      const speed = Math.max(Math.hypot(prev.puck.vx, prev.puck.vy), Math.hypot(v.puck.vx, v.puck.vy));
      return dv > 1 && dv > 0.3 * speed ? ['puck'] : [];
    },
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
      root = document.createElement('div');
      root.className = 'ah-host';
      root.innerHTML = '<div class="ah-board"></div><div class="ah-arena"><canvas></canvas><div class="ah-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.ah-board');
      arena = root.querySelector('.ah-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.ah-overlay');
      tableReady.then(function () { colors = window.ArkAirHockeyTable.playerColors(); });
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (v.phase === 'goal' && (!view || view.phase !== 'goal')) {
        goalAt = performance.now();
        goalBy = v.lastScorer;
      }
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
      trail = [];
      goalBy = null;
      overlayKey = boardKey = '';
    },
  });
})();
