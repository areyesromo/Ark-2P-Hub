(function () {
  Ark.loadCss('/games/sketch-guess/style.css');
  const esc = Ark.escapeHtml;
  const SEND_EVERY_MS = 50;
  const MIN_STEP = 0.004;
  const MAX_POINTS = 5000; // matches the server's limits
  const MAX_STROKES = 200;
  const LABELS = ['A', 'B', 'X', 'Y'];
  const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let color = 0;
  let strokes = []; // the drawer's own drawing this round: [{ c, pts }]
  let points = 0;
  let round = -1;
  let drawing = false;
  let pending = null;
  let sendTimer = null;
  let lastSent = 0;
  let textKey = '';
  let buzzedRound = -1;

  function paint(canvas, list, colors) {
    const g = canvas.getContext('2d');
    const s = canvas.width;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.lineCap = g.lineJoin = 'round';
    list.forEach(function (st) {
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

  function isDrawer() {
    return view && view.you === view.drawer;
  }

  function redraw() {
    if (!view) return;
    const c = els.canvas;
    const box = els.paper.getBoundingClientRect();
    const css = Math.floor(Math.min(box.width, box.height));
    if (css <= 0) return;
    const px = Math.floor(css * (window.devicePixelRatio || 1));
    if (c.width !== px) {
      c.width = c.height = px;
      c.style.width = c.style.height = css + 'px';
    }
    const mine = isDrawer() && view.phase === 'draw';
    paint(c, mine ? strokes : view.strokes, view.colors);
  }

  // ---- drawing (drawer) ------------------------------------------------------

  function send() {
    clearTimeout(sendTimer);
    sendTimer = null;
    if (!pending || !pending.pts.length) return;
    api.send(pending);
    lastSent = Date.now();
    pending = null;
  }

  function queuePoint(x, y, newStroke) {
    if (newStroke) {
      send();
      pending = { type: 'draw', newStroke: true, color: color, pts: [] };
    } else if (!pending) {
      pending = { type: 'draw', newStroke: false, pts: [] };
    }
    pending.pts.push(x, y);
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0 || pending.pts.length >= 100) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function canDraw() {
    return view && view.phase === 'draw' && isDrawer();
  }

  function at(e) {
    const r = els.canvas.getBoundingClientRect();
    return [
      Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 1000) / 1000,
      Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 1000) / 1000,
    ];
  }

  function onDown(e) {
    e.preventDefault();
    if (!canDraw() || strokes.length >= MAX_STROKES || points >= MAX_POINTS) return;
    if (els.canvas.setPointerCapture) els.canvas.setPointerCapture(e.pointerId);
    drawing = true;
    const p = at(e);
    strokes.push({ c: color, pts: p.slice() });
    points++;
    queuePoint(p[0], p[1], true);
    redraw();
  }

  function onMove(e) {
    if (!drawing || !canDraw() || points >= MAX_POINTS) return;
    const p = at(e);
    const s = strokes[strokes.length - 1].pts;
    if (Math.hypot(p[0] - s[s.length - 2], p[1] - s[s.length - 1]) < MIN_STEP) return;
    s.push(p[0], p[1]);
    points++;
    queuePoint(p[0], p[1], false);
    redraw();
  }

  function onUp() {
    if (!drawing) return;
    drawing = false;
    send();
  }

  // ---- buttons -----------------------------------------------------------------

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-choice')) return api.send({ type: 'choose', index: Number(b.getAttribute('data-choice')) });
    if (b.hasAttribute('data-color')) {
      color = Number(b.getAttribute('data-color'));
      renderPalette();
      return;
    }
    if (b.hasAttribute('data-pick')) return api.send({ type: 'pick', index: Number(b.getAttribute('data-pick')) });
    if (b.classList.contains('rematch')) return api.send({ type: 'rematch' });
    if (!canDraw()) return;
    send();
    if (b.classList.contains('undo')) {
      const gone = strokes.pop();
      if (gone) points -= gone.pts.length / 2;
      api.send({ type: 'undo' });
    } else if (b.classList.contains('clear')) {
      strokes = [];
      points = 0;
      api.send({ type: 'clear' });
    } else if (b.classList.contains('skip')) {
      api.send({ type: 'skip' });
    }
    redraw();
  }

  function onGuess(e) {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text || !view || view.phase !== 'draw') return;
    api.send({ type: 'guess', text: text });
    els.input.value = '';
    api.vibrate(10);
  }

  // ---- view ------------------------------------------------------------------

  function renderPalette() {
    if (!view) return;
    els.palette.innerHTML = view.colors.map(function (c, i) {
      const eraser = i === view.colors.length - 1;
      return '<button data-color="' + i + '" class="swatch' + (i === color ? ' on' : '') + (eraser ? ' eraser' : '') + '" style="background:' + c + '" aria-label="' + (eraser ? 'Eraser' : 'Colour ' + (i + 1)) + '"></button>';
    }).join('');
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  function promptHtml(v) {
    const drawer = isDrawer();
    if (v.phase === 'needPhone') return 'This game needs a phone player to draw.';
    if (v.phase === 'choose') return drawer ? '<strong>Your turn to draw!</strong> Pick a word:' : 'Your partner is picking a word…';
    if (v.phase === 'draw') {
      if (drawer) return 'Draw: <strong class="secret">' + esc(v.word) + '</strong> <span class="lvl ' + v.level + '">' + LEVEL_NAMES[v.level] + '</span>';
      return '<span class="blanks">' + esc(v.blanks).replace(/ /g, '&nbsp;&nbsp;') + '</span>';
    }
    if (v.phase === 'reveal' && v.result) {
      const r = v.result;
      return (r.guessed ? '✅ Got it! ' : '⏰ It was ') + '<strong>' + esc(r.word) + '</strong> ' + (r.stars ? new Array(r.stars + 1).join('⭐') : '');
    }
    if (v.phase === 'over') return '<span class="final">⭐ ' + v.stars + ' / ' + v.maxStars + '</span><br>Teamwork! Play again?';
    return '';
  }

  function render(v) {
    if (v.round !== round) {
      strokes = [];
      points = 0;
      pending = null;
      round = v.round;
    }
    if (v.phase === 'reveal' && buzzedRound !== v.round) {
      buzzedRound = v.round;
      api.vibrate(v.result && v.result.guessed ? [40, 40, 40] : 120);
    }
    view = v;
    const drawer = isDrawer();
    const key = JSON.stringify([v.phase, v.round, v.blanks, v.guesses, v.ruledOut, v.lockedMs > 0, v.stars, drawer, v.word]);
    if (key !== textKey) {
      textKey = key;
      els.score.textContent = '⭐ ' + v.stars + (v.phase === 'over' || v.phase === 'needPhone' ? '' : ' · Round ' + v.round + '/' + v.rounds);
      els.prompt.innerHTML = promptHtml(v);

      const choosing = v.phase === 'choose' && drawer && v.choices;
      show(els.choices, choosing);
      if (choosing) {
        els.choices.innerHTML = v.choices.map(function (c, i) {
          return '<button data-choice="' + i + '"><span class="lvl ' + c.level + '">' + LEVEL_NAMES[c.level] + '</span>' + esc(c.word) + '</button>';
        }).join('');
      }

      const drawingPhase = v.phase === 'draw' || v.phase === 'reveal';
      show(els.paper, drawingPhase);
      els.paper.classList.toggle('live', v.phase === 'draw' && drawer);
      show(els.tools, v.phase === 'draw' && drawer);
      if (v.phase === 'draw' && drawer) renderPalette();

      const guessing = v.phase === 'draw' && !drawer;
      show(els.form, guessing && !v.options);
      show(els.picks, guessing && Boolean(v.options));
      if (guessing && v.options) {
        els.picks.innerHTML = v.options.map(function (o, i) {
          const out = v.ruledOut.indexOf(i) !== -1;
          return '<button data-pick="' + i + '" class="c' + i + (out ? ' out' : '') + '"' + (out || v.lockedMs > 0 ? ' disabled' : '') + '><span class="badge">' + LABELS[i] + '</span>' + esc(o) + '</button>';
        }).join('');
      }
      show(els.log, v.phase === 'draw');
      els.log.innerHTML = v.guesses.slice().reverse().map(function (g) {
        return '<li class="' + (g.close ? 'close' : '') + '">' + esc(g.text) + (g.close ? ' <em>so close!</em>' : '') + '</li>';
      }).join('');
      show(els.rematch, v.phase === 'over' || v.phase === 'needPhone');
      if (v.phase !== 'draw') drawing = false;
    }
    redraw();
  }

  function onResize() {
    redraw();
  }

  Ark.register('player', 'sketch-guess', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sg-phone';
      root.innerHTML =
        '<div class="score"></div>' +
        '<div class="prompt"></div>' +
        '<div class="sg-choices hidden"></div>' +
        '<div class="sg-paper hidden"><canvas></canvas></div>' +
        '<div class="sg-tools hidden"><div class="palette"></div>' +
        '<div class="row"><button class="undo">↶ Undo</button><button class="clear">Clear</button><button class="skip">Skip word</button></div></div>' +
        '<form class="sg-form hidden" autocomplete="off"><input type="text" maxlength="40" placeholder="Type your guess…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send"><button class="primary" type="submit">Guess</button></form>' +
        '<div class="sg-picks hidden"></div>' +
        '<ul class="sg-guesses hidden"></ul>' +
        '<button class="primary rematch hidden">Play again</button>';
      el.appendChild(root);
      els = {
        score: root.querySelector('.score'),
        prompt: root.querySelector('.prompt'),
        choices: root.querySelector('.sg-choices'),
        paper: root.querySelector('.sg-paper'),
        canvas: root.querySelector('canvas'),
        tools: root.querySelector('.sg-tools'),
        palette: root.querySelector('.palette'),
        form: root.querySelector('.sg-form'),
        input: root.querySelector('.sg-form input'),
        picks: root.querySelector('.sg-picks'),
        log: root.querySelector('.sg-guesses'),
        rematch: root.querySelector('.rematch'),
      };
      els.canvas.addEventListener('pointerdown', onDown);
      els.canvas.addEventListener('pointermove', onMove);
      els.canvas.addEventListener('pointerup', onUp);
      els.canvas.addEventListener('pointercancel', onUp);
      els.form.addEventListener('submit', onGuess);
      root.addEventListener('click', onClick);
      window.addEventListener('resize', onResize);
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      window.removeEventListener('resize', onResize);
      root = els = view = pending = null;
      strokes = [];
      points = 0;
      round = buzzedRound = -1;
      drawing = false;
      textKey = '';
      color = 0;
    },
  });
})();
