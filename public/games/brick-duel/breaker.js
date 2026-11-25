// Brick Breaker, the 1 player mode of Brick Breaker Duel (view.solo): the TV's and the phone's screens.
// The game's own renderers hand over to these (window.ArkBreaker.host / .player).
(function () {

  // ---- the TV ----
  const host = (function () {

    const DEADZONE = 0.15;
    const MAX_EXTRAPOLATE_MS = 80; // views come ~30 times a second; move the ball on between them
    // Brick colours by row, top to bottom: the classic arcade rainbow.
    const ROWS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];

    let root = null;
    let stats = null;
    let arena = null;
    let canvas = null;
    let overlay = null;
    let raf = null;
    let view = null;
    let viewAt = 0;
    let statsKey = '';
    let overlayKey = '';
    let color = '#22d3ee';
    // The unlockable looks (see server/games/looks.js): the paddle, the ball and its trail.
    // These colours are the paddle and ball themselves.
    const LOOKS = {
      classic: { paddle: function () { return color; }, ball: function () { return '#fff'; }, trail: 0 },
      fire: { paddle: function () { return '#f97316'; }, ball: function () { return '#fde047'; }, trail: 8, trailColour: function (i) { return 'hsl(' + (40 - i * 4) + ', 95%, 55%)'; } },
      crystal: { paddle: function () { return '#a5f3fc'; }, ball: function () { return '#e0f2fe'; }, trail: 6, trailColour: function () { return '#67e8f9'; }, edge: '#fff' },
      rainbow: { paddle: function (now) { return 'hsl(' + Math.round(now / 8) % 360 + ', 90%, 60%)'; }, ball: function () { return '#fff'; }, trail: 10, trailColour: function (i, now) { return 'hsl(' + Math.round(now / 8 + i * 30) % 360 + ', 90%, 60%)'; } },
    };
    const trail = []; // where the ball has been lately, newest first (drawn only)

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

    function draw(now) {
      raf = requestAnimationFrame(draw);
      now = now || 0;
      if (!view) return;
      resize();
      const f = view.field;
      const g = canvas.getContext('2d');
      const k = canvas.width / f.w;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, f.w, f.h);

      view.bricks.forEach(function (b) {
        if (!b) return;
        g.fillStyle = ROWS[b[4] % ROWS.length];
        g.fillRect(b[0], b[1], b[2], b[3]);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(b[0], b[1], b[2], b[3] * 0.3);
      });

      const look = LOOKS[view.look] || LOOKS.classic;
      const p = view.paddle;
      g.fillStyle = g.shadowColor = look.paddle(now);
      g.shadowBlur = 3;
      g.beginPath();
      if (g.roundRect) g.roundRect(p.x - p.w / 2, p.y, p.w, p.h, p.h / 2);
      else g.rect(p.x - p.w / 2, p.y, p.w, p.h);
      g.fill();
      if (look.edge) {
        g.strokeStyle = look.edge;
        g.lineWidth = 0.25;
        g.stroke();
      }

      const b = view.ball;
      const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
      if (view.phase !== 'lost' && view.phase !== 'over') {
        const x = b.x + b.vx * dt;
        const y = b.y + b.vy * dt;
        if (look.trail) {
          trail.unshift([x, y]);
          trail.length = Math.min(trail.length, look.trail);
          g.shadowBlur = 0;
          for (let i = trail.length - 1; i >= 1; i--) {
            g.globalAlpha = 0.5 * (1 - i / trail.length);
            g.fillStyle = look.trailColour(i, now);
            g.beginPath();
            g.arc(trail[i][0], trail[i][1], b.r * (1 - i / (trail.length + 2)), 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
        }
        g.fillStyle = g.shadowColor = look.ball(now);
        g.shadowBlur = 4;
        g.beginPath();
        g.arc(x, y, b.r, 0, Math.PI * 2);
        g.fill();
      } else trail.length = 0;
      g.shadowBlur = 0;
    }

    function render(v) {
      const left = v.bricks.filter(Boolean).length;
      const s = '<span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span>' +
        '<span>Level <strong>' + v.level + '</strong></span>' +
        '<span>Lives <strong class="lives">' + new Array(v.lives + 1).join('● ') + '</strong></span>' +
        '<span>Bricks <strong>' + left + '</strong></span>';
      if (s !== statsKey) {
        statsKey = s;
        stats.innerHTML = s;
      }
      let big = '';
      let sub = '';
      if (v.phase === 'serve') sub = v.player && v.player.local ? 'A / Enter to launch' : 'Tap Launch on your phone (or wait)';
      else if (v.phase === 'lost') big = 'Ball lost!';
      else if (v.phase === 'cleared') { big = 'Level ' + v.level + ' cleared!'; sub = 'Next level: a bit faster, and a life back'; }
      else if (v.phase === 'paused') { big = '⏸'; sub = 'Paused'; }
      const key = big + '|' + sub;
      if (key !== overlayKey) {
        overlayKey = key;
        overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
      }
    }


    return {
      sounds: function (prev, v) {
        const out = [];
        const before = prev.bricks.filter(Boolean).length;
        if (v.bricks.length === prev.bricks.length && v.bricks.filter(Boolean).length < before) out.push('brick');
        if (v.lives < prev.lives) out.push('life');
        if (v.phase === 'cleared' && prev.phase !== 'cleared') out.push('correct');
        // The ball turned upwards near the paddle: it was hit.
        if (prev.ball.vy > 0 && v.ball.vy < 0 && v.ball.y > v.paddle.y - 6) out.push('paddle');
        return out;
      },
      padHint: 'Stick, D-pad or arrows move · A / Enter launch · Start / P pause',
      pad: function (btn) {
        if (btn === 'A') return { type: 'launch' };
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
        return 'Reached level ' + v.level;
      },
      mount: function (el) {
        color = getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || color;
        root = document.createElement('div');
        root.className = 'breaker-host';
        root.innerHTML = '<div class="breaker-stats"></div><div class="breaker-arena"><canvas></canvas><div class="breaker-overlay"></div></div>';
        el.appendChild(root);
        stats = root.querySelector('.breaker-stats');
        arena = root.querySelector('.breaker-arena');
        canvas = root.querySelector('canvas');
        overlay = root.querySelector('.breaker-overlay');
        raf = requestAnimationFrame(draw);
      },
      update: function (v) {
        view = v;
        viewAt = performance.now();
        render(v);
      },
      unmount: function () {
        cancelAnimationFrame(raf);
        root = stats = arena = canvas = overlay = view = null;
        statsKey = overlayKey = '';
      },
};
  })();

  // ---- the phone ----
  const player = (function () {

    const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

    let root = null;
    let strip = null;
    let knob = null;
    let info = null;
    let launchBtn = null;
    let pauseBtn = null;
    let api = null;
    let lastKey = '';
    let lastSent = 0;
    let pendingX = null;
    let sendTimer = null;
    let prevLives = null;

    function send() {
      sendTimer = null;
      if (pendingX === null) return;
      api.send({ type: 'aim', x: pendingX });
      lastSent = Date.now();
      pendingX = null;
    }

    // Follow the finger: the paddle moves to where you touch (0 = left, 1 = right).
    function onPointer(e) {
      if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
      e.preventDefault();
      // Keep following the finger even if it slides off the strip.
      if (e.type === 'pointerdown' && strip.setPointerCapture) strip.setPointerCapture(e.pointerId);
      const r = strip.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      knob.style.left = x * 100 + '%';
      pendingX = Math.round(x * 1000) / 1000;
      const wait = SEND_EVERY_MS - (Date.now() - lastSent);
      if (wait <= 0) send();
      else if (!sendTimer) sendTimer = setTimeout(send, wait);
    }

    function render(v) {
      if (prevLives !== null && v.lives < prevLives) api.vibrate(150);
      prevLives = v.lives;
      const key = [v.phase, v.score, v.level, v.lives, v.bricksLeft, v.best].join('|');
      if (key === lastKey) return; // views arrive ~30 times a second: only touch the DOM on change
      lastKey = key;
      info.innerHTML =
        '<div class="score">Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts')) + '</div>' +
        '<div class="status">Level ' + v.level + ' · ' + new Array(v.lives + 1).join('● ') + ' · ' + v.bricksLeft + ' bricks</div>';
      launchBtn.classList.toggle('hidden', v.phase !== 'serve');
      pauseBtn.textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
      pauseBtn.disabled = v.phase !== 'play' && v.phase !== 'serve' && v.phase !== 'paused';
    }


    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'breaker-phone';
        root.innerHTML =
          '<div class="info"></div>' +
          '<button class="primary launch hidden">🚀 Launch</button>' +
          '<div class="breaker-strip"><div class="knob"></div><div class="hint">Slide left and right</div></div>' +
          '<button class="ghost pause">⏸ Pause</button>';
        el.appendChild(root);
        info = root.querySelector('.info');
        strip = root.querySelector('.breaker-strip');
        knob = root.querySelector('.knob');
        launchBtn = root.querySelector('.launch');
        pauseBtn = root.querySelector('.pause');
        strip.addEventListener('pointerdown', onPointer);
        strip.addEventListener('pointermove', onPointer);
        launchBtn.addEventListener('click', function () { api.send({ type: 'launch' }); api.vibrate(20); });
        pauseBtn.addEventListener('click', function () { api.send({ type: 'pause' }); });
      },
      update: render,
      unmount: function () {
        clearTimeout(sendTimer);
        root = strip = knob = info = launchBtn = pauseBtn = null;
        lastKey = '';
        pendingX = null;
        prevLives = null;
      },
};
  })();

  window.ArkBreaker = { host: host, player: player };
})();
