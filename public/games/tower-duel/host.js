// Tower Defence Duel on the TV (server/games/tower-duel.js): both roads side by side on one
// canvas (player 1 on the left), each with its towers, the creeps walking it (health bars,
// a blue ring while frozen), the shots, and the base at the end. Above each: lives, gold and
// income. A controller player has a cursor on their own side.
(function () {
  Ark.loadCss('/games/tower-duel/style.css');
  const esc = Ark.escapeHtml;
  const KINDS = ['arrow', 'cannon', 'frost'];
  const NAMES = { arrow: '🏹 Arrow', cannon: '💣 Cannon', frost: '❄️ Frost' };
  const SENDS = { X: 'runner', Y: 'brute', B: 'swarm' };
  const GAP = 1; // tiles between the two sides

  let root = null;
  let hud = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let colors = null;
  let hudKey = '';
  let overlayKey = '';
  let segs = null;
  let ground = null; // both sides' grass and road, drawn once per size: { key, canvas }
  let frames = 0;
  const pads = {}; // controller players: slot -> { x, y, kind }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function pointAt(d) {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (d <= s.len) return { x: s.a[0] + ((s.b[0] - s.a[0]) * d) / s.len, y: s.a[1] + ((s.b[1] - s.a[1]) * d) / s.len };
      d -= s.len;
    }
    const e = segs[segs.length - 1].b;
    return { x: e[0], y: e[1] };
  }

  function renderHud(v) {
    const side = function (slot) {
      const s = v.sides[slot];
      const pad = v.players[slot].local && pads[slot] ? '<div class="pad">🎮 ' + NAMES[pads[slot].kind] + ' (' + v.towers[pads[slot].kind].cost + ') · LB/RB change</div>' : '';
      return '<div class="td-side p' + (slot + 1) + '"><div class="name">' + nameOf(v, slot) + '</div>' +
        '<div class="stats"><span>❤️ ' + s.lives + '</span><span>💰 ' + s.gold + '</span><span class="inc">+' + s.income + ' / 5 s</span>' +
        (s.coming ? '<span class="coming">' + s.coming + ' coming</span>' : '') + '</div>' + pad + '</div>';
    };
    const html = side(0) + '<div class="td-mid">' + (v.phase === 'play' ? 'Wave ' + (v.wave + 1) + ' in ' + Math.ceil(v.nextWaveMs / 1000) + ' s' : '') + '</div>' + side(1);
    if (html === hudKey) return;
    hudKey = html;
    hud.innerHTML = html;
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'countdown') {
      html = '<div class="big">' + (v.countdown || '') + '</div><div class="sub">Build towers on your side · send creeps down theirs · ' + v.maxLives + ' lives each</div>';
    } else if (v.phase === 'over') {
      const sub = v.winner === null ? 'Both bases fell at once: a draw!' : nameOf(v, v.winner) + ' wins with ' + v.sides[v.winner].lives + ' ❤️ left!';
      html = '<div class="big">' + (v.winner === null ? '🤝' : '🏆') + '</div><div class="sub">' + sub + '<br>Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    overlay.innerHTML = html;
    overlay.classList.toggle('hidden', !html);
  }

  // ---- drawing (one unit = one tile) ----

  function drawGround(g, v, ox) {
    const W = v.grid.w;
    const H = v.grid.h;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        g.fillStyle = (x + y) % 2 ? '#3f7d3a' : '#467f3f';
        g.fillRect(ox + x, y, 1, 1);
      }
    }
    // The road.
    g.strokeStyle = '#a16207';
    g.lineWidth = 0.86;
    g.lineJoin = 'round';
    g.beginPath();
    v.path.forEach(function (p, i) { if (i) g.lineTo(ox + p[0], p[1]); else g.moveTo(ox + p[0], p[1]); });
    g.stroke();
    g.strokeStyle = '#ca8a04';
    g.lineWidth = 0.7;
    g.stroke();
  }

  function drawBase(g, v, ox, slot, lives) {
    const end = v.path[v.path.length - 1];
    const x = ox + end[0];
    const y = v.grid.h - 0.55;
    g.fillStyle = '#6b7280';
    g.fillRect(x - 0.7, y - 0.45, 1.4, 0.9);
    for (let i = 0; i < 3; i++) g.fillRect(x - 0.7 + i * 0.55, y - 0.65, 0.3, 0.25);
    g.fillStyle = colors[slot];
    g.fillRect(x - 0.15, y - 1.1, 0.04, 0.5);
    g.beginPath();
    g.moveTo(x - 0.11, y - 1.1);
    g.lineTo(x + 0.25, y - 0.98);
    g.lineTo(x - 0.11, y - 0.86);
    g.fill();
    g.fillStyle = lives <= 3 ? '#ef4444' : '#f8fafc';
    g.font = 'bold 0.4px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(lives), x, y + 0.05);
  }

  function drawTower(g, t, ox) {
    const x = ox + t.x + 0.5;
    const y = t.y + 0.5;
    g.fillStyle = '#374151';
    g.fillRect(x - 0.38, y - 0.38, 0.76, 0.76);
    if (t.kind === 'arrow') {
      g.fillStyle = '#92400e';
      g.beginPath();
      g.arc(x, y, 0.28, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fde68a';
      g.lineWidth = 0.06;
      g.beginPath();
      g.moveTo(x - 0.2, y + 0.2);
      g.lineTo(x + 0.2, y - 0.2);
      g.moveTo(x + 0.2, y - 0.2);
      g.lineTo(x + 0.08, y - 0.2);
      g.moveTo(x + 0.2, y - 0.2);
      g.lineTo(x + 0.2, y - 0.08);
      g.stroke();
    } else if (t.kind === 'cannon') {
      g.fillStyle = '#111827';
      g.beginPath();
      g.arc(x, y, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6b7280';
      g.fillRect(x - 0.08, y - 0.38, 0.16, 0.3);
    } else {
      g.fillStyle = '#7dd3fc';
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.lineTo(x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#e0f2fe';
      g.beginPath();
      g.arc(x, y, 0.12, 0, Math.PI * 2);
      g.fill();
    }
    // Level pips.
    for (let i = 0; i < t.level; i++) {
      g.fillStyle = '#facc15';
      g.beginPath();
      g.arc(x - 0.22 + i * 0.22, y + 0.3, 0.06, 0, Math.PI * 2);
      g.fill();
    }
  }

  const CREEP_LOOK = { runner: { r: 0.2, fill: '#f97316' }, brute: { r: 0.32, fill: '#7f1d1d' }, swarm: { r: 0.13, fill: '#a855f7' } };

  function drawCreep(g, c, ox, dt, end) {
    const d = Math.min(end, c.d + c.speed * (c.slow ? 0.5 : 1) * dt);
    const p = pointAt(d);
    const look = CREEP_LOOK[c.kind];
    g.fillStyle = look.fill;
    g.beginPath();
    g.arc(ox + p.x, p.y, look.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 0.04;
    g.stroke();
    if (c.slow) {
      g.strokeStyle = '#7dd3fc';
      g.lineWidth = 0.06;
      g.beginPath();
      g.arc(ox + p.x, p.y, look.r + 0.08, 0, Math.PI * 2);
      g.stroke();
    }
    if (c.hp < c.max) {
      g.fillStyle = '#111827';
      g.fillRect(ox + p.x - 0.25, p.y - look.r - 0.16, 0.5, 0.07);
      g.fillStyle = c.hp / c.max > 0.4 ? '#22c55e' : '#ef4444';
      g.fillRect(ox + p.x - 0.25, p.y - look.r - 0.16, (0.5 * c.hp) / c.max, 0.07);
    }
  }

  function drawShot(g, s, ox) {
    g.strokeStyle = s.kind === 'frost' ? '#7dd3fc' : s.kind === 'cannon' ? '#f97316' : '#fde68a';
    g.lineWidth = s.kind === 'cannon' ? 0.1 : 0.05;
    g.beginPath();
    g.moveTo(ox + s.from[0], s.from[1]);
    g.lineTo(ox + s.to[0], s.to[1]);
    g.stroke();
    if (s.kind === 'cannon') {
      g.fillStyle = 'rgba(249, 115, 22, 0.35)';
      g.beginPath();
      g.arc(ox + s.to[0], s.to[1], 0.9, 0, Math.PI * 2);
      g.fill();
    }
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    const v = view;
    if (!v || !canvas || !colors) return;
    const W = v.grid.w * 2 + GAP;
    const H = v.grid.h;
    if (frames++ % 30 === 0 || !canvas.width) {
      const box = canvas.parentNode.getBoundingClientRect();
      const scale = Math.min(box.width / W, box.height / H);
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(W * scale);
      const h = Math.floor(H * scale);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      }
    }
    if (!segs) {
      segs = v.path.slice(1).map(function (b, i) { const a = v.path[i]; return { a: a, b: b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
    }
    const end = segs.reduce(function (s, x) { return s + x.len; }, 0);
    const k = canvas.width / W;
    const g = canvas.getContext('2d');
    const key = canvas.width + 'x' + canvas.height;
    if (!ground || ground.key !== key) {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      const gg = c.getContext('2d');
      gg.setTransform(k, 0, 0, k, 0, 0);
      drawGround(gg, v, 0);
      drawGround(gg, v, v.grid.w + GAP);
      ground = { key: key, canvas: c };
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(ground.canvas, 0, 0);
    g.setTransform(k, 0, 0, k, 0, 0);
    const dt = v.phase === 'play' ? Math.min(performance.now() - viewAt, 150) / 1000 : 0;
    v.sides.forEach(function (s, slot) {
      const ox = slot * (v.grid.w + GAP);
      s.towers.forEach(function (t) { drawTower(g, t, ox); });
      s.creeps.forEach(function (c) { drawCreep(g, c, ox, dt, end); });
      s.shots.forEach(function (x) { drawShot(g, x, ox); });
      drawBase(g, v, ox, slot, s.lives);
      // A controller player's cursor.
      const p = pads[slot];
      if (p && v.players[slot].local && v.phase === 'play') {
        g.strokeStyle = colors[slot];
        g.lineWidth = 0.08;
        g.strokeRect(ox + p.x + 0.04, p.y + 0.04, 0.92, 0.92);
        const t = s.towers.find(function (x) { return x.x === p.x && x.y === p.y; });
        const range = v.towers[t ? t.kind : p.kind].range[t ? t.level - 1 : 0];
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 0.04;
        g.beginPath();
        g.arc(ox + p.x + 0.5, p.y + 0.5, range, 0, Math.PI * 2);
        g.stroke();
      }
    });
  }

  function cursor(slot, v) {
    if (!pads[slot]) pads[slot] = { x: Math.floor(v.grid.w / 2), y: Math.floor(v.grid.h / 2), kind: 'arrow' };
    return pads[slot];
  }

  Ark.register('host', 'tower-duel', {
    sounds: function (prev, v) {
      const a = prev.events;
      const b = v.events;
      const out = [];
      if (prev.phase === 'countdown' && v.phase === 'play') out.push('go');
      if (!a || !b) return out;
      if (b.leaks > a.leaks) out.push('wrong');
      if (b.kills > a.kills) out.push('tick');
      if (b.builds > a.builds) out.push('lock');
      if (b.sends > a.sends) out.push('whoosh');
      if (b.waves > a.waves) out.push('reveal');
      return out;
    },
    padHint: 'D-pad moves your cursor · LB / RB tower type · A build or upgrade · LT sell · X Runner, Y Brute, B Swarm (send) · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play') return null;
      const p = cursor(slot, v);
      const moves = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] };
      if (moves[btn]) {
        p.x = Math.max(0, Math.min(v.grid.w - 1, p.x + moves[btn][0]));
        p.y = Math.max(0, Math.min(v.grid.h - 1, p.y + moves[btn][1]));
        return null;
      }
      if (btn === 'LB' || btn === 'RB') {
        p.kind = KINDS[(KINDS.indexOf(p.kind) + (btn === 'RB' ? 1 : KINDS.length - 1)) % KINDS.length];
        hudKey = '';
        renderHud(v);
        return null;
      }
      if (SENDS[btn]) return { type: 'send', kind: SENDS[btn] };
      const here = v.sides[slot].towers.some(function (t) { return t.x === p.x && t.y === p.y; });
      if (btn === 'A') return here ? { type: 'upgrade', x: p.x, y: p.y } : { type: 'build', x: p.x, y: p.y, kind: p.kind };
      if (btn === 'LT' && here) return { type: 'sell', x: p.x, y: p.y };
      return null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'td-host';
      root.innerHTML = '<div class="td-hud"></div><div class="td-field"><canvas></canvas><div class="td-over hidden"></div></div>';
      el.appendChild(root);
      hud = root.querySelector('.td-hud');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.td-over');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      renderHud(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = hud = canvas = overlay = view = segs = ground = null;
      hudKey = overlayKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
