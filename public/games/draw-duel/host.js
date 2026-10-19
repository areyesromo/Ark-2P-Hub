(function () {
  Ark.loadCss('/games/draw-duel/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let els = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let textKey = '';
  let colors = null;

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
        '<div class="sub">Rematch or head back to the lobby from your phones.</div>';
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

  // Smooth timer bar between server views.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!els || !view) return;
    let frac = 0;
    if ((view.phase === 'show' || view.phase === 'draw') && view.phaseMs) {
      frac = Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.phaseMs;
    }
    els.bar.style.width = (frac * 100).toFixed(2) + '%';
    els.bar.classList.toggle('low', view.phase === 'draw' && frac < 0.25);
  }

  Ark.register('host', 'draw-duel', {
    // Sound: a whoosh as each shape appears, a click when someone's done, a chime at the reveal.
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'show' && prev.phase !== 'show') out.push('whoosh');
      if (v.done.filter(Boolean).length > prev.done.filter(Boolean).length) out.push('lock');
      if (v.phase === 'reveal' && prev.phase !== 'reveal') out.push('reveal');
      return out;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = { p1: css.getPropertyValue('--p1').trim() || '#22d3ee', p2: css.getPropertyValue('--p2').trim() || '#f472b6' };
      root = document.createElement('div');
      root.className = 'dd-host';
      function board(slot) {
        return '<div class="dd-side p' + (slot + 1) + '">' +
          '<div class="dd-head p' + (slot + 1) + '-text"><span class="name"></span><span class="score"></span></div>' +
          '<div class="dd-board"><canvas></canvas></div>' +
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
    },
  });
})();
