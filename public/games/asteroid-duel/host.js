// Asteroid Duel on the TV (server/games/asteroid-duel.js): ships, shots and rocks on a canvas.
// Views come ~30 times a second; between them everything is carried on along its velocity (a
// little way), and anything near an edge is drawn on the far side too, as the field wraps.
(function () {
  Ark.loadCss('/games/asteroid-duel/style.css');
  const esc = Ark.escapeHtml;
  const DEADZONE = 0.2;
  const FIRE_BUTTONS = ['A', 'RT', 'RB', 'X'];
  const MAX_EXTRAPOLATE_MS = 50;
  // Fixed star field (field units), the same every time.
  const STARS = [];
  for (let i = 0; i < 70; i++) STARS.push([((i * 7919) % 1600) / 100, ((i * 104729) % 900) / 100, (i % 3) * 0.012 + 0.012]);

  let root = null;
  let board = null;
  let stats = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let overlayKey = '';
  let boardKey = '';
  let statsKey = '';
  let colors = null;
  let frames = 0;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }
  function hearts(n, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < n ? '♥' : '♡';
    return s;
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    const r = v.result;
    if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Round ' + v.round + ' · first to ' + v.winScore;
    } else if (v.phase === 'roundEnd' && r) {
      big = v.scores[0] + ' : ' + v.scores[1];
      if (r.draw) sub = r.reason === 'time' ? 'Time! Level on lives: a draw.' : 'Both out: a draw!';
      else sub = (r.reason === 'time' ? 'Time! More lives left: ' : '') + nameOf(v, r.roundWinner) + ' takes the round!';
    } else if (v.phase === 'over') {
      big = '🏆';
      sub = nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] +
        '</strong><br>Rematch or head back to the lobby from your phones or controllers.';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  function renderStats(v) {
    const t = v.timeLeft === null ? '' : Math.floor(v.timeLeft / 60) + ':' + String(v.timeLeft % 60).padStart(2, '0');
    const key = v.ships.map(function (s) { return s.lives; }).join('|') + t;
    if (key === statsKey) return;
    statsKey = key;
    stats.innerHTML = '<span class="p1-text">' + hearts(v.ships[0].lives, v.maxLives) + '</span><span class="clock">' + t + '</span><span class="p2-text">' + hearts(v.ships[1].lives, v.maxLives) + '</span>';
  }

  function resize() {
    if (frames++ % 30 && canvas.width) return; // the box rarely changes: measure twice a second
    const f = view.field;
    const box = arena.getBoundingClientRect();
    const scale = Math.min(box.width / f.w, box.height / f.h);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(f.w * scale);
    const h = Math.floor(f.h * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  /** Calls draw(x, y) at the spot and again across any edge it's within `r` of. */
  function wrapped(f, x, y, r, draw) {
    const xs = [x];
    const ys = [y];
    if (x < r) xs.push(x + f.w);
    if (x > f.w - r) xs.push(x - f.w);
    if (y < r) ys.push(y + f.h);
    if (y > f.h - r) ys.push(y - f.h);
    xs.forEach(function (a) { ys.forEach(function (b) { draw(a, b); }); });
  }
  const wrapTo = function (v, size) { return ((v % size) + size) % size; };

  /** A lumpy rock outline, the same shape every frame (from its id). */
  function rockPath(g, x, y, r, id) {
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const k = 0.78 + (((id * 31 + i * 17) % 10) / 10) * 0.3;
      const px = x + Math.cos(a) * r * k;
      const py = y + Math.sin(a) * r * k;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    resize();
    const f = view.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = '#050816';
    g.fillRect(0, 0, f.w, f.h);
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    STARS.forEach(function (s) { g.fillRect(s[0], s[1], s[2] * 2, s[2] * 2); });
    const dt = view.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    const at = function (o) { return [wrapTo(o.x + o.vx * dt, f.w), wrapTo(o.y + o.vy * dt, f.h)]; };

    g.lineWidth = 0.05;
    view.rocks.forEach(function (rock) {
      const p = at(rock);
      wrapped(f, p[0], p[1], rock.r, function (x, y) {
        rockPath(g, x, y, rock.r, rock.id);
        g.fillStyle = '#57534e';
        g.strokeStyle = '#a8a29e';
        g.fill();
        g.stroke();
      });
    });

    view.bullets.forEach(function (b) {
      const p = at(b);
      g.fillStyle = colors[b.owner];
      g.beginPath();
      g.arc(p[0], p[1], 0.09, 0, Math.PI * 2);
      g.fill();
    });

    const r = view.shipR;
    view.ships.forEach(function (s, slot) {
      if (!s.alive) return;
      const p = at(s);
      wrapped(f, p[0], p[1], r * 1.6, function (x, y) {
        g.save();
        g.translate(x, y);
        g.rotate(s.angle);
        if (s.thrust) {
          g.fillStyle = '#f97316';
          g.beginPath();
          g.moveTo(-r * 0.7, -r * 0.35);
          g.lineTo(-r * 1.5, 0);
          g.lineTo(-r * 0.7, r * 0.35);
          g.fill();
        }
        g.fillStyle = colors[slot];
        g.beginPath();
        g.moveTo(r * 1.2, 0);
        g.lineTo(-r * 0.8, -r * 0.75);
        g.lineTo(-r * 0.5, 0);
        g.lineTo(-r * 0.8, r * 0.75);
        g.closePath();
        g.fill();
        g.restore();
        if (s.shield) {
          g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          g.lineWidth = 0.05;
          g.beginPath();
          g.arc(x, y, r * 1.5, 0, Math.PI * 2);
          g.stroke();
        }
      });
    });
  }

  Ark.register('host', 'asteroid-duel', {
    sounds: function (prev, v) {
      if (prev.phase !== 'play' || v.phase === 'countdown') return [];
      const out = [];
      const shots = function (w, slot) { return w.bullets.filter(function (b) { return b.owner === slot; }).length; };
      if ([0, 1].some(function (slot) { return shots(v, slot) > shots(prev, slot); })) out.push('shoot');
      // A rock broke if one that was there is gone (a new pair coming in isn't a crash).
      const ids = v.rocks.map(function (r) { return r.id; });
      if (v.ships.some(function (s, i) { return s.lives < prev.ships[i].lives; })) out.push('boom');
      else if (prev.rocks.some(function (r) { return ids.indexOf(r.id) === -1; })) out.push('crash');
      return out;
    },
    padHint: 'Left stick to steer (push further to thrust) · D-pad turns, B thrusts · hold A / RT to fire · A: rematch at the end',
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    // The stick points where the ship should face, in TV directions; pushed further, it thrusts.
    // The D-pad only turns (a light push), and B thrusts the way you face. The fire trigger rides
    // along: held, the hub fires as fast as the reload allows.
    padPoll: function (pad, v, slot) {
      function dz(a) {
        return Math.abs(a) < DEADZONE ? 0 : (a - Math.sign(a) * DEADZONE) / (1 - DEADZONE);
      }
      const held = function (b) { return pad.held.indexOf(b) !== -1; };
      let x = dz(pad.stick.x);
      let y = dz(pad.stick.y);
      if (!x && !y) {
        const dx = (held('RIGHT') ? 1 : 0) - (held('LEFT') ? 1 : 0);
        const dy = (held('DOWN') ? 1 : 0) - (held('UP') ? 1 : 0);
        const d = Math.hypot(dx, dy) || 1;
        x = (dx / d) * 0.4;
        y = (dy / d) * 0.4;
      }
      if (held('B')) {
        const ship = v && v.ships && v.ships[slot];
        const d = Math.hypot(x, y);
        if (d) {
          x /= d;
          y /= d;
        } else if (ship) {
          x = Math.cos(ship.angle);
          y = Math.sin(ship.angle);
        }
      }
      const fire = FIRE_BUTTONS.some(held);
      return { type: 'move', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, fire: fire };
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'ad-host';
      root.innerHTML = '<div class="ad-board"></div><div class="ad-stats"></div><div class="ad-arena"><canvas></canvas><div class="ad-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.ad-board');
      stats = root.querySelector('.ad-stats');
      arena = root.querySelector('.ad-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.ad-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      const key = v.scores.join(':') + v.players.map(function (p) { return p.name; }).join('|');
      if (key !== boardKey) {
        boardKey = key;
        board.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round);
      }
      renderStats(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = board = stats = arena = canvas = overlay = view = null;
      overlayKey = boardKey = statsKey = '';
    },
  });
})();
