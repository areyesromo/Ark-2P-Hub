// Kitchen Rush on the TV (server/games/kitchen-rush.js): the kitchen from above on a canvas (all
// drawn shapes: crates, boards, stoves, the food in its raw / chopped / cooked / burnt states),
// the two chefs in your colours with what they carry and the tile they're facing outlined, and
// the order tickets along the top with their timers.
(function () {
  Ark.loadCss('/games/kitchen-rush/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.25;
  // Order tickets: the dish, and what goes on the plate.
  const DISH = { plain: '🍔', lettuce: '🍔', works: '🍔', salad: '🥗' };
  const DISH_NAME = { plain: 'Burger', lettuce: 'Lettuce burger', works: 'The works', salad: 'Salad' };
  const ICON = { bun: '🍞', meat: '🥩', lettuce: '🥬', tomato: '🍅' };

  let root = null;
  let top = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // eased chef positions
  let colors = null;
  let topKey = '';
  let floor = null; // the kitchen drawn once: { key, canvas }
  let frames = 0;
  let overlayKey = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  /** The tickets are rebuilt only when an order comes or goes; their timers move in place. */
  function renderTop(v) {
    const ids = v.orders.map(function (o) { return o.id; }).join(',');
    if (ids !== topKey) {
      topKey = ids;
      top.querySelector('.kr-orders').innerHTML = v.orders.map(function (o) {
        return '<div class="kr-ticket" data-id="' + o.id + '"><div class="dish">' + DISH[o.recipe] + '</div>' +
          '<div class="what"><b>' + DISH_NAME[o.recipe] + '</b><span>' + o.needs.map(function (n) { return ICON[n]; }).join(' ') + '</span></div>' +
          '<div class="time"><i></i></div></div>';
      }).join('') || '<div class="kr-none">No orders right now</div>';
    }
    v.orders.forEach(function (o, i) {
      const t = top.querySelectorAll('.kr-ticket')[i];
      if (!t) return;
      t.querySelector('.time i').style.width = Math.round(o.left * 100) + '%';
      t.classList.toggle('late', o.left < 0.25);
    });
    const score = '<div class="coins">💰 ' + v.coins + '</div><div class="clock">' + clock(v.timeLeftMs) + '</div><div class="stars">' +
      v.targets.map(function (t) { return '<span class="' + (v.coins >= t ? 'on' : '') + '">⭐<small>' + t + '</small></span>'; }).join('') + '</div>';
    const box = top.querySelector('.kr-score');
    if (box.innerHTML !== score) box.innerHTML = score;
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'countdown') {
      html = '<div class="big">' + (v.countdown || '') + '</div><div class="sub">' + esc(v.kitchen) + ' · ' + v.minutes + ' minute shift · serve the orders before they run out</div>';
    } else if (v.phase === 'over') {
      html = '<div class="big">' + (v.stars ? '⭐'.repeat(v.stars) : '🍳') + '</div><div class="sub">Shift over! <strong>' + v.coins + ' 💰</strong> · ' + v.served + ' served · ' + v.missed + ' missed' +
        '<br>' + nameOf(v, 0) + ' & ' + nameOf(v, 1) + ', rematch or head back to the lobby from your phones or controllers.</div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    overlay.innerHTML = html;
    overlay.classList.toggle('hidden', !html);
  }

  // ---- drawing (one unit = one tile) ----

  function circle(g, x, y, r, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /** One food item or plate, centred on (x, y), about `s` across. */
  function food(g, item, x, y, s) {
    const k = item.kind;
    if (k === 'plate') {
      circle(g, x, y, s * 0.48, '#e5e7eb');
      circle(g, x, y, s * 0.36, '#f8fafc');
      const n = item.contents.length;
      item.contents.forEach(function (c, i) {
        const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        food(g, { kind: c, state: c === 'meat' ? 'cooked' : c === 'bun' ? 'raw' : 'chopped' }, x + (n > 1 ? Math.cos(a) * s * 0.17 : 0), y + (n > 1 ? Math.sin(a) * s * 0.17 : 0), s * 0.42);
      });
      return;
    }
    if (k === 'bun') {
      g.fillStyle = '#d97706';
      g.beginPath();
      g.ellipse(x, y, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      circle(g, x - s * 0.12, y - s * 0.08, s * 0.04, '#fef3c7');
      circle(g, x + s * 0.1, y - s * 0.1, s * 0.04, '#fef3c7');
      return;
    }
    if (k === 'meat') {
      const fill = item.state === 'raw' ? '#f87171' : item.state === 'cooked' ? '#7c2d12' : '#111827';
      g.fillStyle = fill;
      g.beginPath();
      g.ellipse(x, y, s * 0.4, s * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      if (item.state === 'cooked') {
        g.strokeStyle = '#451a03';
        g.lineWidth = s * 0.05;
        g.beginPath();
        g.moveTo(x - s * 0.2, y - s * 0.08);
        g.lineTo(x + s * 0.2, y - s * 0.08);
        g.moveTo(x - s * 0.2, y + s * 0.08);
        g.lineTo(x + s * 0.2, y + s * 0.08);
        g.stroke();
      }
      return;
    }
    const colour = k === 'tomato' ? '#ef4444' : '#22c55e';
    if (item.state === 'chopped') {
      // Chopped: little pieces.
      [[-0.18, -0.12], [0.16, -0.14], [-0.1, 0.16], [0.18, 0.12], [0, 0]].forEach(function (p) {
        circle(g, x + p[0] * s, y + p[1] * s, s * 0.12, colour);
      });
      return;
    }
    circle(g, x, y, s * 0.36, colour);
    if (k === 'tomato') circle(g, x, y - s * 0.3, s * 0.08, '#15803d');
    else {
      g.strokeStyle = '#14532d';
      g.lineWidth = s * 0.05;
      g.beginPath();
      g.moveTo(x, y - s * 0.3);
      g.lineTo(x, y + s * 0.3);
      g.stroke();
    }
  }

  /** A ring filling up (chopping, cooking). */
  function ring(g, x, y, frac, colour) {
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 0.1;
    g.beginPath();
    g.arc(x, y, 0.42, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = colour;
    g.beginPath();
    g.arc(x, y, 0.42, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    g.stroke();
  }

  const CRATE = { B: 'bun', M: 'meat', T: 'tomato', L: 'lettuce' };

  function drawTile(g, ch, x, y) {
    if (ch === ' ') {
      g.fillStyle = (x + y) % 2 ? '#e7e5e4' : '#d6d3d1';
      g.fillRect(x, y, 1, 1);
      return;
    }
    // Counters: a wooden top with an edge.
    g.fillStyle = '#78716c';
    g.fillRect(x, y, 1, 1);
    g.fillStyle = '#a8a29e';
    g.fillRect(x + 0.05, y + 0.05, 0.9, 0.9);
    if (CRATE[ch]) {
      g.fillStyle = '#92400e';
      g.fillRect(x + 0.1, y + 0.1, 0.8, 0.8);
      g.strokeStyle = '#78350f';
      g.lineWidth = 0.05;
      g.strokeRect(x + 0.1, y + 0.1, 0.8, 0.8);
      food(g, { kind: CRATE[ch], state: 'raw' }, x + 0.5, y + 0.5, 0.75);
    } else if (ch === 'C') {
      g.fillStyle = '#fcd34d';
      g.fillRect(x + 0.12, y + 0.18, 0.76, 0.64);
      g.fillStyle = '#9ca3af';
      g.fillRect(x + 0.62, y + 0.24, 0.06, 0.4);
    } else if (ch === 'S') {
      g.fillStyle = '#1f2937';
      g.fillRect(x + 0.08, y + 0.08, 0.84, 0.84);
      g.strokeStyle = '#4b5563';
      g.lineWidth = 0.06;
      g.beginPath();
      g.arc(x + 0.5, y + 0.5, 0.3, 0, Math.PI * 2);
      g.stroke();
    } else if (ch === 'P') {
      for (let i = 0; i < 3; i++) circle(g, x + 0.5, y + 0.6 - i * 0.08, 0.36, i === 2 ? '#f8fafc' : '#d1d5db');
    } else if (ch === 'X') {
      g.fillStyle = '#374151';
      g.fillRect(x + 0.2, y + 0.15, 0.6, 0.72);
      g.fillStyle = '#4b5563';
      g.fillRect(x + 0.14, y + 0.1, 0.72, 0.12);
    } else if (ch === 'H') {
      g.fillStyle = '#facc15';
      g.fillRect(x + 0.05, y + 0.05, 0.9, 0.9);
      g.fillStyle = '#1f2937';
      for (let i = 0; i < 4; i++) g.fillRect(x + 0.05 + i * 0.25, y + 0.05, 0.12, 0.9);
      // A bell.
      circle(g, x + 0.5, y + 0.55, 0.22, '#e5e7eb');
      circle(g, x + 0.5, y + 0.3, 0.06, '#e5e7eb');
    }
  }

  function drawChef(g, c, s, slot) {
    circle(g, s.x, s.y + 0.05, 0.36, 'rgba(0,0,0,0.25)');
    circle(g, s.x, s.y, 0.34, colors[slot]);
    // The hat.
    circle(g, s.x, s.y - 0.06, 0.2, '#f8fafc');
    g.fillStyle = '#f8fafc';
    g.fillRect(s.x - 0.16, s.y - 0.02, 0.32, 0.12);
    // What they carry, held out in front.
    if (c.held) food(g, c.held, s.x + c.face[0] * 0.42, s.y + c.face[1] * 0.42, 0.55);
    if (c.chopping) {
      g.strokeStyle = '#f8fafc';
      g.lineWidth = 0.06;
      g.beginPath();
      g.moveTo(s.x + c.face[0] * 0.3 - 0.1, s.y + c.face[1] * 0.3 - 0.1);
      g.lineTo(s.x + c.face[0] * 0.3 + 0.1, s.y + c.face[1] * 0.3 + 0.1);
      g.stroke();
    }
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    const v = view;
    if (!v || !canvas || !colors) return;
    const W = v.layout[0].length;
    const H = v.layout.length;
    // The size only now and then (reading the layout every frame costs on a Raspberry Pi).
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
    const g = canvas.getContext('2d');
    const k = canvas.width / W;
    // The kitchen itself never changes: drawn once (per size and kitchen), then copied.
    const key = canvas.width + 'x' + canvas.height + ':' + v.kitchen;
    if (!floor || floor.key !== key) {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      const fg = c.getContext('2d');
      fg.setTransform(k, 0, 0, k, 0, 0);
      v.layout.forEach(function (row, y) { for (let x = 0; x < row.length; x++) drawTile(fg, row[x], x, y); });
      floor = { key: key, canvas: c };
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(floor.canvas, 0, 0);
    g.setTransform(k, 0, 0, k, 0, 0);
    // What's on the stations, and how it's coming along.
    v.items.forEach(function (it) {
      const cx = it.x + 0.5;
      const cy = it.y + 0.5;
      const ch = v.layout[it.y][it.x];
      if (ch === 'S' && it.kind === 'meat' && it.state !== 'burnt') {
        circle(g, cx, cy, 0.34, 'rgba(239, 68, 68, ' + (0.35 + 0.15 * Math.sin(now / 150)) + ')');
      }
      food(g, it, cx, cy, 0.7);
      if (it.progress) ring(g, cx, cy, it.progress, '#38bdf8');
      if (ch === 'S' && it.kind === 'meat' && it.state === 'raw') ring(g, cx, cy, it.cook || 0, '#22c55e');
      if (it.burn > 0.5 && it.state === 'cooked' && Math.floor(now / 200) % 2) ring(g, cx, cy, it.burn, '#f97316'); // about to burn!
    });
    // Chefs, eased towards the newest positions; the tile each faces outlined in their colour.
    const ease = Math.min(1, (performance.now() - viewAt) / 33);
    if (!shown) shown = v.chefs.map(function (c) { return { x: c.x, y: c.y }; });
    v.chefs.forEach(function (c, i) {
      shown[i].x += (c.x - shown[i].x) * (0.35 + 0.65 * ease);
      shown[i].y += (c.y - shown[i].y) * (0.35 + 0.65 * ease);
      if (v.phase === 'play' && v.layout[c.at[1]] && v.layout[c.at[1]][c.at[0]] !== ' ') {
        g.strokeStyle = colors[i];
        g.lineWidth = 0.07;
        g.strokeRect(c.at[0] + 0.06, c.at[1] + 0.06, 0.88, 0.88);
      }
    });
    v.chefs.forEach(function (c, i) { drawChef(g, c, shown[i], i); });
  }

  // Controllers: the stick (or D-pad) walks, A is ACTION, hold X (or B) to chop.
  function padPoll(pad, v) {
    if (v.phase !== 'play') return null;
    const held = function (b) { return pad.held.indexOf(b) !== -1; };
    const dz = function (a) { return Math.abs(a) < DEADZONE ? 0 : a; };
    let x = dz(pad.stick.x);
    let y = dz(pad.stick.y);
    if (held('LEFT')) x = -1;
    if (held('RIGHT')) x = 1;
    if (held('UP')) y = -1;
    if (held('DOWN')) y = 1;
    return { type: 'move', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, chop: held('X') || held('B') };
  }

  Ark.register('host', 'kitchen-rush', {
    sounds: function (prev, v) {
      const a = prev.events;
      const b = v.events;
      const out = [];
      if (prev.phase === 'countdown' && v.phase === 'play') out.push('go');
      if (!a || !b) return out;
      if (b.served > a.served) out.push('correct');
      if (b.missed > a.missed) out.push('wrong');
      if (b.burnt > a.burnt) out.push('crash');
      if (b.chopped > a.chopped || b.cooked > a.cooked) out.push('point');
      if (b.picked > a.picked) out.push('tick');
      if (b.binned > a.binned) out.push('drop');
      return out;
    },
    padHint: 'Stick or D-pad walks · A: pick up, put down, serve · hold X (or B): chop · A: rematch at the end',
    padPoll: padPoll,
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return v.phase === 'play' && btn === 'A' ? { type: 'act' } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'kr-host';
      root.innerHTML = '<div class="kr-top"><div class="kr-orders"></div><div class="kr-score"></div></div><div class="kr-floor"><canvas></canvas><div class="kr-over hidden"></div></div>';
      el.appendChild(root);
      top = root.querySelector('.kr-top');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.kr-over');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (!view || v.phase === 'countdown') shown = null;
      view = v;
      viewAt = performance.now();
      renderTop(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = top = canvas = overlay = view = shown = floor = null;
      topKey = overlayKey = '';
    },
  });
})();
