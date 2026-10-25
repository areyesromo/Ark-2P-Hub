// Falling Blocks Battle on the TV (server/games/block-battle.js): both wells side by side on one
// canvas, each with its falling piece, an outline where it will land, the next piece, and a red
// bar for junk on its way in. Views come when something changes.
(function () {
  Ark.loadCss('/games/block-battle/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.5;
  // Piece colours (the blocks themselves), and junk grey.
  const COLORS = { I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316', g: '#6b7280' };
  // The next piece's preview shapes, as in the server.
  const SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  };
  const SIDE = 5; // cells of room beside each well for the next piece and the junk bar
  const GAP = 2;

  let root = null;
  let board = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let dirty = true;
  let overlayKey = '';
  let boardKey = '';
  let colors = null;
  let frames = 0;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    const r = v.result;
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Round ' + v.round + ' · first to ' + v.winScore;
    } else if (v.phase === 'roundEnd' && r) {
      big = v.scores[0] + ' : ' + v.scores[1];
      sub = r.draw ? 'Both full: a draw!' : nameOf(v, r.roundWinner) + ' takes the round!';
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
    if (frames++ % 30 && canvas.width) return;
    const W = (view.well.w + SIDE) * 2 + GAP;
    const H = view.well.h;
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
      dirty = true;
    }
  }

  function cell(g, x, y, color) {
    g.fillStyle = color;
    g.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
  }

  /** Redrawn only when a view changed (or the size did): nothing moves in between. */
  function draw() {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    if (!dirty) return;
    dirty = false;
    const wl = view.well;
    const g = canvas.getContext('2d');
    const k = canvas.width / ((wl.w + SIDE) * 2 + GAP);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    view.wells.forEach(function (w, slot) {
      // Player 1's well on the left with its side panel on the left; player 2 mirrored.
      const wx = slot === 0 ? SIDE : SIDE + wl.w + GAP;
      g.setTransform(k, 0, 0, k, wx * k, 0);
      g.fillStyle = '#0b1020';
      g.fillRect(0, 0, wl.w, wl.h);
      g.strokeStyle = colors[slot];
      g.lineWidth = 0.1;
      g.strokeRect(-0.05, -0.05, wl.w + 0.1, wl.h + 0.1);
      w.rows.forEach(function (row, y) {
        for (let x = 0; x < row.length; x++) if (row[x] !== '.') cell(g, x, y, w.out ? '#374151' : COLORS[row[x]]);
      });
      if (w.piece) {
        g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        g.lineWidth = 0.06;
        w.ghost.forEach(function (c) { if (c[1] >= 0) g.strokeRect(c[0] + 0.1, c[1] + 0.1, 0.8, 0.8); });
        w.piece.cells.forEach(function (c) { if (c[1] >= 0) cell(g, c[0], c[1], COLORS[w.piece.kind]); });
      }
      // Side panel: next piece, then the junk bar (one cell per row coming).
      const px = slot === 0 ? -SIDE + 0.5 : wl.w + 0.5;
      g.fillStyle = 'rgba(255, 255, 255, 0.5)';
      g.font = '0.8px system-ui, sans-serif';
      g.fillText('NEXT', px, 1);
      g.save();
      g.translate(px, 1.6);
      g.scale(0.8, 0.8);
      SHAPES[w.next].forEach(function (c) { cell(g, c[0], c[1], COLORS[w.next]); });
      g.restore();
      const bx = slot === 0 ? -0.8 : wl.w + 0.2;
      for (let i = 0; i < Math.min(w.pending, wl.h); i++) {
        g.fillStyle = '#ef4444';
        g.fillRect(bx, wl.h - 1 - i + 0.1, 0.6, 0.8);
      }
      g.fillStyle = 'rgba(255, 255, 255, 0.7)';
      g.fillText('Lines ' + w.lines, px, 5.5);
    });
  }

  Ark.register('host', 'block-battle', {
    sounds: function (prev, v) {
      if (prev.phase !== 'play') return [];
      const out = [];
      if (v.wells.some(function (w, i) { return w.lines > prev.wells[i].lines; })) out.push('point');
      else if (v.wells.some(function (w, i) { return w.rows.join('') !== prev.wells[i].rows.join(''); })) out.push('drop');
      if (v.wells.some(function (w, i) { return w.pending > prev.wells[i].pending; })) out.push('whoosh');
      return out;
    },
    padHint: 'D-pad ← → move, ↓ soft drop, ↑ hard drop · A / B rotate · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (btn === 'A' || btn === 'X') return { type: 'rotate', dir: 1 };
      if (btn === 'B' || btn === 'Y') return { type: 'rotate', dir: -1 };
      if (btn === 'UP') return { type: 'drop' };
      return null;
    },
    // Held ← → and ↓ (stick or D-pad), sent together whenever they change.
    padPoll: function (pad) {
      const held = function (b) { return pad.held.indexOf(b) !== -1; };
      let dir = Math.abs(pad.stick.x) > DEADZONE ? Math.sign(pad.stick.x) : 0;
      if (held('LEFT')) dir = -1;
      if (held('RIGHT')) dir = 1;
      const soft = held('DOWN') || pad.stick.y > DEADZONE;
      return { type: 'hold', dir: dir, soft: soft };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'bb-host';
      root.innerHTML = '<div class="bb-board"></div><div class="bb-arena"><canvas></canvas><div class="bb-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.bb-board');
      arena = root.querySelector('.bb-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.bb-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      dirty = true;
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
