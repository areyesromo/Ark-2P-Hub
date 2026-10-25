// Rally Tennis on the TV (server/games/rally-tennis.js): the court upright, seen from above,
// player 1 at the bottom and player 2 at the top (so ◀ ▶ are the TV's left and right for both).
// The ball's shadow is on the court and the ball rises above it with its height; a mark shows
// where the last shot bounced. Views come ~30 times a second in a rally.
(function () {
  Ark.loadCss('/games/rally-tennis/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.4;
  const SWING_BUTTONS = ['A', 'B', 'RT', 'X'];
  const MARGIN = 1.4; // court units of surround drawn around the lines
  const REASON = { winner: 'Winner!', out: 'Out!' };

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let shown = null; // eased player positions
  let overlayKey = '';
  let boardKey = '';
  let colors = null;
  let frames = 0;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function renderBoard(v) {
    const key = v.games.join(':') + v.calls.join(':') + v.server + v.players.map(function (p) { return p.name; }).join('|');
    if (key === boardKey) return;
    boardKey = key;
    // Listed as on the court: player 2 at the top. Games, then this game's call.
    const deuce = v.calls[0] === '40' && v.calls[1] === '40';
    board.innerHTML = '<div class="head"><span></span><span></span><span>Games</span><span>Points</span></div>' + [1, 0].map(function (s) {
      return '<div class="row">' + (v.server === s ? '<span class="ball">🎾</span>' : '<span class="ball"></span>') + nameOf(v, s) + '<b>' + v.games[s] + '</b><i>' + v.calls[s] + '</i></div>';
    }).join('') + '<div class="game">' + (deuce ? 'Deuce' : '') + '</div><div class="to">First to ' + v.winGames + ' games</div>';
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = nameOf(v, v.server) + ' to serve';
    } else if (v.phase === 'serve') {
      sub = nameOf(v, v.server) + ' to serve: swing!';
    } else if (v.phase === 'point' && v.last) {
      big = REASON[v.last.reason] || '';
      sub = 'Point ' + nameOf(v, v.last.winner);
    } else if (v.phase === 'over') {
      big = '🏆';
      sub = nameOf(v, v.winner) + ' wins <strong>' + v.games[v.winner] + ' : ' + v.games[1 - v.winner] +
        '</strong><br>Rematch or head back to the lobby from your phones or controllers.';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  function resize() {
    if (frames++ % 30 && canvas.width) return;
    const c = view.court;
    const W = c.w + MARGIN * 2;
    const H = c.l + MARGIN * 2;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / W, box.height / H);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(W * scale);
    const h = Math.floor(H * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
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
    const c = view.court;
    const g = canvas.getContext('2d');
    const k = canvas.width / (c.w + MARGIN * 2);
    // Court y runs up the TV: player 1's baseline (y = 0) at the bottom.
    g.setTransform(k, 0, 0, k, MARGIN * k, MARGIN * k);
    const Y = function (y) { return c.l - y; };
    g.fillStyle = '#1e3a5f';
    g.fillRect(-MARGIN, -MARGIN, c.w + MARGIN * 2, c.l + MARGIN * 2);
    g.fillStyle = '#2563eb';
    g.fillRect(0, 0, c.w, c.l);
    g.strokeStyle = '#f8fafc';
    g.lineWidth = 0.08;
    g.strokeRect(0, 0, c.w, c.l);
    g.beginPath();
    g.moveTo(c.w / 2, Y(c.net - 4.5));
    g.lineTo(c.w / 2, Y(c.net + 4.5));
    g.moveTo(0, Y(c.net - 4.5));
    g.lineTo(c.w, Y(c.net - 4.5));
    g.moveTo(0, Y(c.net + 4.5));
    g.lineTo(c.w, Y(c.net + 4.5));
    g.stroke();
    // The net, a little wider than the court.
    g.fillStyle = '#e2e8f0';
    g.fillRect(-0.4, Y(c.net) - 0.08, c.w + 0.8, 0.16);

    // Where the last shot bounces (red if it's out).
    if (view.shot && view.phase !== 'serve') {
      g.strokeStyle = view.shot.out ? '#ef4444' : 'rgba(255, 255, 255, 0.6)';
      g.lineWidth = 0.06;
      g.beginPath();
      g.ellipse(view.shot.land.x, Y(view.shot.land.y), 0.3, 0.18, 0, 0, Math.PI * 2);
      g.stroke();
    }

    // Players: just behind their baselines, easing towards the latest position.
    if (!shown) shown = view.positions.slice();
    [0, 1].forEach(function (slot) {
      shown[slot] += (view.positions[slot] - shown[slot]) * 0.4;
      const y = Y(slot === 0 ? -0.6 : c.l + 0.6);
      g.fillStyle = colors[slot];
      g.beginPath();
      g.arc(shown[slot], y, 0.42, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#0f172a';
      g.lineWidth = 0.08;
      g.beginPath();
      g.moveTo(shown[slot] + 0.35, y);
      g.lineTo(shown[slot] + 0.85, y + (slot === 0 ? -0.35 : 0.35)); // the racket
      g.stroke();
    });

    // The ball: its shadow on the court, the ball above it by its height.
    if (view.phase !== 'over') {
      const b = view.ball;
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      g.beginPath();
      g.ellipse(b.x, Y(b.y), 0.22, 0.12, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d9f99d';
      g.beginPath();
      g.arc(b.x, Y(b.y) - b.z * 0.9, 0.18 + b.z * 0.03, 0, Math.PI * 2);
      g.fill();
    }
  }

  Ark.register('host', 'rally-tennis', {
    sounds: function (prev, v) {
      const out = [];
      const land = function (w) { return w.shot ? w.shot.land.x + ',' + w.shot.land.y + ',' + w.shot.by : ''; };
      if (v.shot && land(v) !== land(prev)) out.push('paddle');
      if (v.last && !(prev.last && prev.last.n === v.last.n)) out.push(v.last.reason === 'out' ? 'wrong' : 'point');
      return out;
    },
    padHint: 'A: swing (serve, and as the ball reaches you) · stick or D-pad ← → to aim · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return SWING_BUTTONS.indexOf(btn) !== -1 ? { type: 'swing' } : null;
    },
    padPoll: function (pad) {
      let dir = Math.abs(pad.stick.x) < DEADZONE ? 0 : Math.sign(pad.stick.x);
      if (pad.held.indexOf('LEFT') !== -1) dir = -1;
      if (pad.held.indexOf('RIGHT') !== -1) dir = 1;
      return { type: 'aim', dir: dir };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'rt-host';
      root.innerHTML = '<div class="rt-board"></div><div class="rt-arena"><canvas></canvas><div class="rt-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.rt-board');
      arena = root.querySelector('.rt-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.rt-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (view && v.phase === 'serve' && view.phase !== 'serve') shown = null; // back to the middle
      view = v;
      renderBoard(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = board = arena = canvas = overlay = view = shown = null;
      overlayKey = boardKey = '';
    },
  });
})();
