(function () {
  Ark.loadCss('/games/mini-golf/style.css');
  const courseReady = Ark.loadScript('/games/mini-golf/course.js');
  const MARGIN = 0.4; // course units around the course on the phone
  const PULL_PX = 170; // dragging this far back is a full-power putt
  const AIM_EVERY_MS = 90; // how often the aim is sent to the TV while pulling back

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let viewAt = 0;
  let loaded = false;
  let raf = null;
  let colors = null;
  let shown = null;
  let drag = null; // { x0, y0, angle, power } while pulling back
  let lastAimSent = 0;
  let textKey = '';

  // The phone shows the course upright: course +x runs up the screen, +y to the right.
  function scaleK() {
    return canvasCssWidth() / (view.field.h + 2 * MARGIN);
  }

  function canvasCssWidth() {
    return els.canvas.getBoundingClientRect().width;
  }

  function myBall() {
    return view && view.balls ? view.balls[view.you] : null;
  }

  function canPutt() {
    const b = myBall();
    return view.phase === 'play' && b && !b.done && !(b.vx || b.vy);
  }

  /** Pulling back: the shot goes the opposite way to the drag, harder the further you pull. */
  function aimFrom(e) {
    const dX = e.clientX - drag.x0;
    const dY = e.clientY - drag.y0;
    const k = scaleK();
    // Screen drag -> course vector (screen right = +y, screen up = +x).
    const cx = -dY / k;
    const cy = dX / k;
    drag.angle = Math.atan2(-cy, -cx);
    drag.power = Math.min(1, Math.hypot(dX, dY) / PULL_PX);
  }

  function sendAim(force) {
    const now = Date.now();
    if (!force && now - lastAimSent < AIM_EVERY_MS) return;
    lastAimSent = now;
    api.send({ type: 'aim', angle: Math.round(drag.angle * 1000) / 1000, power: Math.round(drag.power * 100) / 100 });
  }

  function onDown(e) {
    if (!view || !canPutt()) return;
    e.preventDefault();
    if (els.pad.setPointerCapture) els.pad.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, angle: 0, power: 0 };
  }

  function onMove(e) {
    if (!drag) return;
    aimFrom(e);
    sendAim(false);
  }

  function onUp(e) {
    if (!drag) return;
    if (e.type === 'pointerup') aimFrom(e);
    const d = drag;
    drag = null;
    if (e.type === 'pointerup' && d.power >= 0.05 && canPutt()) {
      api.send({ type: 'shoot', angle: d.angle, power: d.power });
      api.vibrate(25);
    } else {
      api.send({ type: 'aim', angle: d.angle, power: 0 }); // let go without pulling: cancelled
    }
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view || !loaded || !view.hole || !colors) {
      els.canvas.getContext('2d').clearRect(0, 0, els.canvas.width, els.canvas.height);
      return;
    }
    const f = view.field;
    const totalW = f.h + 2 * MARGIN;
    const totalH = f.w + 2 * MARGIN;
    const box = els.pad.getBoundingClientRect();
    const scale = Math.min(box.width / totalW, box.height / totalH);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(totalW * scale);
    const h = Math.floor(totalH * scale);
    if (els.canvas.width !== Math.floor(w * dpr) || els.canvas.height !== Math.floor(h * dpr)) {
      els.canvas.width = Math.floor(w * dpr);
      els.canvas.height = Math.floor(h * dpr);
      els.canvas.style.width = w + 'px';
      els.canvas.style.height = h + 'px';
    }
    const g = els.canvas.getContext('2d');
    const k = els.canvas.width / totalW;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, els.canvas.width, els.canvas.height);
    // course (x, y) -> canvas ((y + M) k, (W + M - x) k)
    g.setTransform(0, -k, k, 0, MARGIN * k, (f.w + MARGIN) * k);
    ArkGolf.drawHole(g, view, now);
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, 60) / 1000 : 0;
    if (!shown) shown = view.balls.map(function (b) { return { x: b.x, y: b.y }; });
    view.balls.forEach(function (b, i) {
      shown[i].x += (b.x + b.vx * dt - shown[i].x) * 0.5;
      shown[i].y += (b.y + b.vy * dt - shown[i].y) * 0.5;
    });
    const me = view.you;
    const other = 1 - me;
    ArkGolf.drawBall(g, view, Object.assign({}, view.balls[other], shown[other]), colors[other], false);
    if (canPutt()) {
      const aim = drag ? { angle: drag.angle, power: drag.power } : view.balls[me].aim;
      ArkGolf.drawAim(g, Object.assign({}, view.balls[me], shown[me]), aim, colors[me]);
    }
    ArkGolf.drawBall(g, view, Object.assign({}, view.balls[me], shown[me]), colors[me], true);
    els.power.style.width = drag ? Math.round(drag.power * 100) + '%' : '0%';
  }

  function status(v) {
    const me = v.you;
    if (v.phase === 'setup') return '<span class="big">⛳ Mini Golf</span><br>Pick how many holes (either of you can), then start.';
    if (v.phase === 'over') {
      const t = v.scores;
      const line = 'You ' + t[me] + ' strokes · them ' + t[1 - me];
      if (v.draw) return '<span class="big">A tie! 🤝</span><br>' + line;
      return '<span class="big ' + (v.winner === me ? 'won' : 'lost') + '">' + (v.winner === me ? 'You win! 🏆' : 'You lose') + '</span><br>' + line;
    }
    const b = v.balls[me];
    const head = 'Hole ' + v.holeNo + '/' + v.holeCount + ' · ' + v.hole.name + ' · par ' + v.hole.par;
    if (v.phase === 'intro') return head + '<br><span class="big">' + (v.countdown || '') + '</span>';
    if (v.phase === 'holeEnd') {
      const s = v.card[me][v.holeNo - 1];
      return head + '<br><strong>' + (s > v.maxStrokes ? 'Picked up' : s + ' stroke' + (s === 1 ? '' : 's')) + '</strong> · ' + ArkGolf.scoreName(s, v.hole.par, v.maxStrokes);
    }
    let line;
    if (b.holed) line = '<span class="won">In the hole in ' + b.strokes + '! 🎉</span> Waiting for them…';
    else if (b.done) line = 'Picked up after ' + v.maxStrokes + '. Waiting for them…';
    else if (b.vx || b.vy) line = 'Rolling…';
    else line = 'Stroke ' + (b.strokes + 1) + ': pull back anywhere, let go to putt';
    return head + '<br>' + line + (v.timeLeftMs < 15000 ? ' · <span class="lost">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '');
  }

  function render(v) {
    if (!view || v.holeNo !== view.holeNo || !v.balls) shown = null;
    view = v;
    viewAt = performance.now();
    if (!canPutt()) drag = null;
    const b = v.balls && v.balls[v.you];
    const key = JSON.stringify([v.phase, v.holeNo, v.countdown, v.settings, v.card, b && [b.strokes, b.holed, b.done, Boolean(b.vx || b.vy)], v.timeLeftMs < 15000 && Math.ceil(v.timeLeftMs / 1000), loaded]);
    if (key === textKey) return;
    textKey = key;
    els.status.innerHTML = loaded ? status(v) : '';
    const t = v.card.map(function (c) { return c.reduce(function (s, x) { return s + x; }, 0); });
    els.score.textContent = v.phase === 'setup' || !v.card[0].length ? '' : 'Strokes: you ' + t[v.you] + ' · them ' + t[1 - v.you];
    els.setup.innerHTML = v.phase === 'setup' && loaded ? Ark.setup.html(v, ArkGolf.ROWS) : '';
    els.go.classList.toggle('hidden', v.phase !== 'setup');
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    els.change.classList.toggle('hidden', v.phase !== 'over');
    els.pad.classList.toggle('hidden', v.phase === 'setup');
  }

  Ark.register('player', 'mini-golf', {
    // Setup and the end screen are menus: pinch zoom stays on.
    zoomable: function (v) { return v.phase === 'setup' || v.phase === 'over'; },
    mount: function (el, a) {
      api = a;
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'mg-phone';
      root.innerHTML =
        '<div class="score"></div>' +
        '<div class="status"></div>' +
        '<div class="mg-setup-box"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="mg-pad"><canvas></canvas></div>' +
        '<div class="mg-power"><div class="fill"></div></div>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change holes</button>';
      el.appendChild(root);
      els = {
        score: root.querySelector('.score'),
        status: root.querySelector('.status'),
        setup: root.querySelector('.mg-setup-box'),
        go: root.querySelector('.go'),
        pad: root.querySelector('.mg-pad'),
        canvas: root.querySelector('canvas'),
        power: root.querySelector('.mg-power .fill'),
        rematch: root.querySelector('.rematch'),
        change: root.querySelector('.change'),
      };
      els.pad.addEventListener('pointerdown', onDown);
      els.pad.addEventListener('pointermove', onMove);
      els.pad.addEventListener('pointerup', onUp);
      els.pad.addEventListener('pointercancel', onUp);
      Ark.setup.bind(els.setup, api);
      els.go.addEventListener('click', function () { api.send({ type: 'go' }); });
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      els.change.addEventListener('click', function () { api.send({ type: 'setup' }); });
      raf = requestAnimationFrame(draw);
      courseReady.then(function () {
        loaded = true;
        if (view) {
          textKey = '';
          render(view);
        }
      });
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      root = els = view = shown = drag = null;
      textKey = '';
    },
  });
})();
