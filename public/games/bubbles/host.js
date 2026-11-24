(function () {
  Ark.loadCss('/games/bubbles/style.css');
  // The bubbles' colours are the bubbles themselves.
  const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316'];
  const SPEED = 38; // how fast a shot flies on screen, units per second
  const AIM_SPEED = 80; // degrees a second while a controller holds left or right

  let root = null;
  let arena = null;
  let canvas = null;
  let stats = null;
  let raf = null;
  let view = null;
  let shot = null; // the last shot being shown: { last, at (ms), length }
  let shownN = 0;
  let aim = 0; // a controller's aim, moved on the TV and sent
  let held = 0; // -1, 0 or 1 while left / right is held
  let lastFrame = 0;
  let statsKey = '';

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

  function centre(v, r, c) {
    return { x: c + 0.5 + ((r + v.parity) % 2 === 1 ? 0.5 : 0), y: r * v.rowH + 0.5 };
  }

  function bubble(g, x, y, colour, alpha) {
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    g.fillStyle = COLOURS[colour];
    g.beginPath();
    g.arc(x, y, 0.47, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.45)';
    g.beginPath();
    g.arc(x - 0.15, y - 0.15, 0.14, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  /** The length of a path of points. */
  function lengthOf(path) {
    let d = 0;
    for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return d;
  }

  /** The point a distance d along a path. */
  function along(path, d) {
    for (let i = 1; i < path.length; i++) {
      const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (d <= seg) {
        const k = seg ? d / seg : 0;
        return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * k, y: path[i - 1].y + (path[i].y - path[i - 1].y) * k };
      }
      d -= seg;
    }
    return path[path.length - 1];
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!view) return;
    const dtFrame = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (held && view.phase === 'play') aim = Math.max(-view.maxAngle, Math.min(view.maxAngle, aim + held * AIM_SPEED * dtFrame));
    resize();
    const v = view;
    const f = v.field;
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, f.w, f.h);

    // The line a bubble mustn't reach.
    const line = v.deathRow * v.rowH;
    g.fillStyle = 'rgba(248, 113, 113, 0.35)';
    g.fillRect(0, line, f.w, 0.06);

    const flying = shot && (now - shot.at) / 1000 * SPEED < shot.length;
    const atKey = shot && shot.last.at.join(',');
    v.grid.forEach(function (row, r) {
      row.forEach(function (colour, c) {
        if (colour < 0 || (flying && r + ',' + c === atKey && !shot.last.cleared)) return;
        const p = centre(v, r, c);
        bubble(g, p.x, p.y, colour);
      });
    });

    if (shot) {
      const d = ((now - shot.at) / 1000) * SPEED;
      if (d < shot.length) {
        const p = along(shot.last.path, d);
        bubble(g, p.x, p.y, shot.last.colour);
      } else {
        // Popped ones burst, dropped ones fall.
        const t = (d - shot.length) / SPEED;
        if (t < 0.8) {
          const old = shot.view;
          shot.last.popped.forEach(function (rc) {
            const p = centre(old, rc[0], rc[1]);
            g.globalAlpha = Math.max(0, 1 - t / 0.3);
            g.strokeStyle = '#fff';
            g.lineWidth = 0.08;
            g.beginPath();
            g.arc(p.x, p.y, 0.47 + t * 1.5, 0, Math.PI * 2);
            g.stroke();
            g.globalAlpha = 1;
          });
          shot.last.dropped.forEach(function (rc) {
            const p = centre(old, rc[0], rc[1]);
            bubble(g, p.x, p.y + t * t * 30, shot.colours[rc[0] + ',' + rc[1]] || 0, 1 - t / 0.8);
          });
        }
      }
    }

    // The launcher: the aim line, the bubble to fire and the next one.
    const L = v.launcher;
    const a = ((v.player && v.player.local ? aim : v.aim) * Math.PI) / 180;
    if (v.phase === 'play') {
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      g.lineWidth = 0.08;
      g.setLineDash([0.25, 0.25]);
      g.beginPath();
      g.moveTo(L.x, L.y);
      // Straight on, bouncing off the walls, for a good way up.
      let x = L.x, y = L.y, dx = Math.sin(a), dy = -Math.cos(a), left = 9;
      while (left > 0 && y > 0.5) {
        const toWall = dx > 0 ? (v.cols - 0.5 - x) / dx : dx < 0 ? (0.5 - x) / dx : Infinity;
        const step = Math.min(left, toWall, (y - 0.5) / -dy);
        x += dx * step;
        y += dy * step;
        left -= step;
        g.lineTo(x, y);
        if (step === toWall) dx = -dx;
      }
      g.stroke();
      g.setLineDash([]);
      bubble(g, L.x, L.y, v.current);
      g.globalAlpha = 0.9;
      bubble(g, L.x + 1.6, L.y + 0.1, v.next, 0.7);
    }
  }

  function render(v) {
    const s = '<span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span><span>Board <strong>' + v.level + '</strong></span>' +
      '<span class="drop' + (v.missesLeft <= 1 ? ' soon' : '') + '">⬇ in <strong>' + v.missesLeft + '</strong> miss' + (v.missesLeft === 1 ? '' : 'es') + '</span>';
    if (s !== statsKey) {
      statsKey = s;
      stats.innerHTML = s;
    }
  }

  Ark.register('host', 'bubbles', {
    sounds: function (prev, v) {
      if (!v.last || (prev.last && prev.last.n === v.last.n)) return [];
      if (v.phase === 'over') return ['crash'];
      if (v.last.cleared) return ['fanfare'];
      if (v.last.popped.length) return [v.last.dropped.length ? 'bigBoom' : 'boom'];
      return ['lock'];
    },
    padHint: '← → (held) aim · A / RT / Space fire',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'A' || btn === 'RT' || btn === 'UP') return { type: 'shoot', angle: Math.round(aim * 10) / 10 };
      return null;
    },
    padPoll: function (pad) {
      const l = pad.held.indexOf('LEFT') !== -1 || pad.stick.x < -0.5;
      const r = pad.held.indexOf('RIGHT') !== -1 || pad.stick.x > 0.5;
      const was = held;
      held = l === r ? 0 : l ? -1 : 1;
      // Tell the server where it's aimed (for the screens) when a turn stops.
      if (was && !held) return { type: 'aim', angle: Math.round(aim * 10) / 10 };
      return null;
    },
    overHtml: function (v) {
      return v.cleared ? v.cleared + ' board' + (v.cleared === 1 ? '' : 's') + ' cleared · best shot ' + v.bestCombo + ' bubbles' : 'Best shot: ' + v.bestCombo + ' bubbles';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'bubbles-host';
      root.innerHTML = '<div class="bubbles-stats"></div><div class="bubbles-arena"><canvas></canvas></div>';
      el.appendChild(root);
      stats = root.querySelector('.bubbles-stats');
      arena = root.querySelector('.bubbles-arena');
      canvas = root.querySelector('canvas');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      if (v.last && v.last.n !== shownN) {
        // Keep the board as it was (for where popped and dropped ones were) and their colours.
        const old = view || v;
        const colours = {};
        v.last.dropped.forEach(function (rc) { colours[rc[0] + ',' + rc[1]] = old.grid[rc[0]] ? old.grid[rc[0]][rc[1]] : 0; });
        shot = { last: v.last, at: performance.now(), length: lengthOf(v.last.path), view: { parity: old.parity, rowH: v.rowH }, colours: colours };
        shownN = v.last.n;
      }
      if (!v.last) { shot = null; shownN = 0; }
      if (!held) aim = v.aim;
      view = v;
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = arena = canvas = stats = view = shot = null;
      statsKey = '';
      shownN = 0;
      held = 0;
    },
  });
})();
