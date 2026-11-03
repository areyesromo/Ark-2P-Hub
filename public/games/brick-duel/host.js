// Brick Breaker Duel on the TV (server/games/brick-duel.js): both walls side by side on one
// canvas. Views come ~30 times a second; balls are carried on between them. Power bricks are
// drawn with a mark (no emoji on the canvas): a bar for shrink, a dot for an extra ball, stripes
// for an added row.
(function () {
  Ark.loadCss('/games/brick-duel/style.css');
  // The bricks are drawn by a helper shared with the other screen; if it fails to load, try again.
  let bricksLoading = null;
  function needBricks() {
    if (window.ArkBricks || bricksLoading) return false;
    bricksLoading = Ark.loadScript('/games/brick-duel/bricks.js').catch(function () { bricksLoading = null; });
    return true;
  }
  needBricks();
  const esc = Ark.escapeHtml;
  const MAX_EXTRAPOLATE_MS = 50; // views come every ~33 ms: carry a ball on no further than that, roughly
  const DEADZONE = 0.2;
  const GAP = 0.6; // between the two fields
  const POWER_TEXT = {
    shrink: function (a, b) { return a + ' shrank ' + b + '\'s paddle!'; },
    multi: function (a) { return a + ' got an extra ball!'; },
    rows: function (a, b) { return a + ' added a row to ' + b + '\'s wall!'; },
  };

  let root = null;
  let top = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let flash = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // smoothed paddle positions
  let overlayKey = '';
  let topKey = '';
  let powerN = undefined;
  let colors = null;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function renderTop(v) {
    const t = v.suddenDeath ? 'Sudden death: next brick wins!' : v.timeLeft === null ? '' : Math.floor(v.timeLeft / 60) + ':' + String(v.timeLeft % 60).padStart(2, '0');
    const key = v.sides.map(function (s) { return s.broken + '/' + s.bricks.length; }).join('|') + t + v.players.map(function (p) { return p.name; }).join('|');
    if (key === topKey) return;
    topKey = key;
    top.innerHTML = [0, 1].map(function (s) {
      return '<div class="who">' + nameOf(v, s) + ' <span class="n">🧱 ' + v.sides[s].broken + '</span> <span class="left">' + v.sides[s].bricks.length + ' left</span></div>';
    }).join('<div class="clock' + (v.suddenDeath ? ' sudden' : '') + '">' + t + '</div>');
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Break your wall first!';
    } else if (v.phase === 'over') {
      big = '🏆';
      sub = (v.winner === null ? 'A draw!' : nameOf(v, v.winner) + ' wins!') +
        '<br>Rematch or head back to the lobby from your phones or controllers.';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  /** A short line when a power brick breaks (not on the first view after joining). */
  function renderPower(v) {
    const n = v.power ? v.power.n : null;
    if (powerN !== undefined && n !== null && n !== powerN) {
      flash.innerHTML = POWER_TEXT[v.power.kind](nameOf(v, v.power.by), nameOf(v, 1 - v.power.by));
      flash.classList.remove('show');
      void flash.offsetWidth; // restart the fade
      flash.classList.add('show');
    }
    powerN = n;
  }

  function resize() {
    const f = view.field;
    const W = f.w * 2 + GAP;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / W, box.height / f.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(W * scale);
    const h = Math.floor(f.h * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!view || !window.ArkBricks) return void needBricks();
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / (f.w * 2 + GAP);
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    if (!shown) shown = view.sides.map(function (s) { return s.paddle; });
    view.sides.forEach(function (side, slot) {
      g.setTransform(k, 0, 0, k, slot * (f.w + GAP) * k, 0);
      g.fillStyle = '#0b1020';
      g.fillRect(0, 0, f.w, f.h);
      side.bricks.forEach(function (b) { window.ArkBricks.drawBrick(g, f, b); });
      shown[slot] += (side.paddle - shown[slot]) * 0.5;
      g.fillStyle = colors[slot];
      g.fillRect(shown[slot] - side.paddleW / 2, f.paddleY, side.paddleW, f.paddleH);
      g.fillStyle = '#ffffff';
      side.balls.forEach(function (b) {
        const x = b.held ? shown[slot] : Math.min(f.w - f.ballR, Math.max(f.ballR, b.x + b.vx * dt));
        const y = b.held ? b.y : Math.min(f.h, Math.max(f.ballR, b.y + b.vy * dt));
        g.beginPath();
        g.arc(x, y, f.ballR, 0, Math.PI * 2);
        g.fill();
      });
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  Ark.register('host', 'brick-duel', {
    sounds: function (prev, v) {
      if (prev.phase !== 'play' || v.phase !== 'play') return [];
      const out = [];
      if (v.sides.some(function (s, i) { return s.broken > prev.sides[i].broken; })) out.push('point');
      if (v.power && !(prev.power && prev.power.n === v.power.n)) out.push('whoosh');
      return out;
    },
    padHint: 'Left stick or D-pad ← → to move your paddle · A: rematch at the end',
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    padPoll: function (pad) {
      let v = pad.stick.x;
      v = Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
      if (pad.held.indexOf('LEFT') !== -1) v = -1;
      if (pad.held.indexOf('RIGHT') !== -1) v = 1;
      return { type: 'axis', v: Math.round(v * 10) / 10 };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'bd-host';
      root.innerHTML = '<div class="bd-top"></div><div class="bd-arena"><canvas></canvas><div class="bd-overlay"></div><div class="bd-flash"></div></div>';
      el.appendChild(root);
      top = root.querySelector('.bd-top');
      arena = root.querySelector('.bd-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.bd-overlay');
      flash = root.querySelector('.bd-flash');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (view && v.phase === 'countdown' && view.phase !== 'countdown') shown = null; // rematch
      view = v;
      viewAt = performance.now();
      renderTop(v);
      renderOverlay(v);
      renderPower(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = top = arena = canvas = overlay = flash = view = shown = null;
      overlayKey = topKey = '';
      powerN = undefined;
    },
  });
})();
