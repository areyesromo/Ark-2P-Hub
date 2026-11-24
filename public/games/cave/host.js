(function () {
  Ark.loadCss('/games/cave/style.css');
  const MAX_EXTRAPOLATE_MS = 80; // views come ~30 times a second; move things on between them
  const LIFT_BUTTONS = ['A', 'B', 'X', 'Y', 'UP', 'RT', 'LT', 'RB', 'LB'];
  const LIFT = -72; // matches the server's PHYS, for drawing between views
  const GRAVITY = 62;
  // Each map's look; the colours are the place itself. obstacle: how its rocks are drawn.
  const THEMES = {
    crystal: { bg: '#0b1020', far: 'rgba(74, 222, 128, 0.03)', rock: '#3f2d1f', edge: '#4ade80', obstacle: 'boulder' },
    mine: { bg: '#120d08', far: 'rgba(251, 191, 36, 0.05)', rock: '#2a1d12', edge: '#f59e0b', obstacle: 'beam' },
    ice: { bg: '#06142a', far: 'rgba(186, 230, 253, 0.05)', rock: '#1e3a5f', edge: '#e0f2fe', obstacle: 'icicle' },
    volcano: { bg: '#1a0505', far: 'rgba(239, 68, 68, 0.06)', rock: '#1c1917', edge: '#f97316', obstacle: 'lava' },
  };
  // What each vehicle leaves behind it.
  const TRAILS = { copter: [203, 213, 225], jet: [251, 146, 60], ufo: [103, 232, 249], dragon: [248, 113, 113] };

  let root = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let score = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let overlayKey = '';
  let held = false;
  const smoke = []; // { x, y, age } puffs behind the vehicle, drawn only

  function drawObstacle(g, kind, r, x, w) {
    const h = r.y1 - r.y0;
    if (kind === 'beam') {
      // A wooden prop: planks with dark seams.
      g.fillStyle = '#92400e';
      g.fillRect(x, r.y0, w, h);
      g.fillStyle = '#451a03';
      for (let y = r.y0 + 2.5; y < r.y1; y += 2.5) g.fillRect(x, y, w, 0.3);
      g.fillRect(x + w / 2 - 0.15, r.y0, 0.3, h);
    } else if (kind === 'icicle') {
      // Full width most of the way down, then a short point (the hit box is the whole rectangle).
      g.fillStyle = '#bae6fd';
      g.beginPath();
      g.moveTo(x, r.y0);
      g.lineTo(x + w, r.y0);
      g.lineTo(x + w, r.y1 - 1.5);
      g.lineTo(x + w / 2, r.y1);
      g.lineTo(x, r.y1 - 1.5);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255, 255, 255, 0.6)';
      g.fillRect(x + 0.6, r.y0, 0.5, h - 2);
    } else if (kind === 'lava') {
      g.fillStyle = '#7f1d1d';
      g.fillRect(x, r.y0, w, h);
      g.fillStyle = '#f97316';
      g.fillRect(x + 0.5, r.y0 + 0.5, w - 1, 0.6);
      g.fillRect(x + 0.5, r.y1 - 1.1, w - 1, 0.6);
    } else {
      g.fillStyle = '#57534e';
      g.fillRect(x, r.y0, w, h);
      g.strokeStyle = '#a8a29e';
      g.lineWidth = 0.5;
      g.strokeRect(x, r.y0, w, h);
    }
  }

  // The vehicles, drawn round (0, 0) facing right; r is the hit circle's radius.
  function drawVehicle(g, kind, r, now, rising) {
    if (kind === 'jet') {
      g.fillStyle = '#e5e7eb';
      g.beginPath(); // fuselage with a pointed nose
      g.moveTo(r * 2, 0);
      g.lineTo(r * 0.8, -r * 0.55);
      g.lineTo(-r * 1.6, -r * 0.45);
      g.lineTo(-r * 1.6, r * 0.45);
      g.lineTo(r * 0.8, r * 0.55);
      g.closePath();
      g.fill();
      g.fillStyle = '#3b82f6'; // swept wing and tail fin
      g.beginPath();
      g.moveTo(r * 0.3, 0);
      g.lineTo(-r * 0.8, r * 1.3);
      g.lineTo(-r * 0.4, 0);
      g.fill();
      g.beginPath();
      g.moveTo(-r * 1.1, -r * 0.4);
      g.lineTo(-r * 1.6, -r * 1.3);
      g.lineTo(-r * 1.6, -r * 0.4);
      g.fill();
      g.fillStyle = '#1e293b';
      g.fillRect(r * 0.6, -r * 0.35, r * 0.6, r * 0.3); // cockpit
      g.fillStyle = rising ? '#fde047' : '#fb923c'; // afterburner
      g.beginPath();
      g.moveTo(-r * 1.6, -r * 0.3);
      g.lineTo(-r * (rising ? 2.8 : 2.2), 0);
      g.lineTo(-r * 1.6, r * 0.3);
      g.fill();
    } else if (kind === 'ufo') {
      g.fillStyle = 'rgba(103, 232, 249, 0.5)'; // dome
      g.beginPath();
      g.ellipse(0, -r * 0.35, r * 0.75, r * 0.7, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = '#9ca3af'; // saucer
      g.beginPath();
      g.ellipse(0, 0, r * 1.7, r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = Math.floor(now / 150 + i) % 2 ? '#facc15' : '#f472b6';
        g.beginPath();
        g.arc(i * r * 0.6, r * 0.12, 0.3, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === 'dragon') {
      const flap = Math.sin(now / (rising ? 70 : 140));
      g.fillStyle = '#16a34a';
      g.beginPath(); // tail
      g.moveTo(-r * 0.8, 0);
      g.quadraticCurveTo(-r * 2, r * 0.2, -r * 2.6, -r * 0.4);
      g.lineTo(-r * 0.8, r * 0.4);
      g.fill();
      g.beginPath(); // body
      g.ellipse(0, 0, r * 1.2, r * 0.65, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath(); // head
      g.ellipse(r * 1.35, -r * 0.4, r * 0.55, r * 0.38, -0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#22c55e'; // wing, flapping
      g.beginPath();
      g.moveTo(-r * 0.4, -r * 0.3);
      g.lineTo(r * 0.1, -r * (0.4 + 1.3 * flap));
      g.lineTo(r * 0.6, -r * 0.3);
      g.fill();
      g.fillStyle = '#fde047';
      g.beginPath();
      g.arc(r * 1.5, -r * 0.5, 0.25, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = '#ef4444'; // body
      g.beginPath();
      g.ellipse(0, 0, r * 1.3, r * 0.9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-r * 3, -0.35, r * 2, 0.7); // tail
      g.fillStyle = '#93c5fd'; // window
      g.beginPath();
      g.ellipse(r * 0.55, -0.3, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e5e7eb'; // rotor, spinning
      const spin = Math.abs(Math.sin(now / 40));
      g.fillRect(-r * 1.8 * spin, -r - 0.5, r * 3.6 * spin, 0.35);
      g.fillRect(-0.15, -r - 0.5, 0.3, 0.6);
    }
  }

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

  // The colours here are the scene itself (see THEMES).
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

    const theme = THEMES[view.map] || THEMES.crystal;
    g.fillStyle = theme.bg;
    g.fillRect(0, 0, f.w, f.h);
    // Faint far wall, drifting slowly.
    g.fillStyle = theme.far;
    const far = ((view.distance + shift) * 0.3) % 30;
    for (let x = -far - 30; x < f.w + 30; x += 30) {
      g.beginPath();
      g.arc(x + 15, f.h / 2, 12, 0, Math.PI * 2);
      g.fill();
    }

    // The rock: one shape for the ceiling and one for the floor, along the columns.
    const cols = view.cols;
    const w = view.col;
    [[1, 0], [2, f.h]].forEach(function (side) {
      // Through the middle of each column, so the walls look smooth rather than stepped.
      g.fillStyle = theme.rock;
      g.beginPath();
      g.moveTo(cols[0][0] - shift, side[1]);
      cols.forEach(function (c) { g.lineTo(c[0] + w / 2 - shift, c[side[0]]); });
      g.lineTo(cols[cols.length - 1][0] + w - shift, side[1]);
      g.closePath();
      g.fill();
      g.strokeStyle = theme.edge;
      g.lineWidth = 0.5;
      g.beginPath();
      cols.forEach(function (c, i) { (i ? g.lineTo : g.moveTo).call(g, c[0] + w / 2 - shift, c[side[0]]); });
      g.stroke();
    });
    if (view.map === 'volcano') {
      // Lava glowing up from the floor.
      const glow = g.createLinearGradient(0, f.h - 8, 0, f.h);
      glow.addColorStop(0, 'rgba(249, 115, 22, 0)');
      glow.addColorStop(1, 'rgba(249, 115, 22, ' + (0.35 + 0.1 * Math.sin(now / 300)) + ')');
      g.fillStyle = glow;
      g.fillRect(0, f.h - 8, f.w, 8);
    }
    view.rocks.forEach(function (r) { drawObstacle(g, theme.obstacle, r, r.x - shift, view.rockW); });

    const c = view.copter;
    let y = view.phase === 'ready' ? c.y + Math.sin(now / 300) * 1 : c.y + (c.vy + ((view.holding ? LIFT : GRAVITY) * dt) / 2) * dt;
    y = Math.max(0, Math.min(f.h, y));
    const trail = TRAILS[view.vehicle] || TRAILS.copter;
    if (play && Math.random() < 0.5) smoke.push({ x: c.x - 3, y: y + 0.5, age: 0 });
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.age += 1 / 60;
      s.x -= (view.speed || 20) / 60;
      if (s.age > 0.6) smoke.splice(i, 1);
      else {
        g.fillStyle = 'rgba(' + trail.join(',') + ',' + (0.35 * (1 - s.age / 0.6)) + ')';
        g.beginPath();
        g.arc(s.x, s.y, 0.6 + s.age * 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tilt = view.phase === 'ready' ? 0 : Math.max(-0.35, Math.min(0.35, c.vy / 100));
    g.save();
    g.translate(c.x, y);
    g.rotate(view.vehicle === 'ufo' ? tilt / 3 : tilt); // a saucer stays level
    drawVehicle(g, view.vehicle, c.r, now, play && view.holding);
    g.restore();
  }

  function render(v) {
    score.textContent = v.score + ' m';
    let html = '';
    if (v.phase === 'ready') html = '<div class="big">Get ready</div><div class="sub">' + (v.player && v.player.local ? 'Hold A, ↑ or Space' : 'Hold your phone\'s button') + ' to climb, let go to drop</div>';
    else if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  Ark.register('host', 'cave', {
    // A run that earned a map or a vehicle says so.
    overHtml: function (v) {
      const got = (v.record && v.record.unlocked) || [];
      return got.filter(function (a) { return v.unlocks && v.unlocks[a.id]; }).map(function (a) { return '<strong>' + Ark.escapeHtml(v.unlocks[a.id]) + '</strong>'; }).join(' · ');
    },
    sounds: function (prev, v) {
      if (v.crashed && !prev.crashed) return ['crash'];
      if (Math.floor(v.score / 100) > Math.floor(prev.score / 100)) return ['point'];
      return [];
    },
    padHint: 'Hold A, ↑ or any face button: climb · Start / P: pause',
    pad: function (btn) {
      return btn === 'START' ? { type: 'pause' } : null;
    },
    // Climbing is held, so it's read every frame: on while any lift button is down.
    padPoll: function (pad) {
      const on = LIFT_BUTTONS.some(function (b) { return pad.held.indexOf(b) !== -1; }) || pad.stick.y < -0.6;
      if (on === held) return null;
      held = on;
      return { type: 'hold', on: on };
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'cave-host';
      root.innerHTML = '<div class="cave-arena"><canvas></canvas><div class="cave-score"></div><div class="cave-overlay"></div></div>';
      el.appendChild(root);
      arena = root.querySelector('.cave-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.cave-overlay');
      score = root.querySelector('.cave-score');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (v.phase === 'ready') held = false; // a new run starts with nothing held
      view = v;
      viewAt = performance.now();
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = arena = canvas = overlay = score = view = null;
      overlayKey = '';
      held = false;
      smoke.length = 0;
    },
  });
})();
