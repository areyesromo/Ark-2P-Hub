(function () {
  Ark.loadCss('/games/flappy/style.css');
  const MAX_EXTRAPOLATE_MS = 80; // views come ~30 times a second; move things on between them
  const FLAP_BUTTONS = ['A', 'B', 'X', 'Y', 'UP', 'RT', 'LT', 'RB', 'LB'];

  let root = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let score = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let overlayKey = '';

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

  // The colours here are the scene itself: sky, green pipes, a yellow bird.
  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    const play = view.phase === 'play';
    const dt = play ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    const shift = view.speed * dt;

    const sky = g.createLinearGradient(0, 0, 0, f.h);
    sky.addColorStop(0, '#0e1a3a');
    sky.addColorStop(1, '#1e3a5f');
    g.fillStyle = sky;
    g.fillRect(0, 0, f.w, f.h);

    // Far-off hills drifting slowly, for a sense of speed.
    g.fillStyle = 'rgba(56, 189, 248, 0.08)';
    const hills = ((view.distance + shift) * 0.25) % 40;
    for (let x = -hills - 40; x < f.w + 40; x += 40) {
      g.beginPath();
      g.arc(x + 20, f.h + 4, 22, Math.PI, 0);
      g.fill();
    }

    view.pipes.forEach(function (p) {
      const x = p.x - shift;
      const top = p.gapY - p.gap / 2;
      const bottom = p.gapY + p.gap / 2;
      g.fillStyle = '#16a34a';
      g.fillRect(x, 0, view.pipeW, top);
      g.fillRect(x, bottom, view.pipeW, f.h - bottom);
      g.fillStyle = '#22c55e';
      g.fillRect(x - 0.8, top - 2.5, view.pipeW + 1.6, 2.5);
      g.fillRect(x - 0.8, bottom, view.pipeW + 1.6, 2.5);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(x + 1, 0, 1.2, top - 2.5);
      g.fillRect(x + 1, bottom + 2.5, 1.2, f.h - bottom);
    });

    const b = view.bird;
    // Bob gently while waiting for the first flap.
    let y = view.phase === 'ready' ? b.y + Math.sin(now / 250) * 1.2 : b.y + (b.vy + (view.gravity * dt) / 2) * dt;
    y = Math.max(b.r, Math.min(f.h - b.r, y));
    const tilt = view.phase === 'ready' ? 0 : Math.max(-0.5, Math.min(1.2, b.vy / 60));
    g.save();
    g.translate(b.x, y);
    g.rotate(tilt);
    drawFlyer(g, view.look, b.r, now, play && b.vy < 0);
    g.restore();
  }

  // The flyers (see server/games/looks.js), round (0, 0) facing right; r is the hit circle's radius.
  // Their colours are the creatures themselves.
  function drawFlyer(g, look, r, now, flapping) {
    const blob = function (fill, x, yy, rx, ry) {
      g.fillStyle = fill;
      g.beginPath();
      g.ellipse(x, yy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };
    const eye = function (x, yy) {
      blob('#fff', x, yy, 0.7, 0.7);
      blob('#05070f', x + 0.15, yy, 0.35, 0.35);
    };
    if (look === 'bat') {
      const up = flapping ? -1.6 : 0.6 + Math.sin(now / 90) * 0.4;
      g.fillStyle = '#4c1d95'; // wings
      [-1, 1].forEach(function (side) {
        g.beginPath();
        g.moveTo(side * r * 0.3, 0);
        g.lineTo(side * r * 1.9, up);
        g.lineTo(side * r * 1.3, r * 0.5);
        g.lineTo(side * r * 0.9, r * 0.2);
        g.closePath();
        g.fill();
      });
      blob('#6d28d9', 0, 0, r * 0.9, r * 0.85);
      g.fillStyle = '#6d28d9'; // ears
      g.beginPath();
      g.moveTo(-r * 0.6, -r * 0.6); g.lineTo(-r * 0.3, -r * 1.3); g.lineTo(0, -r * 0.7);
      g.moveTo(r * 0.1, -r * 0.7); g.lineTo(r * 0.5, -r * 1.3); g.lineTo(r * 0.7, -r * 0.5);
      g.fill();
      blob('#fde047', r * 0.35, -r * 0.2, 0.35, 0.35);
      return;
    }
    if (look === 'penguin') {
      blob('#111827', 0, 0, r * 1.15, r);
      blob('#f9fafb', r * 0.25, r * 0.15, r * 0.75, r * 0.7);
      g.fillStyle = '#111827'; // flipper
      g.beginPath();
      g.ellipse(-r * 0.4, r * 0.2, r * 0.5, r * 0.22, flapping ? -0.9 : 0.5, 0, Math.PI * 2);
      g.fill();
      eye(r * 0.55, -r * 0.4);
      g.fillStyle = '#fb923c';
      g.beginPath();
      g.moveTo(r * 1.05, -r * 0.2); g.lineTo(r * 1.05 + 1.3, 0.1); g.lineTo(r * 1.05, r * 0.25);
      g.fill();
      return;
    }
    if (look === 'dragon') {
      const flap = flapping ? -1 : Math.sin(now / 120);
      g.fillStyle = '#16a34a';
      g.beginPath(); // tail
      g.moveTo(-r * 0.8, 0);
      g.quadraticCurveTo(-r * 1.8, r * 0.3, -r * 2.3, -r * 0.3);
      g.lineTo(-r * 0.8, r * 0.4);
      g.fill();
      blob('#16a34a', 0, 0, r * 1.15, r * 0.75);
      blob('#16a34a', r * 1.1, -r * 0.45, r * 0.55, r * 0.42);
      g.fillStyle = '#22c55e'; // wing
      g.beginPath();
      g.moveTo(-r * 0.5, -r * 0.3);
      g.lineTo(0, -r * (0.5 + 1.2 * flap));
      g.lineTo(r * 0.5, -r * 0.3);
      g.fill();
      blob('#fde047', r * 1.3, -r * 0.55, 0.3, 0.3);
      if (flapping) blob('rgba(251, 146, 60, 0.8)', r * 1.9, -r * 0.4, 0.6, 0.35); // a puff of fire
      return;
    }
    blob('#facc15', 0, 0, r * 1.2, r);
    blob('#fde68a', -0.6, 0.4 + (flapping ? -0.6 : 0.3), r * 0.6, r * 0.35); // wing
    eye(r * 0.55, -r * 0.35);
    g.fillStyle = '#fb923c'; // beak
    g.beginPath();
    g.moveTo(r * 1.1, -0.2);
    g.lineTo(r * 1.1 + 1.4, 0.3);
    g.lineTo(r * 1.1, 0.8);
    g.fill();
  }

  function render(v) {
    score.textContent = v.score;
    let html = '';
    if (v.phase === 'ready') html = '<div class="big">Get ready</div><div class="sub">' + (v.player && v.player.local ? 'A, ↑ or Space' : 'Tap your phone') + ' to flap</div>';
    else if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  Ark.register('host', 'flappy', {
    sounds: function (prev, v) {
      const out = [];
      if (v.score > prev.score) out.push('point');
      if (v.crashed && !prev.crashed) out.push('crash');
      if (v.phase === 'play' && v.bird.vy < 0 && prev.bird.vy >= 0) out.push('whoosh');
      return out;
    },
    padHint: 'A, ↑ or any face button: flap · Start / P: pause',
    pad: function (btn) {
      if (btn === 'START') return { type: 'pause' };
      return FLAP_BUTTONS.indexOf(btn) !== -1 ? { type: 'flap' } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'flappy-host';
      root.innerHTML = '<div class="flappy-arena"><canvas></canvas><div class="flappy-score"></div><div class="flappy-overlay"></div></div>';
      el.appendChild(root);
      arena = root.querySelector('.flappy-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.flappy-overlay');
      score = root.querySelector('.flappy-score');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = arena = canvas = overlay = score = view = null;
      overlayKey = '';
    },
  });
})();
