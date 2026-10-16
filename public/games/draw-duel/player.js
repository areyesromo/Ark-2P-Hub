(function () {
  Ark.loadCss('/games/draw-duel/style.css');
  const SEND_EVERY_MS = 50;
  const MIN_STEP = 0.005; // ignore finger moves smaller than this (canvas widths)
  const MAX_POINTS = 1500; // matches the server's per-round limit
  const MAX_STROKES = 60;

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let color = '#22d3ee';
  let textKey = '';
  let strokes = []; // this round's drawing, kept here so drawing feels instant
  let points = 0;
  let round = 0;
  let drawing = false;
  let pending = null;
  let sendTimer = null;
  let lastSent = 0;

  function paint(canvas, paths, stroke, widthFrac, alpha) {
    const g = canvas.getContext('2d');
    const s = canvas.width;
    g.save();
    g.globalAlpha = alpha || 1;
    g.strokeStyle = g.fillStyle = stroke;
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

  function redraw() {
    const c = els.canvas;
    const box = els.pad.getBoundingClientRect();
    const css = Math.floor(Math.min(box.width, box.height));
    const px = Math.floor(css * (window.devicePixelRatio || 1));
    if (c.width !== px) {
      c.width = c.height = px;
      c.style.width = c.style.height = css + 'px';
    }
    c.getContext('2d').clearRect(0, 0, px, px);
    if (!view) return;
    if (view.phase === 'show' && view.outline) paint(c, view.outline, '#eef0ff', 0.02);
    if (view.phase === 'reveal') {
      if (view.outline) paint(c, alignTo(view.outline, view.strokes || []), '#eef0ff', 0.014, 0.35);
      paint(c, view.strokes || [], color, 0.02);
    }
    if (view.phase === 'draw') paint(c, strokes, color, 0.02);
  }

  // ---- drawing input -------------------------------------------------------

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
      pending = { type: 'draw', newStroke: true, pts: [] };
    } else if (!pending) {
      pending = { type: 'draw', newStroke: false, pts: [] };
    }
    pending.pts.push(x, y);
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0 || pending.pts.length >= 100) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function canDraw() {
    return view && view.phase === 'draw' && !view.done;
  }

  function at(e) {
    const r = els.canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  }

  function onDown(e) {
    e.preventDefault();
    if (!canDraw() || strokes.length >= MAX_STROKES || points >= MAX_POINTS) return;
    if (els.canvas.setPointerCapture) els.canvas.setPointerCapture(e.pointerId);
    drawing = true;
    const p = at(e);
    strokes.push(p.slice());
    points++;
    queuePoint(p[0], p[1], true);
    redraw();
  }

  function onMove(e) {
    if (!drawing || !canDraw() || points >= MAX_POINTS) return;
    const p = at(e);
    const s = strokes[strokes.length - 1];
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

  function onButton(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.classList.contains('rematch')) return api.send({ type: 'rematch' });
    if (!canDraw()) return;
    send();
    if (b.classList.contains('undo')) {
      const gone = strokes.pop();
      if (gone) points -= gone.length / 2;
      api.send({ type: 'undo' });
    } else if (b.classList.contains('clear')) {
      strokes = [];
      points = 0;
      api.send({ type: 'clear' });
    } else if (b.classList.contains('done')) {
      api.send({ type: 'done' });
      api.vibrate(20);
    }
    redraw();
  }

  // ---- view ----------------------------------------------------------------

  function prompt(v) {
    const you = v.you;
    if (v.phase === 'countdown') return '<div class="big">' + (v.countdown || '') + '</div>Get ready to memorise a shape!';
    if (v.phase === 'show') return '<strong>Memorise it!</strong> ' + Ark.escapeHtml(v.shapeName);
    if (v.phase === 'draw') {
      if (v.done) return 'Done! ' + (v.opponentDone ? 'Revealing…' : 'Waiting for your opponent…');
      return 'Draw the <strong>' + Ark.escapeHtml(v.shapeName) + '</strong> from memory' + (v.opponentDone ? ' · <strong>they\'re done!</strong>' : '');
    }
    if (v.phase === 'reveal') {
      const mine = v.accuracy[you];
      const theirs = v.accuracy[1 - you];
      const cls = mine > theirs ? 'won' : mine < theirs ? 'lost' : '';
      return '<span class="pct ' + cls + '">' + mine + '%</span> match · them ' + theirs + '%';
    }
    if (v.phase === 'over') {
      if (v.draw) return '<div class="outcome">Draw! 🤝</div>';
      return v.winner === you ? '<div class="outcome won">You win! 🏆</div>' : '<div class="outcome lost">You lose</div>';
    }
    return '';
  }

  function render(v) {
    if (v.round !== round) { // fresh canvas each round (and each rematch)
      strokes = [];
      points = 0;
      pending = null;
      round = v.round;
    }
    if (view && view.phase === 'draw' && v.phase === 'reveal') api.vibrate(40);
    view = v;
    const key = JSON.stringify([v.phase, v.round, v.countdown, v.done, v.opponentDone, v.accuracy, v.scores]);
    if (key !== textKey) {
      textKey = key;
      const you = v.you;
      els.score.textContent = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them' +
        (v.phase === 'countdown' || v.phase === 'over' ? '' : ' · Round ' + v.round + '/' + v.rounds);
      els.prompt.innerHTML = prompt(v);
      const drawingPhase = v.phase === 'draw';
      els.tools.classList.toggle('hidden', !drawingPhase);
      els.tools.querySelectorAll('button').forEach(function (b) { b.disabled = v.done; });
      els.pad.classList.toggle('hidden', v.phase === 'countdown' || v.phase === 'over');
      els.pad.classList.toggle('live', drawingPhase && !v.done);
      els.rematch.classList.toggle('hidden', v.phase !== 'over');
      if (!drawingPhase) drawing = false;
    }
    redraw();
  }

  function onResize() {
    if (view) redraw();
  }

  Ark.register('player', 'draw-duel', {
    mount: function (el, a) {
      api = a;
      color = getComputedStyle(document.body).getPropertyValue('--me').trim() || color;
      root = document.createElement('div');
      root.className = 'dd-phone';
      root.innerHTML =
        '<div class="score"></div>' +
        '<div class="prompt"></div>' +
        '<div class="dd-pad"><canvas></canvas></div>' +
        '<div class="dd-tools hidden"><button class="undo">↶ Undo</button><button class="clear">Clear</button><button class="primary done">Done ✓</button></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      els = {
        score: root.querySelector('.score'),
        prompt: root.querySelector('.prompt'),
        pad: root.querySelector('.dd-pad'),
        canvas: root.querySelector('canvas'),
        tools: root.querySelector('.dd-tools'),
        rematch: root.querySelector('.rematch'),
      };
      els.canvas.addEventListener('pointerdown', onDown);
      els.canvas.addEventListener('pointermove', onMove);
      els.canvas.addEventListener('pointerup', onUp);
      els.canvas.addEventListener('pointercancel', onUp);
      root.addEventListener('click', onButton);
      window.addEventListener('resize', onResize);
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      window.removeEventListener('resize', onResize);
      root = els = view = pending = null;
      strokes = [];
      points = 0;
      round = 0;
      drawing = false;
      textKey = '';
    },
  });
})();
