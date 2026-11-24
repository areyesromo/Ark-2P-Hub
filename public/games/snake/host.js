// Snake Battle on the TV, and the 1 player mode's Snake (view.solo: one snake in a look the
// player unlocked, the score and speed instead of the scoreboard and clock).
(function () {
  Ark.loadCss('/games/snake/style.css');
  const esc = Ark.escapeHtml;
  // Controller: D-pad / stick steer; the face buttons work as a diamond too.
  const PAD_DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right', Y: 'up', A: 'down', X: 'left', B: 'right' };
  const EYES = { up: [[-0.18, -0.15], [0.18, -0.15]], down: [[-0.18, 0.15], [0.18, 0.15]], left: [[-0.15, -0.18], [-0.15, 0.18]], right: [[0.15, -0.18], [0.15, 0.18]] };

  let root = null;
  let board = null;
  let stats = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let overlayKey = '';
  let boardKey = '';
  let statsKey = '';
  let colors = null;
  // 1 player: the unlockable looks (server/solo/games/looks.js), a colour per segment (0 is the head).
  // These colours are the snake itself.
  const LOOKS = {
    classic: { glow: 10, colour: function () { return colors[0]; } },
    rainbow: { glow: 10, colour: function (i, now) { return 'hsl(' + Math.round((i * 24 + now / 12) % 360) + ', 90%, 60%)'; } },
    neon: { glow: 22, colour: function (i) { return i % 2 ? '#c026d3' : '#e879f9'; } },
    gold: { glow: 14, colour: function (i) { return i % 3 === 1 ? '#ca8a04' : '#facc15'; } },
  };

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function clock(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function soloOverlay(v) {
    if (v.phase === 'countdown') return [String(v.countdown || ''), 'Eat the food to grow · don\'t hit ' + (v.wrap ? 'your own tail' : 'the walls or your tail')];
    if (v.phase === 'paused') return ['⏸', 'Paused · press pause again to carry on'];
    return ['', '']; // (the hub draws the end of a run)
  }

  function renderOverlay(v) {
    let big = '';
    let sub = '';
    if (v.solo) {
      const o = soloOverlay(v);
      big = o[0];
      sub = o[1];
    }
    const len = v.snakes.map(function (s) { return s.body.length; });
    if (v.solo) {
      // (done above)
    } else if (v.phase === 'countdown') {
      big = String(v.countdown || '');
      sub = 'Round ' + v.round + ' · eat to grow · longest snake wins at ' + clock(v.timeLeft);
    } else if (v.phase === 'roundEnd' && v.result) {
      const r = v.result;
      if (r.reason === 'time') {
        big = '⏱';
        sub = r.draw
          ? 'Time! Same length (' + len[0] + '). Draw!'
          : 'Time! ' + nameOf(v, r.roundWinner) + ' is longer (<strong>' + len[r.roundWinner] + '</strong> vs ' + len[1 - r.roundWinner] + ') and takes the round';
      } else if (r.draw) {
        big = '💥';
        sub = 'Both crashed. Draw!';
      } else {
        big = v.scores[0] + ' : ' + v.scores[1];
        sub = nameOf(v, 1 - r.roundWinner) + ' crashed. ' + nameOf(v, r.roundWinner) + ' takes the round!';
      }
    } else if (v.phase === 'over') {
      big = '🏆';
      sub = '<span class="ark-result">' + nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] +
        '</strong></span><br>Rematch or head back to the lobby from your phones or controllers.';
    }
    const key = big + '|' + sub;
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.innerHTML = big || sub ? '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>' : '';
  }

  function renderStats(v) {
    if (v.solo) {
      const k = v.score + '|' + v.length + '|' + v.cps;
      if (k === statsKey) return;
      statsKey = k;
      stats.innerHTML = '<span>Score <strong>' + v.score + '</strong></span><span>Length <strong>' + v.length + '</strong></span><span>Speed <strong>' + v.cps + '</strong></span>';
      return;
    }
    const len = v.snakes.map(function (s) { return s.body.length; });
    const key = len.join(':') + '|' + v.timeLeft + v.phase;
    if (key === statsKey) return;
    statsKey = key;
    const low = v.phase === 'play' && v.timeLeft <= 10;
    stats.innerHTML =
      '<span>Length <strong class="p1-text">' + len[0] + '</strong></span>' +
      '<span class="clock' + (low ? ' low' : '') + '">⏱ ' + clock(v.timeLeft) + '</span>' +
      '<span>Length <strong class="p2-text">' + len[1] + '</strong></span>';
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

    // Food: pulsing glow
    const pulse = 0.32 + 0.05 * Math.sin((now || 0) / 180);
    g.fillStyle = g.shadowColor = '#fb923c';
    g.shadowBlur = 16;
    view.food.forEach(function (f) {
      g.beginPath();
      g.arc(f[0] + 0.5, f[1] + 0.5, pulse, 0, Math.PI * 2);
      g.fill();
    });
    g.shadowBlur = 0;

    if (view.solo) return drawSolo(g, view.snakes[0], now || 0);
    view.snakes.forEach(function (s, slot) {
      g.fillStyle = g.shadowColor = colors[slot];
      g.shadowBlur = 10;
      for (let i = s.body.length - 1; i >= 1; i--) {
        g.globalAlpha = 0.55 + 0.45 * (1 - i / s.body.length); // tail fades a little
        roundCell(g, s.body[i][0], s.body[i][1], 0.08, 0.22);
      }
      g.globalAlpha = 1;
      const h = s.body[0];
      roundCell(g, h[0], h[1], 0.02, 0.3);
      g.shadowBlur = 0;
      // Eyes looking the way it's heading
      g.fillStyle = '#05070f';
      EYES[s.dir].forEach(function (e) {
        g.beginPath();
        g.arc(h[0] + 0.5 + e[0], h[1] + 0.5 + e[1], 0.1, 0, Math.PI * 2);
        g.fill();
      });
      // (1 or 2 on its neck: not by colour alone)
      if (s.body[1]) Ark.drawMark(g, s.body[1][0] + 0.5, s.body[1][1] + 0.5, 0.7, slot);
      if (s.crashed) {
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.shadowColor = colors[slot];
        g.shadowBlur = 40;
        g.beginPath();
        g.arc(h[0] + 0.5, h[1] + 0.5, 0.9, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
      }
    });
  }

  /** 1 player: the one snake, in its look (with the neon stripe or the gold glint). */
  function drawSolo(g, s, now) {
    const body = s.body;
    const look = LOOKS[view.look] || LOOKS.classic;
    g.shadowBlur = look.glow;
    for (let i = body.length - 1; i >= 1; i--) {
      g.fillStyle = g.shadowColor = look.colour(i, now);
      g.globalAlpha = 0.55 + 0.45 * (1 - i / body.length); // the tail fades a little
      roundCell(g, body[i][0], body[i][1], 0.08, 0.22);
    }
    g.globalAlpha = 1;
    const h = body[0];
    g.fillStyle = g.shadowColor = look.colour(0, now);
    roundCell(g, h[0], h[1], 0.02, 0.3);
    g.shadowBlur = 0;
    if (view.look === 'neon') {
      // A bright line down the middle of each segment.
      g.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < body.length; i++) roundCell(g, body[i][0], body[i][1], 0.38, 0.1);
    } else if (view.look === 'gold') {
      // A glint that runs along the body.
      const at = Math.floor(now / 90) % (body.length + 6);
      if (body[at]) {
        g.fillStyle = 'rgba(255, 255, 255, 0.75)';
        roundCell(g, body[at][0], body[at][1], 0.3, 0.2);
      }
    }
    g.fillStyle = '#05070f';
    EYES[s.dir].forEach(function (e) {
      g.beginPath();
      g.arc(h[0] + 0.5 + e[0], h[1] + 0.5 + e[1], 0.1, 0, Math.PI * 2);
      g.fill();
    });
    if (s.crashed) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.shadowColor = colors[0];
      g.shadowBlur = 40;
      g.beginPath();
      g.arc(h[0] + 0.5, h[1] + 0.5, 0.9, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }

  Ark.register('host', 'snake', {
    // Sound: a blip when a snake eats, a crash when one dies.
    sounds: function (prev, v) {
      const out = [];
      if (!prev.snakes) return out;
      v.snakes.forEach(function (s, i) {
        const p = prev.snakes[i];
        if (v.phase === 'play' && p && s.body.length > p.body.length) out.push('eat');
        if (p && s.crashed && !p.crashed) out.push('crash');
      });
      return out;
    },
    padHint: 'D-pad, stick or arrows to steer (Y↑ A↓ X← B→ work too) · A: rematch at the end · 1 player: Start / P pauses',
    pad: function (btn, v) {
      if (v.solo && btn === 'START') return v.phase === 'over' ? null : { type: 'pause' }; // (the hub's end screen has Play again)
      if (v.phase === 'over') return v.solo ? null : btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return PAD_DIRS[btn] ? { type: 'turn', dir: PAD_DIRS[btn] } : null;
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'snake-host';
      root.innerHTML =
        '<div class="snake-board"></div><div class="snake-stats"></div>' +
        '<div class="snake-arena"><canvas></canvas><div class="snake-overlay"></div></div>';
      el.appendChild(root);
      board = root.querySelector('.snake-board');
      stats = root.querySelector('.snake-stats');
      arena = root.querySelector('.snake-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.snake-overlay');
      raf = requestAnimationFrame(draw);
    },
    // 1 player: the line under the score on the hub's end screen.
    overHtml: function (v) {
      return v.solo ? 'Length ' + v.length + (v.crashed ? '' : ' · you filled the board!') : '';
    },
    update: function (v) {
      view = v;
      root.classList.toggle('solo', Boolean(v.solo));
      canvas.classList.toggle('wrap', Boolean(v.wrap));
      if (v.solo) {
        if (boardKey) board.innerHTML = '';
        boardKey = '';
        renderStats(v);
        return renderOverlay(v);
      }
      const key = v.scores.join(':') + v.round + v.players.map(function (p) { return p.name; }).join('|');
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
