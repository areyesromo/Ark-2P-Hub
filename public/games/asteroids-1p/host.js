(function () {
  Ark.loadCss('/games/asteroids-1p/style.css');
  const MAX_EXTRAPOLATE_MS = 80; // views come ~30 times a second; move things on between them
  const DEADZONE = 0.3;

  let root = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let stats = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let statsKey = '';
  let overlayKey = '';
  let color = '#22d3ee';
  let booms = []; // { x, y, r, at } where a rock just broke, for a quick flash

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

  const wrap = function (v, max) { return ((v % max) + max) % max; };

  /** Draw something at x, y and again across any edge it overlaps, so it slides off one side onto the other. */
  function wrapped(f, x, y, r, fn) {
    const xs = [x];
    const ys = [y];
    if (x < r) xs.push(x + f.w);
    if (x > f.w - r) xs.push(x - f.w);
    if (y < r) ys.push(y + f.h);
    if (y > f.h - r) ys.push(y - f.h);
    xs.forEach(function (px) { ys.forEach(function (py) { fn(px, py); }); });
  }

  // The unlockable looks (see server/games/looks.js): the ship, facing right, r its size.
  // Their colours are the ships themselves.
  function drawShip(g, look, r, now) {
    g.lineWidth = 0.4;
    g.beginPath();
    if (look === 'rocket') {
      g.strokeStyle = '#f87171';
      g.moveTo(r * 1.5, 0);
      g.quadraticCurveTo(r * 0.8, -r * 0.6, -r * 0.8, -r * 0.5);
      g.lineTo(-r * 1.1, -r * 1);
      g.lineTo(-r * 0.8, 0);
      g.lineTo(-r * 1.1, r * 1);
      g.lineTo(-r * 0.8, r * 0.5);
      g.quadraticCurveTo(r * 0.8, r * 0.6, r * 1.5, 0);
      g.stroke();
      g.beginPath();
      g.arc(r * 0.4, 0, r * 0.22, 0, Math.PI * 2);
      g.strokeStyle = '#93c5fd';
      g.stroke();
      return;
    }
    if (look === 'saucer') {
      g.strokeStyle = '#a3e635';
      g.ellipse(0, 0, r * 1.3, r * 0.55, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      g.stroke();
      // A nose light, so you can see which way it points.
      g.fillStyle = Math.floor(now / 200) % 2 ? '#fde047' : '#a3e635';
      g.beginPath();
      g.arc(r * 1.3, 0, 0.35, 0, Math.PI * 2);
      g.fill();
      return;
    }
    g.strokeStyle = look === 'gold' ? '#facc15' : color;
    g.moveTo(r * 1.4, 0);
    g.lineTo(-r, -r * 0.9);
    g.lineTo(-r * 0.6, 0);
    g.lineTo(-r, r * 0.9);
    g.closePath();
    if (look === 'gold') {
      g.fillStyle = 'rgba(250, 204, 21, 0.35)';
      g.fill();
    }
    g.stroke();
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, f.w, f.h);
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    g.lineWidth = 0.35;
    g.lineJoin = 'round';

    // Rocks: lumpy outlines, the classic vector look.
    g.strokeStyle = '#cbd5e1';
    view.rocks.forEach(function (r) {
      const x = wrap(r.x + r.vx * dt, f.w);
      const y = wrap(r.y + r.vy * dt, f.h);
      const rot = r.rot + r.spin * dt;
      wrapped(f, x, y, r.r, function (px, py) {
        g.beginPath();
        r.shape.forEach(function (m, i) {
          const a = rot + (i / r.shape.length) * Math.PI * 2;
          const qx = px + Math.cos(a) * r.r * m;
          const qy = py + Math.sin(a) * r.r * m;
          if (i) g.lineTo(qx, qy);
          else g.moveTo(qx, qy);
        });
        g.closePath();
        g.stroke();
      });
    });

    g.fillStyle = '#fde68a';
    view.shots.forEach(function (b) {
      g.beginPath();
      g.arc(wrap(b.x + b.vx * dt, f.w), wrap(b.y + b.vy * dt, f.h), 0.45, 0, Math.PI * 2);
      g.fill();
    });

    booms = booms.filter(function (b) { return now - b.at < 300; });
    booms.forEach(function (b) {
      g.strokeStyle = 'rgba(253, 230, 138,' + (1 - (now - b.at) / 300) + ')';
      g.beginPath();
      g.arc(b.x, b.y, b.r * (0.6 + (now - b.at) / 300), 0, Math.PI * 2);
      g.stroke();
    });

    const s = view.ship;
    // Blinks while it's safe after coming back.
    if (s.alive && !(s.safe && Math.floor(now / 120) % 2)) {
      const x = wrap(s.x + s.vx * dt, f.w);
      const y = wrap(s.y + s.vy * dt, f.h);
      const a = s.a + s.rot * view.turn * dt;
      wrapped(f, x, y, s.r * 1.5, function (px, py) {
        g.save();
        g.translate(px, py);
        g.rotate(a);
        drawShip(g, view.look, s.r, now);
        if (s.thrust && Math.floor(now / 60) % 2) {
          g.strokeStyle = '#fb923c';
          g.beginPath();
          g.moveTo(-s.r * 0.75, -s.r * 0.4);
          g.lineTo(-s.r * 1.7, 0);
          g.lineTo(-s.r * 0.75, s.r * 0.4);
          g.stroke();
        }
        g.restore();
      });
    }
  }

  function render(v) {
    const key = v.score + '|' + v.lives + '|' + v.wave;
    if (key !== statsKey) {
      statsKey = key;
      stats.innerHTML =
        '<span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span>' +
        '<span>Ships <strong class="ships">' + new Array(Math.max(0, v.lives) + 1).join('▲ ') + '</strong></span>' +
        '<span>Wave <strong>' + v.wave + '</strong></span>';
    }
    let html = '';
    if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    else if (v.phase === 'play' && !v.ship.alive) html = '<div class="sub">Ship lost! Back in a moment…</div>';
    else if (v.phase === 'play' && !v.rocks.length) html = '<div class="big">Wave ' + (v.wave + 1) + '</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  Ark.register('host', 'asteroids-1p', {
    sounds: function (prev, v) {
      const out = [];
      if (v.shots.some(function (b) { return !prev.shots.some(function (p) { return p.id === b.id; }); })) out.push('shoot');
      if (v.score > prev.score) out.push('boom');
      if (v.lives < prev.lives) out.push('bigBoom');
      return out;
    },
    padHint: 'Stick / D-pad ←→ turn · ↑, B or RT thrust · A or X fire · Start pause',
    pad: function (btn) {
      if (btn === 'A' || btn === 'X') return { type: 'fire' };
      if (btn === 'START') return { type: 'pause' };
      return null;
    },
    padPoll: function (pad) {
      let x = pad.stick.x;
      x = Math.abs(x) < DEADZONE ? 0 : x;
      const held = function (b) { return pad.held.indexOf(b) !== -1; };
      const rot = held('LEFT') || x < 0 ? -1 : held('RIGHT') || x > 0 ? 1 : 0;
      return { type: 'ctl', rot: rot, thrust: held('UP') || held('B') || held('RT') };
    },
    overHtml: function (v) {
      return 'Reached wave ' + v.wave + ' · ' + v.kills + ' rocks blasted';
    },
    mount: function (el) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || color;
      root = document.createElement('div');
      root.className = 'asteroids-host';
      root.innerHTML = '<div class="asteroids-stats"></div><div class="asteroids-arena"><canvas></canvas><div class="asteroids-overlay"></div></div>';
      el.appendChild(root);
      stats = root.querySelector('.asteroids-stats');
      arena = root.querySelector('.asteroids-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.asteroids-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      // A rock that's gone (or split) since the last view: flash where it was.
      if (view && v.score > view.score) {
        view.rocks.forEach(function (r) {
          const still = v.rocks.some(function (n) { return Math.abs(n.x - r.x) < r.r && Math.abs(n.y - r.y) < r.r && n.r === r.r; });
          if (!still) booms.push({ x: r.x, y: r.y, r: r.r, at: performance.now() });
        });
      }
      view = v;
      viewAt = performance.now();
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = arena = canvas = overlay = stats = view = null;
      statsKey = overlayKey = '';
      booms = [];
    },
  });
})();
