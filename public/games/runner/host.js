(function () {
  Ark.loadCss('/games/runner/style.css');
  const MAX_EXTRAPOLATE_MS = 80; // views come ~30 times a second; move things on between them
  const JUMP = ['A', 'UP', 'B', 'X', 'Y', 'RT', 'RB'];
  const DUCK = ['DOWN', 'LT', 'LB'];

  let root = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let score = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let overlayKey = '';
  let color = '#22d3ee';
  const held = { jump: false, duck: false }; // what a controller last sent

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

  // The desert: sand, cactuses and birds are the scene's own colours.
  // The unlockable looks (see server/games/looks.js): the runner's colour. These colours are the runner.
  const LOOK_COLOURS = { robot: '#94a3b8', dino: '#22c55e', ninja: '#334155' };

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
    const shift = view.speed * dt;
    const ground = f.ground;

    // Ground with dashes running past.
    g.fillStyle = '#c2a36b';
    g.fillRect(0, ground, f.w, 0.5);
    g.fillStyle = 'rgba(194, 163, 107, 0.5)';
    const off = (view.distance + shift) % 7;
    for (let x = -off; x < f.w; x += 7) g.fillRect(x, ground + 1.5, 2, 0.3);
    for (let x = -((view.distance + shift) * 0.6) % 13; x < f.w; x += 13) g.fillRect(x + 4, ground + 3, 1, 0.3);

    view.obstacles.forEach(function (o) {
      const x = o.x - shift;
      if (o.kind === 'cactus') {
        g.fillStyle = '#16a34a';
        const each = o.w / o.n;
        for (let i = 0; i < o.n; i++) {
          const cx = x + i * each + each * 0.3;
          const w = each * 0.4;
          g.fillRect(cx, ground - o.h, w, o.h);
          g.fillRect(cx - w * 0.7, ground - o.h * 0.65, w * 0.5, o.h * 0.3);
          g.fillRect(cx + w * 1.2, ground - o.h * 0.75, w * 0.5, o.h * 0.35);
        }
      } else {
        const wing = Math.floor(now / 160) % 2 ? -1 : 1;
        g.fillStyle = '#e2e8f0';
        const y = ground - o.y - o.h;
        g.fillRect(x, y + o.h * 0.4, o.w, o.h * 0.35);
        g.beginPath();
        g.moveTo(x + o.w * 0.3, y + o.h * 0.5);
        g.lineTo(x + o.w * 0.55, y + o.h * 0.5 + wing * o.h * 0.7);
        g.lineTo(x + o.w * 0.75, y + o.h * 0.5);
        g.fill();
        g.fillStyle = '#fb923c';
        g.fillRect(x - 0.8, y + o.h * 0.45, 0.9, 0.5);
      }
    });

    const r = view.runner;
    let y = r.y;
    if (view.phase === 'play' && (r.y > 0 || r.vy > 0)) y = Math.max(0, r.y + r.vy * dt - (view.gravity * dt * dt) / 2);
    const top = ground - y - r.h;
    const look = view.look || 'runner';
    const body = LOOK_COLOURS[look] || color;
    g.fillStyle = g.shadowColor = body;
    g.shadowBlur = 2;
    g.fillRect(r.x, top + (r.ducking ? 0.6 : 1.8), r.w, r.h - (r.ducking ? 1.4 : 3));
    if (r.ducking) g.fillRect(r.x + r.w * 0.6, top, r.w * 0.6, 1.6);
    else g.fillRect(r.x + r.w * 0.25, top, r.w * 0.7, 1.9);
    // The head's top-left corner, for the eye and each look's extras.
    const hx = r.x + r.w * (r.ducking ? 0.6 : 0.25);
    const hw = r.w * (r.ducking ? 0.6 : 0.7);
    g.fillStyle = look === 'robot' ? '#ef4444' : '#05070f';
    g.fillRect(r.x + r.w * (r.ducking ? 0.95 : 0.7), top + 0.5, 0.45, 0.45);
    if (look === 'robot') {
      g.fillStyle = '#cbd5e1'; // antenna with a blinking light
      g.fillRect(hx + hw / 2 - 0.1, top - 0.9, 0.2, 0.9);
      g.fillStyle = Math.floor(now / 300) % 2 ? '#ef4444' : '#fca5a5';
      g.fillRect(hx + hw / 2 - 0.3, top - 1.3, 0.6, 0.5);
    } else if (look === 'dino') {
      g.fillStyle = '#15803d'; // spikes down the back, and a tail
      for (let k = 0; k < 3; k++) g.fillRect(r.x - 0.1 + k * 0.7, top + 1.4 + k * 0.5, 0.5, 0.5);
      g.fillStyle = body;
      g.fillRect(r.x - 1.2, top + (r.ducking ? 1.2 : 3), 1.3, 0.7);
    } else if (look === 'ninja') {
      g.fillStyle = '#dc2626'; // a headband with its ends flying behind
      g.fillRect(hx, top + 0.15, hw, 0.35);
      const flap = Math.sin(now / 80) * 0.3;
      g.fillRect(hx - 1.1, top + 0.1 + flap, 1.1, 0.25);
      g.fillRect(hx - 0.9, top + 0.45 - flap, 0.9, 0.25);
    }
    g.fillStyle = body;
    // Legs: running in step on the ground, tucked in the air.
    const step = view.phase === 'play' && y === 0 ? Math.floor(now / 90) % 2 : 2;
    const legY = ground - y - 1.3;
    if (step === 2) g.fillRect(r.x + 0.6, legY, r.w - 1.2, 1);
    else {
      g.fillRect(r.x + (step ? 0.4 : 1.6), legY, 0.7, 1.3);
      g.fillRect(r.x + (step ? 2.4 : 1.1), legY, 0.7, 1.3);
    }
    g.shadowBlur = 0;
    if (view.crashed) {
      g.font = '4px sans-serif';
      g.fillText('💥', r.x + r.w - 1, top + 1);
    }
  }

  function render(v) {
    score.textContent = v.score + ' m';
    let html = '';
    if (v.phase === 'ready') html = '<div class="big">Ready?</div><div class="sub">' + (v.player && v.player.local ? 'A or ↑ jumps · ↓ ducks' : 'Tap JUMP on your phone') + ' to start</div>';
    else if (v.phase === 'paused') html = '<div class="big">⏸</div><div class="sub">Paused</div>';
    if (html !== overlayKey) {
      overlayKey = html;
      overlay.innerHTML = html;
    }
  }

  Ark.register('host', 'runner', {
    sounds: function (prev, v) {
      const out = [];
      if (v.jumps > prev.jumps) out.push('whoosh');
      if (Math.floor(v.score / 100) > Math.floor(prev.score / 100)) out.push('point');
      if (v.crashed && !prev.crashed) out.push('crash');
      return out;
    },
    padHint: 'A or ↑ jump (hold for higher) · ↓ duck · Start / P pause',
    pad: function (btn) {
      return btn === 'START' ? { type: 'pause' } : null;
    },
    // Jump and duck are held: send each one's change (one per frame; the other follows next frame).
    padPoll: function (pad) {
      const has = function (list) { return list.some(function (b) { return pad.held.indexOf(b) !== -1; }); };
      const jump = has(JUMP);
      const duck = has(DUCK) || pad.stick.y > 0.6;
      if (jump !== held.jump) {
        held.jump = jump;
        return { type: 'jump', on: jump };
      }
      if (duck !== held.duck) {
        held.duck = duck;
        return { type: 'duck', on: duck };
      }
      return null;
    },
    overHtml: function (v) {
      return v.dodged + ' obstacles cleared · ' + v.jumps + ' jumps';
    },
    mount: function (el) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || color;
      root = document.createElement('div');
      root.className = 'runner-host';
      root.innerHTML = '<div class="runner-arena"><canvas></canvas><div class="runner-score"></div><div class="runner-overlay"></div></div>';
      el.appendChild(root);
      arena = root.querySelector('.runner-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.runner-overlay');
      score = root.querySelector('.runner-score');
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
      held.jump = held.duck = false;
    },
  });
})();
