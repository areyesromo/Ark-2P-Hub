(function () {
  Ark.loadCss('/games/snake-1p/style.css');
  // Controller / keyboard: D-pad, stick or arrows steer; the face buttons work as a diamond too.
  const PAD_DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right', Y: 'up', A: 'down', X: 'left', B: 'right' };
  const EYES = { up: [[-0.18, -0.15], [0.18, -0.15]], down: [[-0.18, 0.15], [0.18, 0.15]], left: [[-0.15, -0.18], [-0.15, 0.18]], right: [[0.15, -0.18], [0.15, 0.18]] };

  let root = null;
  let stats = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let overlayKey = '';
  let statsKey = '';
  let color = '#22d3ee';
  // The unlockable looks (see server/games/looks.js): a colour per segment (0 is the head).
  // These colours are the snake itself.
  const LOOKS = {
    classic: { glow: 10, colour: function () { return color; } },
    rainbow: { glow: 10, colour: function (i, now) { return 'hsl(' + Math.round((i * 24 + now / 12) % 360) + ', 90%, 60%)'; } },
    neon: { glow: 22, colour: function (i) { return i % 2 ? '#c026d3' : '#e879f9'; } },
    gold: { glow: 14, colour: function (i) { return i % 3 === 1 ? '#ca8a04' : '#facc15'; } },
  };

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Eat the food to grow · don\'t hit ' + (v.wrap ? 'your own tail' : 'the walls or your tail');
    } else if (v.phase === 'paused') {
      big = '⏸';
      sub = 'Paused · press pause again to carry on';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  function renderStats(v) {
    const key = v.score + '|' + v.body.length + '|' + v.cps;
    if (key === statsKey) return;
    statsKey = key;
    stats.innerHTML =
      '<span>Score <strong>' + v.score + '</strong></span>' +
      '<span>Length <strong>' + v.body.length + '</strong></span>' +
      '<span>Speed <strong>' + v.cps + '</strong></span>';
  }

  function resize() {
    const g = view.grid;
    const box = arena.getBoundingClientRect();
    const scale = Math.floor(Math.min(box.width / g.w, box.height / g.h));
    const dpr = window.devicePixelRatio || 1;
    const w = g.w * scale;
    const h = g.h * scale;
    if (canvas.width !== Math.floor(w * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  function roundCell(g, x, y, inset, r) {
    const s = 1 - 2 * inset;
    g.beginPath();
    g.moveTo(x + inset + r, y + inset);
    g.arcTo(x + inset + s, y + inset, x + inset + s, y + inset + s, r);
    g.arcTo(x + inset + s, y + inset + s, x + inset, y + inset + s, r);
    g.arcTo(x + inset, y + inset + s, x + inset, y + inset, r);
    g.arcTo(x + inset, y + inset, x + inset + s, y + inset, r);
    g.closePath();
    g.fill();
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const grid = view.grid;
    const g = canvas.getContext('2d');
    const k = canvas.width / grid.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, grid.w, grid.h);

    // Faint checkerboard
    g.fillStyle = 'rgba(80,110,200,0.05)';
    for (let y = 0; y < grid.h; y++) for (let x = (y % 2); x < grid.w; x += 2) g.fillRect(x, y, 1, 1);

    // Food: a pulsing orange glow
    if (view.food) {
      const pulse = 0.32 + 0.05 * Math.sin((now || 0) / 180);
      g.fillStyle = g.shadowColor = '#fb923c';
      g.shadowBlur = 16;
      g.beginPath();
      g.arc(view.food[0] + 0.5, view.food[1] + 0.5, pulse, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }

    const body = view.body;
    const look = LOOKS[view.look] || LOOKS.classic;
    g.shadowBlur = look.glow;
    for (let i = body.length - 1; i >= 1; i--) {
      g.fillStyle = g.shadowColor = look.colour(i, now || 0);
      g.globalAlpha = 0.55 + 0.45 * (1 - i / body.length); // the tail fades a little
      roundCell(g, body[i][0], body[i][1], 0.08, 0.22);
    }
    g.globalAlpha = 1;
    const h = body[0];
    g.fillStyle = g.shadowColor = look.colour(0, now || 0);
    roundCell(g, h[0], h[1], 0.02, 0.3);
    g.shadowBlur = 0;
    if (view.look === 'neon') {
      // A bright line down the middle of each segment.
      g.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < body.length; i++) roundCell(g, body[i][0], body[i][1], 0.38, 0.1);
    } else if (view.look === 'gold') {
      // A glint that runs along the body.
      const at = Math.floor((now || 0) / 90) % (body.length + 6);
      if (body[at]) {
        g.fillStyle = 'rgba(255, 255, 255, 0.75)';
        roundCell(g, body[at][0], body[at][1], 0.3, 0.2);
      }
    }
    // Eyes looking the way it's heading
    g.fillStyle = '#05070f';
    EYES[view.dir].forEach(function (e) {
      g.beginPath();
      g.arc(h[0] + 0.5 + e[0], h[1] + 0.5 + e[1], 0.1, 0, Math.PI * 2);
      g.fill();
    });
    if (view.crashed) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.shadowColor = color;
      g.shadowBlur = 40;
      g.beginPath();
      g.arc(h[0] + 0.5, h[1] + 0.5, 0.9, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }

  Ark.register('host', 'snake-1p', {
    // Sound: a blip on each bite, a crash at the end.
    sounds: function (prev, v) {
      const out = [];
      if (v.score > prev.score) out.push('eat');
      if (v.crashed && !prev.crashed) out.push('crash');
      return out;
    },
    padHint: 'D-pad, stick or arrows to steer · Start / P: pause',
    pad: function (btn) {
      if (btn === 'START') return { type: 'pause' };
      return PAD_DIRS[btn] ? { type: 'turn', dir: PAD_DIRS[btn] } : null;
    },
    overHtml: function (v) {
      return 'Length ' + v.body.length + (v.crashed ? '' : ' · you filled the board!');
    },
    mount: function (el) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || color;
      root = document.createElement('div');
      root.className = 'snk1-host';
      root.innerHTML = '<div class="snk1-stats"></div><div class="snk1-arena"><canvas></canvas><div class="snk1-overlay"></div></div>';
      el.appendChild(root);
      stats = root.querySelector('.snk1-stats');
      arena = root.querySelector('.snk1-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.snk1-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      canvas.classList.toggle('wrap', Boolean(v.wrap));
      renderStats(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = stats = arena = canvas = overlay = view = null;
      overlayKey = statsKey = '';
    },
  });
})();
