(function () {
  Ark.loadCss('/games/mini-golf/style.css');
  const courseReady = Ark.loadScript('/games/mini-golf/course.js');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.25;

  let root = null;
  let top = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // eased ball positions actually drawn
  let loaded = false;
  let colors = null;
  let topKey = '';
  let overlayKey = '';
  const pads = {}; // controller players on the setup screen: slot -> { row }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function renderTop(v) {
    let html = '';
    if (v.phase !== 'setup' && loaded) {
      const title = v.hole ? 'Hole ' + v.holeNo + ' of ' + v.holeCount + ' · <strong>' + esc(v.hole.name) + '</strong> · Par ' + v.hole.par : '';
      html = '<div class="mg-title">' + title + '</div>' + ArkGolf.cardHtml(v, [nameOf(v, 0), nameOf(v, 1)]);
    }
    if (html === topKey) return;
    topKey = html;
    top.innerHTML = html;
  }

  function holeLine(v, slot) {
    const s = v.card[slot][v.holeNo - 1];
    return nameOf(v, slot) + ' <strong>' + (s > v.maxStrokes ? '–' : s) + '</strong> <span class="muted">' + ArkGolf.scoreName(s, v.hole.par, v.maxStrokes) + '</span>';
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'setup') {
      html = '<div class="panel"><div class="big-title">⛳ Mini Golf</div>' +
        Ark.setup.html(v, ArkGolf.ROWS, Ark.setup.focus(v, ArkGolf.ROWS, pads)) +
        '<div class="sub">Pick on your phone, or with a controller (←→). <strong>Start</strong> (or <strong>A</strong>) when you\'re both ready.<br>' +
        'Holes are drawn at random from the 15-hole course.</div></div>';
    } else if (v.phase === 'intro') {
      html = '<div class="panel small"><div class="big">' + (v.countdown || '') + '</div><div class="sub">Hole ' + v.holeNo + ': <strong>' + esc(v.hole.name) + '</strong> · Par ' + v.hole.par +
        '<br>Pull back on your phone and let go to putt. Water costs a stroke.</div></div>';
    } else if (v.phase === 'holeEnd') {
      html = '<div class="panel small"><div class="sub">' + holeLine(v, 0) + '<br>' + holeLine(v, 1) + '</div></div>';
    } else if (v.phase === 'over') {
      const t = v.scores;
      html = '<div class="panel"><div class="big-title">' + (v.draw ? '🤝 A tie!' : '🏆 ' + nameOf(v, v.winner) + ' wins!') + '</div>' +
        '<div class="sub">' + nameOf(v, 0) + ' <strong>' + t[0] + '</strong> strokes · ' + nameOf(v, 1) + ' <strong>' + t[1] + '</strong> strokes' +
        '<br>Rematch, change the holes (🎮 Y) or head back to the lobby from your phones or controllers.</div></div>';
    } else if (v.phase === 'play' && v.timeLeftMs < 15000) {
      html = '<div class="hurry">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's left on this hole</div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    overlay.innerHTML = html;
    overlay.className = 'mg-overlay' + (v.phase === 'play' ? ' playing' : '');
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view || !loaded || !view.hole || !colors) {
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const f = view.field;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / f.w, box.height / f.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(f.w * scale);
    const h = Math.floor(f.h * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    ArkGolf.drawHole(g, view, now);
    // Ease towards the newest positions, nudged along the velocity.
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, 60) / 1000 : 0;
    if (!shown) shown = view.balls.map(function (b) { return { x: b.x, y: b.y }; });
    view.balls.forEach(function (b, i) {
      const s = shown[i];
      s.x += (b.x + b.vx * dt - s.x) * 0.5;
      s.y += (b.y + b.vy * dt - s.y) * 0.5;
    });
    [0, 1].forEach(function (i) {
      const b = Object.assign({}, view.balls[i], shown[i]);
      if (view.phase === 'play' && !(view.balls[i].vx || view.balls[i].vy)) ArkGolf.drawAim(g, b, view.balls[i].aim, colors[i]);
    });
    [0, 1].forEach(function (i) { ArkGolf.drawBall(g, view, Object.assign({}, view.balls[i], shown[i]), colors[i], false); });
  }

  // Controllers: the stick (or D-pad ←→ to turn) aims, hold A to charge, let go to putt.
  function padPoll(pad, v) {
    if (v.phase !== 'play') return null;
    function dz(a) {
      return Math.abs(a) < DEADZONE ? 0 : Math.round(a * 10) / 10;
    }
    const held = pad.held;
    const turn = held.indexOf('LEFT') !== -1 ? -1 : held.indexOf('RIGHT') !== -1 ? 1 : held.indexOf('UP') !== -1 ? -1 : held.indexOf('DOWN') !== -1 ? 1 : 0;
    const charge = held.indexOf('A') !== -1 || held.indexOf('RT') !== -1;
    return { type: 'pad', x: dz(pad.stick.x), y: dz(pad.stick.y), turn: turn, charge: charge };
  }

  Ark.register('host', 'mini-golf', {
    // Sound: a click for each putt, knocks off walls and bumpers, a splash in water, a plop in the cup.
    sounds: function (prev, v) {
      const out = [];
      const a = prev.events;
      const b = v.events;
      if (!a || !b) return out;
      if (b.putts > a.putts) out.push('puck');
      if (b.walls > a.walls) out.push('wall');
      if (b.bumpers > a.bumpers) out.push('paddle');
      if (b.splashes > a.splashes) out.push('splash');
      if (b.sunk > a.sunk) out.push('drop');
      if (v.phase === 'holeEnd' && prev.phase !== 'holeEnd') out.push('reveal');
      return out;
    },
    padHint: 'Stick aims (or ←→ to turn) · hold A to charge, let go to putt · Setup: ←→ holes, A start · End: A rematch, Y change holes',
    padPoll: padPoll,
    pad: function (btn, v, slot) {
      if (v.phase === 'setup') {
        if (!pads[slot]) pads[slot] = { row: 0 };
        const input = Ark.setup.pad(btn, v, ArkGolf.ROWS, pads[slot]);
        if (view) renderOverlay(view);
        return input;
      }
      if (v.phase === 'over') {
        if (btn === 'A' || btn === 'START') return { type: 'rematch' };
        return btn === 'Y' ? { type: 'setup' } : null;
      }
      return null; // putting is read every frame by padPoll
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'mg-host';
      root.innerHTML = '<div class="mg-top"></div><div class="mg-arena"><canvas></canvas><div class="mg-overlay"></div></div>';
      el.appendChild(root);
      top = root.querySelector('.mg-top');
      arena = root.querySelector('.mg-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.mg-overlay');
      raf = requestAnimationFrame(draw);
      courseReady.then(function () {
        loaded = true;
        if (view) {
          topKey = overlayKey = '';
          renderTop(view);
          renderOverlay(view);
        }
      });
    },
    update: function (v) {
      if (!view || v.holeNo !== view.holeNo || !v.balls) shown = null; // a new hole: balls back on the tee
      view = v;
      viewAt = performance.now();
      if (!loaded) return;
      renderTop(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = top = arena = canvas = overlay = view = shown = null;
      topKey = overlayKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
