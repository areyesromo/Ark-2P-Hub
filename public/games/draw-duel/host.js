(function () {
  Ark.loadCss('/games/draw-duel/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.2;
  const CURSOR_SPEED = 0.8; // canvas widths per second at full stick
  const PEN_BUTTONS = ['A', 'RT', 'RB'];
  const PAD_SEND_MS = 50;

  let root = null;
  let els = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let textKey = '';
  let colors = null;
  const cursors = {}; // slot -> controller cursor { x, y, down, pending, lastSend, lastPoll, round }

  /** Paths of [x, y, ...] in 0..1 units onto a square canvas. */
  function paint(canvas, paths, color, widthFrac, alpha) {
    const g = canvas.getContext('2d');
    const s = canvas.width;
    g.save();
    g.globalAlpha = alpha || 1;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = Math.max(2, s * widthFrac);
    g.lineCap = g.lineJoin = 'round';
    paths.forEach(function (p) {
      if (p.length === 2) {
        g.beginPath();
        g.arc(p[0] * s, p[1] * s, g.lineWidth / 2, 0, Math.PI * 2);
        g.fill();
        return;
      }
      g.beginPath();
      g.moveTo(p[0] * s, p[1] * s);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * s, p[i + 1] * s);
      g.stroke();
    });
    g.restore();
  }

  /** The outline moved and scaled onto the drawing's box, the way scoring compares them. */
  function alignTo(outline, strokes) {
    function box(paths) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      paths.forEach(function (p) {
        for (let i = 0; i < p.length; i += 2) {
          x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
          y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
        }
      });
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0) };
    }
    const a = box(outline);
    const b = box(strokes);
    if (!strokes.length || !(b.size > 0.05)) return outline;
    const k = b.size / a.size;
    return outline.map(function (p) {
      return p.map(function (v, i) { return i % 2 ? b.cy + (v - a.cy) * k : b.cx + (v - a.cx) * k; });
    });
  }

  function sizeCanvas(canvas) {
    const box = canvas.closest('.dd-board, .dd-target').getBoundingClientRect();
    const css = Math.floor(Math.min(box.width, box.height));
    const px = Math.floor(css * (window.devicePixelRatio || 1));
    if (canvas.width !== px) {
      canvas.width = canvas.height = px;
      canvas.style.width = canvas.style.height = css + 'px';
    }
    canvas.getContext('2d').clearRect(0, 0, px, px);
  }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function boardStatus(v, slot) {
    if (v.phase === 'draw') return v.done[slot] ? '✅ Done' : '✏️ Drawing…';
    if (v.phase === 'reveal') {
      const a = v.accuracy[slot];
      const best = v.accuracy[slot] > v.accuracy[1 - slot];
      return '<span class="pct' + (best ? ' best' : '') + '">' + a + '%</span>';
    }
    return '';
  }

  function centerHtml(v) {
    if (v.phase === 'countdown') {
      return '<div class="big">' + (v.countdown || '') + '</div><div class="sub">A shape flashes up for a few seconds.<br>Memorise it, then draw it from memory!</div>';
    }
    if (v.phase === 'show') return '<div class="label">Memorise!</div><div class="name">' + esc(v.shapeName) + '</div>';
    if (v.phase === 'draw') return '<div class="label">Draw it from memory</div><div class="name">' + esc(v.shapeName) + '</div>';
    if (v.phase === 'reveal') {
      const a = v.accuracy;
      let who = 'Dead heat!';
      if (a[0] !== a[1]) who = nameOf(v, a[0] > a[1] ? 0 : 1) + ' drew it best';
      return '<div class="label">The ' + esc(v.shapeName) + '</div><div class="sub">' + who + '</div>';
    }
    if (v.phase === 'over') {
      const rows = v.history.map(function (h) {
        return '<tr><td>' + esc(h.name) + '</td><td class="p1-text">' + h.accuracy[0] + '%</td><td class="p2-text">' + h.accuracy[1] + '%</td></tr>';
      }).join('');
      const result = v.draw
        ? '🤝 It\'s a draw!'
        : '🏆 ' + nameOf(v, v.winner) + ' wins!';
      return '<div class="result">' + result + '</div><table class="dd-history">' + rows + '</table>' +
        '<div class="sub">Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    return '';
  }

  function renderText(v) {
    const key = JSON.stringify([v.phase, v.round, v.countdown, v.done, v.accuracy, v.scores, v.players]);
    if (key === textKey) return;
    textKey = key;
    [0, 1].forEach(function (slot) {
      els.names[slot].textContent = v.players[slot].name;
      els.scores[slot].textContent = v.scores[slot];
      els.status[slot].innerHTML = boardStatus(v, slot);
      els.boards[slot].classList.toggle('done', v.phase === 'draw' && v.done[slot]);
    });
    els.round.textContent = v.phase === 'countdown' || v.phase === 'over' ? 'Draw Duel' : 'Round ' + v.round + ' / ' + v.rounds;
    els.center.innerHTML = centerHtml(v);
    els.root.className = 'dd-host phase-' + v.phase;
  }

  function renderCanvases(v) {
    const outlineColor = '#eef0ff';
    [0, 1].forEach(function (slot) {
      const c = els.canvases[slot];
      sizeCanvas(c);
      if (v.phase === 'reveal' && v.outline) paint(c, alignTo(v.outline, v.strokes[slot]), outlineColor, 0.012, 0.3);
      paint(c, v.strokes[slot], slot === 0 ? colors.p1 : colors.p2, 0.018);
    });
    const t = els.target;
    sizeCanvas(t);
    if (v.outline) paint(t, v.outline, outlineColor, 0.02);
  }

  // Smooth timer bar and controller cursors between server views.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!els || !view) return;
    let frac = 0;
    if ((view.phase === 'show' || view.phase === 'draw') && view.phaseMs) {
      frac = Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.phaseMs;
    }
    els.bar.style.width = (frac * 100).toFixed(2) + '%';
    els.bar.classList.toggle('low', view.phase === 'draw' && frac < 0.25);
    const now = performance.now();
    [0, 1].forEach(function (slot) {
      const c = cursors[slot];
      const el = els.cursors[slot];
      const show = c && now - c.lastPoll < 500 && view.phase === 'draw' && !view.done[slot];
      el.classList.toggle('hidden', !show);
      if (show) {
        el.style.left = c.x * 100 + '%';
        el.style.top = c.y * 100 + '%';
        el.classList.toggle('down', c.down);
      }
    });
  }

  function dz(a) {
    return Math.abs(a) < DEADZONE ? 0 : (a - Math.sign(a) * DEADZONE) / (1 - DEADZONE);
  }

  // Controller drawing: the left stick (or D-pad) moves a cursor; hold A / RT
  // / RB to draw. Points go to the server in small batches, like a phone's.
  function padPoll(pad, v, slot) {
    const now = performance.now();
    let c = cursors[slot];
    if (!c || c.round !== v.round) {
      c = cursors[slot] = { x: 0.5, y: 0.5, down: false, pending: null, lastSend: 0, lastPoll: now, round: v.round };
    }
    const dt = Math.min(0.05, (now - c.lastPoll) / 1000);
    c.lastPoll = now;
    if (v.phase !== 'draw' || v.done[slot]) {
      c.down = false;
      c.pending = null;
      return null;
    }
    let x = dz(pad.stick.x);
    let y = dz(pad.stick.y);
    if (pad.held.indexOf('LEFT') !== -1) x = -1;
    if (pad.held.indexOf('RIGHT') !== -1) x = 1;
    if (pad.held.indexOf('UP') !== -1) y = -1;
    if (pad.held.indexOf('DOWN') !== -1) y = 1;
    c.x = Math.min(1, Math.max(0, c.x + x * CURSOR_SPEED * dt));
    c.y = Math.min(1, Math.max(0, c.y + y * CURSOR_SPEED * dt));
    const pen = PEN_BUTTONS.some(function (b) { return pad.held.indexOf(b) !== -1; });
    const px = Math.round(c.x * 1000) / 1000;
    const py = Math.round(c.y * 1000) / 1000;
    if (pen && !c.down) {
      c.pending = { type: 'draw', newStroke: true, pts: [px, py] };
    } else if (pen && (x || y)) {
      if (!c.pending) c.pending = { type: 'draw', newStroke: false, pts: [] };
      c.pending.pts.push(px, py);
    }
    const lifted = c.down && !pen;
    c.down = pen;
    if (c.pending && c.pending.pts.length && (lifted || now - c.lastSend >= PAD_SEND_MS || c.pending.pts.length >= 100)) {
      const out = c.pending;
      c.pending = null;
      c.lastSend = now;
      return out;
    }
    return null;
  }

  Ark.register('host', 'draw-duel', {
    padHint: 'Stick or D-pad moves · hold A to draw · B undo · X clear · Y done',
    padPoll: padPoll,
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'draw') return null;
      if (btn === 'B') return { type: 'undo' };
      if (btn === 'X') return { type: 'clear' };
      if (btn === 'Y' || btn === 'START') return { type: 'done' };
      return null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = { p1: css.getPropertyValue('--p1').trim() || '#22d3ee', p2: css.getPropertyValue('--p2').trim() || '#f472b6' };
      root = document.createElement('div');
      root.className = 'dd-host';
      function board(slot) {
        return '<div class="dd-side p' + (slot + 1) + '">' +
          '<div class="dd-head p' + (slot + 1) + '-text"><span class="name"></span><span class="score"></span></div>' +
          '<div class="dd-board"><div class="dd-paper"><canvas></canvas><div class="dd-cursor hidden"></div></div></div>' +
          '<div class="dd-status"></div></div>';
      }
      root.innerHTML =
        '<div class="dd-round"></div>' +
        '<div class="dd-main">' + board(0) +
        '<div class="dd-middle"><div class="dd-target"><canvas></canvas></div><div class="dd-center"></div>' +
        '<div class="dd-bar"><div class="fill"></div></div></div>' +
        board(1) + '</div>';
      el.appendChild(root);
      const sides = root.querySelectorAll('.dd-side');
      els = {
        root: root,
        round: root.querySelector('.dd-round'),
        center: root.querySelector('.dd-center'),
        bar: root.querySelector('.dd-bar .fill'),
        target: root.querySelector('.dd-target canvas'),
        boards: [sides[0].querySelector('.dd-board'), sides[1].querySelector('.dd-board')],
        canvases: [sides[0].querySelector('canvas'), sides[1].querySelector('canvas')],
        cursors: [sides[0].querySelector('.dd-cursor'), sides[1].querySelector('.dd-cursor')],
        names: [sides[0].querySelector('.name'), sides[1].querySelector('.name')],
        scores: [sides[0].querySelector('.score'), sides[1].querySelector('.score')],
        status: [sides[0].querySelector('.dd-status'), sides[1].querySelector('.dd-status')],
      };
      raf = requestAnimationFrame(tick);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      renderText(v);
      renderCanvases(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = els = view = null;
      textKey = '';
      Object.keys(cursors).forEach(function (k) { delete cursors[k]; });
    },
  });
})();
