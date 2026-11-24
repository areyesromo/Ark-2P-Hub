(function () {
  Ark.loadCss('/games/blocks-1p/style.css');
  // The shapes' colours are part of the game (the classic set: a cyan I, a yellow O…).
  // The unlockable looks (see server/games/looks.js): a colour per piece. These colours are the pieces themselves.
  const THEMES = {
    classic: { I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#4ade80', Z: '#f87171', J: '#3b82f6', L: '#fb923c' },
    candy: { I: '#a5f3fc', O: '#fde68a', T: '#d8b4fe', S: '#bbf7d0', Z: '#fecaca', J: '#bfdbfe', L: '#fed7aa' },
    retro: { I: '#c4e538', O: '#a3cf2a', T: '#86b81f', S: '#6a9f1a', Z: '#4f8715', J: '#3b6f12', L: '#d9f06b' },
    neon: { I: '#00f0ff', O: '#fff200', T: '#c400ff', S: '#00ff6a', Z: '#ff2a6d', J: '#2d6bff', L: '#ff9100' },
  };
  let COLORS = THEMES.classic;
  // The same shapes as the server (server/games/blocks.js), for the hold and next previews.
  const SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  };
  const DAS_MS = 170; // hold a direction this long before it repeats
  const ARR_MS = 45; // then one step this often
  const REPEATS = { LEFT: { type: 'move', dir: 'left' }, RIGHT: { type: 'move', dir: 'right' }, DOWN: { type: 'soft' } };

  let root = null;
  let well = null;
  let side = null;
  let overlay = null;
  let view = null;
  let flash = null; // { rows, until } rows that just cleared
  let raf = null;
  let sideKey = '';
  let overlayKey = '';
  const das = {}; // button -> { since, next, n } while a direction is held on a controller / the keyboard

  function square(g, x, y, color, alpha) {
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    g.fillStyle = color;
    g.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x + 0.04, y + 0.04, 0.92, 0.18);
    g.globalAlpha = 1;
  }

  function resize(canvas, wCells, hCells, box) {
    const scale = Math.floor(Math.min(box.width / wCells, box.height / hCells));
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(wCells * scale * dpr) || canvas.height !== Math.floor(hCells * scale * dpr)) {
      canvas.width = Math.floor(wCells * scale * dpr);
      canvas.height = Math.floor(hCells * scale * dpr);
      canvas.style.width = wCells * scale + 'px';
      canvas.style.height = hCells * scale + 'px';
    }
    return canvas.width / wCells;
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    const canvas = well.querySelector('canvas');
    const k = resize(canvas, view.w, view.h, well.getBoundingClientRect());
    const g = canvas.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, view.w, view.h);
    g.fillStyle = 'rgba(80,110,200,0.06)';
    for (let x = 1; x < view.w; x++) g.fillRect(x - 0.02, 0, 0.04, view.h);
    for (let i = 0; i < view.board.length; i++) {
      const c = view.board[i];
      if (c !== '.') square(g, i % view.w, Math.floor(i / view.w), COLORS[c]);
    }
    const p = view.piece;
    if (p && view.phase !== 'over') {
      p.cells.forEach(function (c) { if (c[1] + p.ghost >= 0) square(g, c[0], c[1] + p.ghost, COLORS[p.kind], 0.18); });
      p.cells.forEach(function (c) { if (c[1] >= 0) square(g, c[0], c[1], COLORS[p.kind]); });
    }
    if (flash && now < flash.until) {
      g.fillStyle = 'rgba(255,255,255,' + ((flash.until - now) / 400) * 0.8 + ')';
      flash.rows.forEach(function (y) { g.fillRect(0, y, view.w, 1); });
    }
  }

  function preview(kind, dim) {
    if (!kind) return '<div class="blocks-mini empty"></div>';
    const cells = SHAPES[kind];
    const w = kind === 'I' ? 4 : kind === 'O' ? 2 : 3;
    return '<div class="blocks-mini' + (dim ? ' dim' : '') + '" style="--w:' + w + '">' +
      cells.map(function (c) {
        return '<i style="grid-column:' + (c[0] + 1) + ';grid-row:' + (c[1] + (kind === 'I' ? 0 : 1)) + ';background:' + COLORS[kind] + '"></i>';
      }).join('') + '</div>';
  }

  function render(v) {
    const key = [v.hold, v.canHold, v.next.join(''), v.score, v.lines, v.level].join('|');
    if (key !== sideKey) {
      sideKey = key;
      side.innerHTML =
        '<div class="box"><div class="label">Hold</div>' + preview(v.hold, !v.canHold) + '</div>' +
        '<div class="box"><div class="label">Next</div>' + v.next.map(function (n) { return preview(n); }).join('') + '</div>' +
        '<div class="box stats"><div><span class="label">Score</span><strong>' + Ark.formatScore(v.score, 'pts') + '</strong></div>' +
        '<div><span class="label">Lines</span><strong>' + v.lines + '</strong></div>' +
        '<div><span class="label">Level</span><strong>' + v.level + '</strong></div></div>';
    }
    let html = '';
    if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  const WORDS = ['', 'Single', 'Double', 'Triple', 'FOUR ROWS!'];

  Ark.register('host', 'blocks-1p', {
    sounds: function (prev, v) {
      if (v.clears !== prev.clears) return [v.cleared.n === 4 ? 'fanfare' : 'correct'];
      if (v.phase === 'play' && prev.piece && v.piece && v.piece.kind !== prev.piece.kind) return ['drop'];
      return [];
    },
    padHint: '←→ move · ↓ soft drop · ↑ hard drop · A / B turn · Y / LB hold · Start pause',
    pad: function (btn) {
      if (btn === 'A' || btn === 'X') return { type: 'rotate', dir: 'cw' };
      if (btn === 'B') return { type: 'rotate', dir: 'ccw' };
      if (btn === 'UP' || btn === 'RT') return { type: 'drop' };
      if (btn === 'Y' || btn === 'LB' || btn === 'RB') return { type: 'hold' };
      if (btn === 'START') return { type: 'pause' };
      return null;
    },
    // Directions repeat while held (a step at once, then quickly after a short wait), like the arcade games do.
    // Each step carries a count, so the TV page sends it even though it looks like the last one.
    padPoll: function (pad) {
      const now = performance.now();
      let out = null;
      Object.keys(REPEATS).forEach(function (btn) {
        const down = pad.held.indexOf(btn) !== -1;
        if (!down) return delete das[btn];
        const d = das[btn];
        if (!d) {
          das[btn] = { next: now + DAS_MS, n: 1 };
          out = Object.assign({ n: 1 }, REPEATS[btn]);
        } else if (now >= d.next) {
          d.next = now + ARR_MS;
          d.n++;
          out = Object.assign({ n: d.n }, REPEATS[btn]);
        }
      });
      return out;
    },
    overHtml: function (v) {
      return v.lines + ' line' + (v.lines === 1 ? '' : 's') + ' · level ' + v.level;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'blocks-host';
      root.innerHTML = '<div class="blocks-well"><canvas></canvas><div class="blocks-overlay"></div><div class="blocks-callout"></div></div><div class="blocks-side"></div>';
      el.appendChild(root);
      well = root.querySelector('.blocks-well');
      side = root.querySelector('.blocks-side');
      overlay = root.querySelector('.blocks-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      COLORS = THEMES[v.look] || THEMES.classic;
      if (view && v.clears !== view.clears && v.cleared) {
        flash = { rows: v.cleared.rows, until: performance.now() + 400 };
        const call = root.querySelector('.blocks-callout');
        call.textContent = WORDS[v.cleared.n] || '';
        call.classList.remove('show');
        void call.offsetWidth; // restart the pop
        call.classList.add('show');
      }
      view = v;
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = well = side = overlay = view = flash = null;
      sideKey = overlayKey = '';
      Object.keys(das).forEach(function (k) { delete das[k]; });
    },
  });
})();
