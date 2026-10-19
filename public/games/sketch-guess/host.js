(function () {
  Ark.loadCss('/games/sketch-guess/style.css');
  const esc = Ark.escapeHtml;
  const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  let root = null;
  let els = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let textKey = '';

  /** Strokes ({ c: colour index, pts }) onto a square canvas; white is the eraser, so it's drawn wider. */
  function paint(canvas, strokes, colors) {
    const g = canvas.getContext('2d');
    const s = canvas.width;
    g.lineCap = g.lineJoin = 'round';
    strokes.forEach(function (st) {
      const p = st.pts;
      const eraser = st.c === colors.length - 1;
      g.strokeStyle = g.fillStyle = colors[st.c] || colors[0];
      g.lineWidth = Math.max(2, s * (eraser ? 0.05 : 0.012));
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
  }

  function sizeCanvas(canvas, box) {
    const r = box.getBoundingClientRect();
    const css = Math.floor(Math.min(r.width, r.height));
    const px = Math.floor(css * (window.devicePixelRatio || 1));
    if (canvas.width !== px) {
      canvas.width = canvas.height = px;
      canvas.style.width = canvas.style.height = css + 'px';
    }
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, px, px);
  }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function starsText(n) {
    return n ? new Array(n + 1).join('⭐') : '—';
  }

  function secs(ms) {
    return Math.round(ms / 1000);
  }

  function rating(v) {
    const f = v.stars / v.maxStars;
    if (f >= 0.75) return 'Mind readers! 🧠';
    if (f >= 0.5) return 'Great team! 🙌';
    if (f >= 0.25) return 'Not bad at all 👍';
    return 'Picasso would be… intrigued 🎨';
  }

  function topHtml(v) {
    if (v.phase === 'over') return '<span>Sketch &amp; Guess</span><span class="stars">⭐ ' + v.stars + '</span>';
    return '<span>🎨 ' + nameOf(v, v.drawer) + ' draws · 🤔 ' + nameOf(v, v.guesser) + ' guesses</span>' +
      '<span class="muted">Round ' + v.round + ' / ' + v.rounds + '</span>' +
      '<span class="stars">⭐ ' + v.stars + '</span>';
  }

  function overlayHtml(v) {
    if (v.phase === 'choose') return '<div class="sub">' + nameOf(v, v.drawer) + ' is choosing a word…</div>';
    if (v.phase === 'reveal' && v.result) {
      const r = v.result;
      const head = r.guessed
        ? '✅ ' + nameOf(v, v.guesser) + ' got it in ' + secs(r.ms) + 's!'
        : '⏰ Nobody got it';
      return '<div class="sub">' + head + '</div><div class="word">' + esc(r.word) + '</div><div class="sub">' + (r.stars ? starsText(r.stars) : 'No stars this time') + '</div>';
    }
    if (v.phase === 'over') {
      const rows = v.history.map(function (h) {
        return '<tr><td>' + esc(h.word) + ' <span class="lvl ' + h.level + '">' + LEVEL_NAMES[h.level] + '</span></td>' +
          '<td>' + nameOf(v, h.drawer) + '</td>' +
          '<td>' + (h.guessed ? '✅ ' + secs(h.ms) + 's' : '❌') + '</td>' +
          '<td>' + starsText(h.stars) + '</td></tr>';
      }).join('');
      return '<div class="result">⭐ ' + v.stars + ' / ' + v.maxStars + ' · ' + rating(v) + '</div>' +
        '<table class="sg-history">' + rows + '</table>' +
        '<div class="sub small">Rematch or head back to the lobby from your phones.</div>';
    }
    return '';
  }

  function sideHtml(v) {
    if (v.phase !== 'draw') return '';
    let html = '<div class="sg-blanks">' + esc(v.blanks).replace(/ /g, '&nbsp;&nbsp;') + '</div>' +
      '<div class="sg-level lvl ' + v.level + '">' + LEVEL_NAMES[v.level] + ' word</div>' +
      '<div class="sg-bar"><div class="fill"></div></div>';
    const guesses = v.guesses.slice().reverse().map(function (g) {
      return '<li class="' + (g.close ? 'close' : '') + '">' + esc(g.text) + (g.close ? ' <em>so close!</em>' : '') + '</li>';
    }).join('');
    html += '<ul class="sg-guesses">' + guesses + '</ul>';
    return html;
  }

  function render(v) {
    const key = JSON.stringify([v.phase, v.round, v.blanks, v.guesses, v.stars, v.result && v.result.word]);
    if (key !== textKey) {
      textKey = key;
      els.top.innerHTML = topHtml(v);
      els.overlay.innerHTML = overlayHtml(v);
      els.side.innerHTML = sideHtml(v);
      els.root.className = 'sg-host phase-' + v.phase;
    }
    sizeCanvas(els.canvas, els.paper);
    paint(els.canvas, v.strokes, v.colors);
  }

  // Smooth timer bar between the once-a-second views.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!els || !view) return;
    const bar = els.side.querySelector('.sg-bar .fill');
    if (!bar) return;
    const frac = view.phaseMs ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.phaseMs : 0;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', frac < 0.2);
  }

  Ark.register('host', 'sketch-guess', {
    // Sound: a whoosh when drawing starts, a buzz (or "so close") for each wrong guess, and the verdict.
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'draw' && prev.phase !== 'draw') out.push('whoosh');
      if (v.phase === 'draw' && v.guesses.length && JSON.stringify(v.guesses) !== JSON.stringify(prev.guesses)) {
        out.push(v.guesses[v.guesses.length - 1].close ? 'close' : 'wrong');
      }
      if (v.phase === 'reveal' && prev.phase !== 'reveal') out.push(v.result && v.result.guessed ? 'correct' : 'wrong');
      return out;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sg-host';
      root.innerHTML =
        '<div class="sg-top"></div>' +
        '<div class="sg-main"><div class="sg-paper"><canvas></canvas><div class="sg-overlay"></div></div><div class="sg-side"></div></div>';
      el.appendChild(root);
      els = {
        root: root,
        top: root.querySelector('.sg-top'),
        paper: root.querySelector('.sg-paper'),
        canvas: root.querySelector('canvas'),
        overlay: root.querySelector('.sg-overlay'),
        side: root.querySelector('.sg-side'),
      };
      raf = requestAnimationFrame(tick);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = els = view = null;
      textKey = '';
    },
  });
})();
