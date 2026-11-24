(function () {
  Ark.loadCss('/games/invaders/style.css');
  const DEADZONE = 0.15;
  const MAX_EXTRAPOLATE_MS = 80; // views come ~30 times a second; move things on between them
  // The aliens' colours by row are part of the game: the classic green-to-magenta bands.
  const ROWS = ['#f472b6', '#a78bfa', '#a78bfa', '#4ade80', '#4ade80'];

  let root = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let stats = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let statsKey = '';
  let overlayKey = '';
  let color = '#22d3ee';

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

  // The unlockable looks (see server/games/looks.js): the aliens' shape and colours by row,
  // the bunkers and the ship. These colours are the scene itself.
  const SPRITES = {
    alien: [
      ['..X..X..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'X.X..X.X', '.X....X.'],
      ['..X..X..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X....X.', 'X......X'],
    ],
    octopus: [
      ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X.X..X.X'],
      ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'X.X..X.X', '.X.XX.X.'],
    ],
    ghost: [
      ['..XXXX..', '.XXXXXX.', 'X..XX..X', 'XXXXXXXX', 'XXXXXXXX', 'X.XX.XX.'],
      ['..XXXX..', '.XXXXXX.', 'X..XX..X', 'XXXXXXXX', 'XXXXXXXX', '.XX.XX.X'],
    ],
    sweet: [
      ['...XX...', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.XXXXXX.', '..X..X..'],
      ['...XX...', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.XXXXXX.', '.X....X.'],
    ],
  };
  const THEMES = {
    classic: { sprite: 'alien', rows: ROWS, bunker: '#4ade80', ship: null },
    ocean: { sprite: 'octopus', rows: ['#2dd4bf', '#22d3ee', '#38bdf8', '#818cf8', '#a78bfa'], bunker: '#fb7185', ship: '#facc15' },
    spooky: { sprite: 'ghost', rows: ['#f1f5f9', '#e9d5ff', '#c4b5fd', '#a78bfa', '#f1f5f9'], bunker: '#f97316', ship: '#a855f7' },
    candy: { sprite: 'sweet', rows: ['#f9a8d4', '#fdba74', '#fde68a', '#bef264', '#a5f3fc'], bunker: '#f472b6', ship: '#f9a8d4' },
  };
  const themeOf = function (v) { return THEMES[v.look] || THEMES.classic; };

  /** A little pixel alien, two frames of legs. */
  function alien(g, x, y, w, h, row, frame, theme) {
    g.fillStyle = theme.rows[row % theme.rows.length];
    const px = w / 8;
    const py = h / 6;
    SPRITES[theme.sprite][frame].forEach(function (line, r) {
      for (let c = 0; c < 8; c++) if (line[c] === 'X') g.fillRect(x + c * px, y + r * py, px + 0.02, py + 0.02);
    });
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
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    const frame = Math.floor(now / 400) % 2;

    const theme = themeOf(view);
    const shift = view.march.dir * view.march.speed * dt;
    view.aliens.forEach(function (a) { alien(g, a[0] + shift, a[1], view.alien.w, view.alien.h, a[2], frame, theme); });

    if (view.saucer) {
      const s = view.saucer;
      const x = s.x + s.vx * dt;
      g.fillStyle = '#f87171';
      g.beginPath();
      g.ellipse(x + s.w / 2, s.y + 1.6, s.w / 2, 1.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fde68a';
      g.beginPath();
      g.ellipse(x + s.w / 2, s.y + 0.6, s.w / 4, 1, 0, Math.PI, 0);
      g.fill();
    }

    const bk = view.bunker;
    g.fillStyle = theme.bunker;
    view.bunkers.forEach(function (b) {
      for (let i = 0; i < b.cells.length; i++) {
        if (b.cells[i] !== '1') continue;
        g.fillRect(b.x + (i % bk.cols) * bk.cell, bk.y + Math.floor(i / bk.cols) * bk.cell, bk.cell + 0.02, bk.cell + 0.02);
      }
    });

    g.fillStyle = '#fde68a';
    view.bombs.forEach(function (b) {
      const y = b[1] + view.bombSpeed * dt;
      g.fillRect(b[0] - 0.35, y - 1.2, 0.7, 1.2);
    });
    if (view.shot) {
      g.fillStyle = '#fff';
      g.fillRect(view.shot.x - 0.3, view.shot.y + view.shot.vy * dt, 0.6, view.shot.h);
    }

    const s = view.ship;
    if (view.phase !== 'hit' || Math.floor(now / 120) % 2) {
      g.fillStyle = g.shadowColor = theme.ship || color;
      g.shadowBlur = 3;
      g.fillRect(s.x - s.w / 2, s.y + s.h * 0.4, s.w, s.h * 0.6);
      g.fillRect(s.x - s.w * 0.15, s.y, s.w * 0.3, s.h * 0.5);
      g.shadowBlur = 0;
    }
    g.fillStyle = 'rgba(74, 222, 128, 0.5)';
    g.fillRect(0, f.h - 1.2, f.w, 0.3);
  }

  function render(v) {
    const key = v.score + '|' + v.lives + '|' + v.wave;
    if (key !== statsKey) {
      statsKey = key;
      stats.innerHTML =
        '<span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span>' +
        '<span>Lives <strong class="lives">' + new Array(Math.max(0, v.lives) + 1).join('▲ ') + '</strong></span>' +
        '<span>Wave <strong>' + v.wave + '</strong></span>';
    }
    let html = '';
    if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    else if (v.phase === 'hit') html = '<div class="sub">Hit! Get ready…</div>';
    else if (v.phase === 'cleared') html = '<div class="big">Wave ' + (v.wave + 1) + '</div><div class="sub">They\'re back, and lower</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  Ark.register('host', 'invaders', {
    sounds: function (prev, v) {
      const out = [];
      if (v.shot && !prev.shot) out.push('shoot');
      if (v.kills > prev.kills) out.push('boom');
      if (v.saucers > prev.saucers) out.push('correct');
      if (v.lives < prev.lives) out.push('bigBoom');
      return out;
    },
    padHint: 'Stick, D-pad or arrows move · A, X or RT fire · Start / P pause',
    pad: function (btn) {
      if (btn === 'A' || btn === 'X' || btn === 'RT' || btn === 'B') return { type: 'fire' };
      if (btn === 'START') return { type: 'pause' };
      return null;
    },
    padPoll: function (pad) {
      let x = pad.stick.x;
      x = Math.abs(x) < DEADZONE ? 0 : (x - Math.sign(x) * DEADZONE) / (1 - DEADZONE);
      if (pad.held.indexOf('LEFT') !== -1) x = -1;
      if (pad.held.indexOf('RIGHT') !== -1) x = 1;
      return { type: 'axis', v: Math.round(x * 10) / 10 };
    },
    overHtml: function (v) {
      return 'Reached wave ' + v.wave + ' · ' + v.kills + ' aliens' + (v.saucers ? ' · ' + v.saucers + ' saucer' + (v.saucers > 1 ? 's' : '') : '');
    },
    mount: function (el) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || color;
      root = document.createElement('div');
      root.className = 'invaders-host';
      root.innerHTML = '<div class="invaders-stats"></div><div class="invaders-arena"><canvas></canvas><div class="invaders-overlay"></div></div>';
      el.appendChild(root);
      stats = root.querySelector('.invaders-stats');
      arena = root.querySelector('.invaders-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.invaders-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = arena = canvas = overlay = stats = view = null;
      statsKey = overlayKey = '';
    },
  });
})();
