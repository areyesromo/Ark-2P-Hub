(function () {
  Ark.loadCss('/games/kart-race/style.css');
  // The track geometry the server drives on (track.js), so the road drawn is the road raced.
  let Road = window.ArkKartTrack || null;
  function loadRoad(tries) {
    Ark.loadScript('/games/kart-race/track.js').then(function () {
      Road = window.ArkKartTrack;
      previews = {};
      overlayKey = '';
      if (view && overlay) renderOverlay(view);
    }).catch(function () {
      if (tries < 5) setTimeout(function () { loadRoad(tries + 1); }, 2000); // a flaky network: try again
    });
  }
  loadRoad(0);
  const esc = Ark.escapeHtml;
  let trackNames = []; // from the server's views
  const ROWS = [
    { key: 'track', title: 'Track', fmt: function (n) { return n === 0 ? 'Mixed' : trackNames[n - 1] || 'Track ' + n; } },
    { key: 'laps', title: 'Laps', fmt: function (n) { return n + ' laps'; } },
    { key: 'races', title: 'Races', fmt: function (n) { return n === 1 ? 'One race' : 'Best of ' + n; } },
    { key: 'items', title: 'Items (? boxes)', fmt: function (n) { return n ? 'On' : 'Off'; } },
  ];
  const ITEM_ICON = { banana: '🍌', turbo: '⚡', shield: '🛡️' };
  const DEADZONE = 0.15;

  let root = null;
  let hud = null;
  let arena = null;
  let canvas = null;
  let overlay = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let shown = null; // eased kart positions
  let colors = null;
  let lineKey = '';
  let line = null; // the track's centre line, in field units
  let walls = null; // [left, right] wall lines
  let previews = {}; // track index -> SVG path of its centre line (setup screen)
  let hudKey = '';
  let overlayKey = '';
  const pads = {}; // controller players on the setup screen: slot -> { row }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function ordinal(n) {
    return n === 1 ? '1st' : '2nd';
  }

  function clock(ms) {
    const s = ms / 1000;
    return Math.floor(s / 60) + ':' + ('0' + (s % 60).toFixed(1)).slice(-4);
  }

  // The speedometer: a dial from 0 to boost speed over a 240° sweep, shown as km/h.
  const KMH = 12; // field units per second -> "km/h" on the dial
  const SWEEP = 240;

  /** A point on the dial (centre 50,50) at fraction f of the sweep, radius r. */
  function dialAt(f, r) {
    const a = ((-SWEEP / 2 + f * SWEEP) - 90) * Math.PI / 180;
    return (50 + Math.cos(a) * r).toFixed(1) + ' ' + (50 + Math.sin(a) * r).toFixed(1);
  }

  function dialArc(f0, f1, r) {
    return 'M' + dialAt(f0, r) + ' A' + r + ' ' + r + ' 0 ' + ((f1 - f0) * SWEEP > 180 ? 1 : 0) + ' 1 ' + dialAt(f1, r);
  }

  function gaugeHtml(v) {
    const top = v.boostSpeed;
    let ticks = '';
    for (let kmh = 0; kmh <= top * KMH; kmh += 20) {
      const f = kmh / (top * KMH);
      ticks += '<path d="M' + dialAt(f, 40) + ' L' + dialAt(f, 46) + '"/>';
    }
    return '<div class="kr-gauge"><svg viewBox="0 0 100 86">' +
      '<path class="track" d="' + dialArc(0, 1, 43) + '"/>' +
      '<path class="red" d="' + dialArc(v.maxSpeed / top, 1, 43) + '"/>' +
      '<path class="fill" d="' + dialArc(0, 1, 43) + '" pathLength="1"/>' +
      '<g class="ticks">' + ticks + '</g>' +
      '<line class="needle" x1="50" y1="50" x2="50" y2="14"/><circle cx="50" cy="50" r="4"/></svg>' +
      '<div class="read"><b>0</b><span>km/h</span></div><div class="drift"><i></i></div></div>';
  }

  /** Move the needles and readouts (every view; the rest of the HUD only changes now and then). */
  function updateGauges(v) {
    hud.querySelectorAll('.kr-gauge').forEach(function (el, slot) {
      const k = v.karts[slot];
      const f = Math.min(1, Math.abs(k.speed) / v.boostSpeed);
      el.querySelector('.needle').style.transform = 'rotate(' + (-SWEEP / 2 + f * SWEEP) + 'deg)';
      el.querySelector('.fill').style.strokeDasharray = f + ' 1';
      el.querySelector('.read b').textContent = (k.speed < -0.05 ? 'R ' : '') + Math.round(Math.abs(k.speed) * KMH);
      el.classList.toggle('boost', k.boosting);
      el.classList.toggle('reverse', k.speed < -0.05);
      const d = el.querySelector('.drift');
      d.classList.toggle('on', k.drifting);
      d.classList.toggle('ready', k.driftCharge >= 1);
      d.querySelector('i').style.width = Math.round(k.driftCharge * 100) + '%';
    });
    hud.querySelectorAll('.kr-side .laptime').forEach(function (el, slot) {
      const k = v.karts[slot];
      el.textContent = (k.lapMs !== null ? '⏱ ' + clock(k.lapMs) : '') + (k.bestLap ? ' · best ' + clock(k.bestLap) : '');
    });
  }

  function renderHud(v) {
    let html = '';
    if (v.karts) {
      const side = function (slot) {
        const k = v.karts[slot];
        return '<div class="kr-side p' + (slot + 1) + '"><div class="info"><div class="name">' + nameOf(v, slot) + '</div>' +
          '<div class="pos">' + ordinal(v.positions[slot]) + (k.item ? ' <span class="item">' + ITEM_ICON[k.item] + '</span>' : '') + '</div>' +
          '<div class="lap">' + (k.finished ? '🏁 Finished' : k.cut ? '<span class="cut">⛔ Shortcut!</span>' : 'Lap ' + Math.min(v.laps, k.laps + 1) + ' / ' + v.laps) + '</div>' +
          '<div class="laptime"></div></div>' + gaugeHtml(v) + '</div>';
      };
      html = side(0) +
        '<div class="kr-mid"><div class="track">' + esc(v.track.name) + (v.races > 1 ? ' · Race ' + v.race + ' · ' + v.scores[0] + ' – ' + v.scores[1] : '') + '</div>' +
        '<div class="clock">' + clock(v.raceMs) + '</div></div>' + side(1);
    }
    if (html !== hudKey) {
      hudKey = html;
      hud.innerHTML = html;
    }
    if (v.karts) updateGauges(v);
  }

  /** A little map of a track (or a ? for Mixed) for the setup screen. */
  function previewHtml(v, n) {
    if (n === 0) return '<div class="kr-preview mixed"><span>🎲</span><div>Mixed: a different track each race</div></div>';
    if (!Road || !v.trackPoints) return '';
    if (!previews[n]) previews[n] = Road.svgPath(Road.centreLine(v.trackPoints[n - 1]));
    const f = v.field;
    return '<div class="kr-preview"><svg viewBox="0 0 ' + f.w + ' ' + f.h + '"><rect width="' + f.w + '" height="' + f.h + '" rx="0.8"/>' +
      '<path class="kerb" d="' + previews[n] + '" stroke-width="' + (v.trackWidth + 0.5) + '"/>' +
      '<path class="road" d="' + previews[n] + '" stroke-width="' + v.trackWidth + '"/></svg><div>' + esc(trackNames[n - 1] || '') + '</div></div>';
  }

  function renderOverlay(v) {
    let html = '';
    if (v.phase === 'setup') {
      html = '<div class="panel kr-setup"><div class="title">🏎️ Kart Race</div><div class="kr-setup-row">' + Ark.setup.html(v, ROWS, Ark.setup.focus(v, ROWS, pads)) + previewHtml(v, v.settings.track) + '</div>' +
        '<div class="sub">Pick on your phone, or with a controller (↑↓ row, ←→ change). <strong>Start</strong> (or <strong>A</strong>) when you\'re both ready.</div></div>';
    } else if (v.phase === 'countdown') {
      const n = v.countdown;
      const lights = [3, 2, 1].map(function (i) { return '<span class="light' + (n <= i ? ' on' : '') + '"></span>'; }).join('');
      html = '<div class="panel small"><div class="lights">' + lights + '</div><div class="sub">' + esc(v.track.name) + ' · ' + v.laps + ' laps · hold GAS to go, let go to coast, hold BRAKE to stop and reverse</div></div>';
    } else if (v.phase === 'finish' && v.result) {
      html = '<div class="banner">🏁 ' + nameOf(v, v.result.winner) + ' wins' + (v.races > 1 ? ' race ' + v.race : '') + '! <span class="muted">' + clock(v.result.time) + '</span></div>';
    } else if (v.phase === 'over') {
      html = '<div class="panel"><div class="title">🏆 ' + nameOf(v, v.winner) + ' wins' + (v.races > 1 ? ' ' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] : ' the race') + '!</div>' +
        '<div class="sub">Rematch, change the settings (🎮 Y) or head back to the lobby from your phones or controllers.</div></div>';
    }
    if (html === overlayKey) return;
    overlayKey = html;
    overlay.innerHTML = html;
  }

  // ---- drawing ----

  function strokeLoop(g, pts) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.closePath();
    g.stroke();
  }

  /** Stroke runs of a loop, skipping null points (gaps). */
  function strokeRuns(g, pts) {
    g.beginPath();
    let pen = false;
    pts.concat([pts[0]]).forEach(function (p) {
      if (!p) pen = false;
      else if (pen) g.lineTo(p[0], p[1]);
      else {
        g.moveTo(p[0], p[1]);
        pen = true;
      }
    });
    g.stroke();
  }

  /**
   * A wall, drawn `out` from the centre line (side: -1 left, +1 right), exactly where the server
   * has one: it keeps a kart's centre within `limit` of the NEAREST road, so where another
   * stretch of road is nearer than that (two roads side by side, as on Hairpins) there's no
   * wall between them, just grass (and the shortcut check).
   */
  function wallLine(side, limit, out) {
    const stop = Road.outline(line, side * limit); // where a kart's centre is held
    return Road.outline(line, side * out).map(function (p, j) {
      const q = stop[j];
      let near = Infinity;
      for (let i = 0; i < line.length; i++) near = Math.min(near, Math.hypot(line[i][0] - q[0], line[i][1] - q[1]));
      return near < limit - 0.05 ? null : p;
    });
  }

  function drawTrack(g, v) {
    const W = v.trackWidth;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // Walls (tyre barriers) beyond the grass verge: red and white, like the kerbs but chunkier.
    walls.forEach(function (wall) {
      g.strokeStyle = '#1f2937';
      g.lineWidth = 0.42;
      strokeRuns(g, wall);
      g.lineCap = 'butt';
      g.strokeStyle = '#ef4444';
      g.lineWidth = 0.3;
      g.setLineDash([0.45, 0.45]);
      strokeRuns(g, wall);
      g.strokeStyle = '#f1f5f9';
      g.lineDashOffset = 0.45;
      strokeRuns(g, wall);
      g.lineDashOffset = 0;
      g.setLineDash([]);
      g.lineCap = 'round';
    });
    // Kerbs: red with white dashes, a little wider than the road.
    g.strokeStyle = '#dc2626';
    g.lineWidth = W + 0.5;
    strokeLoop(g, line);
    g.strokeStyle = '#f8fafc';
    g.lineCap = 'butt'; // round caps would smear the dashes into one white line
    g.setLineDash([0.7, 0.7]);
    strokeLoop(g, line);
    g.setLineDash([]);
    g.lineCap = 'round';
    // Tarmac.
    g.strokeStyle = '#3f4652';
    g.lineWidth = W;
    strokeLoop(g, line);
    // Centre line.
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 0.08;
    g.setLineDash([0.8, 0.9]);
    strokeLoop(g, line);
    g.setLineDash([]);
    // Start / finish: a chequered strip across the road.
    const s = v.track.start;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.angle);
    const n = 8;
    const cell = W / n;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        g.fillStyle = (i + row) % 2 ? '#111' : '#f8fafc';
        g.fillRect(-cell + row * cell, -W / 2 + i * cell, cell, cell);
      }
    }
    g.restore();
    // Boost pads: yellow chevrons pointing along the track.
    v.track.boosts.forEach(function (b) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.angle);
      g.fillStyle = 'rgba(250,204,21,0.25)';
      g.fillRect(-0.9, -0.7, 1.8, 1.4);
      g.strokeStyle = '#facc15';
      g.lineWidth = 0.16;
      [-0.45, 0.1].forEach(function (x0) {
        g.beginPath();
        g.moveTo(x0, -0.45);
        g.lineTo(x0 + 0.4, 0);
        g.lineTo(x0, 0.45);
        g.stroke();
      });
      g.restore();
    });
  }

  /** ? boxes, spinning gently in rainbow colours, and the bananas on the road. */
  function drawBoxes(g, v, now) {
    v.boxes.forEach(function (b, i) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(now / 700 + i);
      g.fillStyle = 'hsl(' + ((now / 8 + i * 40) % 360) + ', 85%, 60%)';
      g.globalAlpha = 0.9;
      g.fillRect(-0.4, -0.4, 0.8, 0.8);
      g.globalAlpha = 1;
      g.strokeStyle = '#fff';
      g.lineWidth = 0.07;
      g.strokeRect(-0.4, -0.4, 0.8, 0.8);
      g.rotate(-(now / 700 + i));
      g.fillStyle = '#fff';
      g.font = 'bold 0.6px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 0, 0.04);
      g.restore();
    });
    // Bananas: drawn, not emoji (a kiosk browser may have no colour emoji font).
    v.bananas.forEach(function (b) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(-0.5);
      g.lineCap = 'round';
      g.strokeStyle = '#a16207';
      g.lineWidth = 0.32;
      g.beginPath();
      g.arc(0, -0.25, 0.42, 0.35, Math.PI - 0.35);
      g.stroke();
      g.strokeStyle = '#facc15';
      g.lineWidth = 0.22;
      g.beginPath();
      g.arc(0, -0.25, 0.42, 0.45, Math.PI - 0.45);
      g.stroke();
      g.restore();
    });
  }

  function drawKart(g, k, s, slot, now) {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.angle + (k.spin ? now / 60 : 0)); // spinning out after a banana
    if (k.boosting) {
      // Exhaust flame.
      g.fillStyle = Math.floor(now / 60) % 2 ? '#f97316' : '#facc15';
      g.beginPath();
      g.moveTo(-0.5, -0.16);
      g.lineTo(-0.95 - Math.random() * 0.25, 0);
      g.lineTo(-0.5, 0.16);
      g.fill();
    }
    if (k.drifting) {
      // Sparks off the back wheels: blue while charging, orange once a mini-boost is ready.
      g.fillStyle = k.driftCharge >= 1 ? '#fb923c' : '#60a5fa';
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        g.beginPath();
        g.arc(-0.45 - Math.random() * 0.35, side * (0.34 + Math.random() * 0.15), 0.05 + Math.random() * 0.05, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 8;
    // Wheels.
    g.fillStyle = '#111827';
    [[-0.32, -0.34], [0.28, -0.34], [-0.32, 0.34], [0.28, 0.34]].forEach(function (w) { g.fillRect(w[0] - 0.12, w[1] - 0.07, 0.24, 0.14); });
    // Body.
    g.fillStyle = colors[slot];
    g.beginPath();
    g.moveTo(0.55, 0);
    g.lineTo(0.3, -0.28);
    g.lineTo(-0.5, -0.28);
    g.lineTo(-0.5, 0.28);
    g.lineTo(0.3, 0.28);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#fff';
    g.lineWidth = 0.05;
    g.stroke();
    // Driver's helmet.
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.arc(-0.1, 0, 0.14, 0, Math.PI * 2);
    g.fill();
    if (k.shield) {
      g.strokeStyle = 'rgba(125, 211, 252, ' + (0.6 + 0.3 * Math.sin(now / 120)) + ')';
      g.lineWidth = 0.1;
      g.beginPath();
      g.arc(0, 0, 0.75, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    const v = view;
    if (!v || !v.track || !v.karts || !colors || !Road) {
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const key = v.track.index + ':' + v.track.points.length;
    if (key !== lineKey) {
      lineKey = key;
      line = Road.centreLine(v.track.points);
      const limit = v.trackWidth / 2 + v.wallOut - v.kartR;
      const out = limit + v.kartR + 0.2; // just past where a kart's edge stops
      walls = [wallLine(-1, limit, out), wallLine(1, limit, out)];
    }
    const f = v.field;
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
    const g = canvas.getContext('2d');
    const k = canvas.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    // Grass, mown in stripes.
    g.fillStyle = '#2f6f3a';
    g.fillRect(0, 0, f.w, f.h);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < f.w; x += 2) g.fillRect(x, 0, 1, f.h);
    drawTrack(g, v);
    drawBoxes(g, v, now);
    // Karts: eased towards the newest positions, nudged along their heading.
    const dt = v.phase === 'race' || v.phase === 'finish' ? Math.min(performance.now() - viewAt, 60) / 1000 : 0;
    if (!shown) shown = v.karts.map(function (c) { return { x: c.x, y: c.y, angle: c.angle }; });
    v.karts.forEach(function (c, i) {
      const s = shown[i];
      const tx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ty = c.y + Math.sin(c.angle) * c.speed * dt;
      s.x += (tx - s.x) * 0.5;
      s.y += (ty - s.y) * 0.5;
      s.angle += Math.atan2(Math.sin(c.angle - s.angle), Math.cos(c.angle - s.angle)) * 0.5;
    });
    v.karts.forEach(function (c, i) { drawKart(g, c, shown[i], i, now); });
  }

  // Controllers, like a console kart game: stick or D-pad ← → steers, RT / A is the gas,
  // LT / B brakes (hold it once stopped to reverse), X / RB drifts, Y / LB uses your item.
  function padPoll(pad, v) {
    if (v.phase !== 'race' && v.phase !== 'countdown' && v.phase !== 'finish') return null;
    const held = pad.held;
    const has = function (b) { return held.indexOf(b) !== -1; };
    let steer = Math.abs(pad.stick.x) > DEADZONE ? Math.round(pad.stick.x * 10) / 10 : 0;
    if (has('LEFT')) steer = -1;
    if (has('RIGHT')) steer = 1;
    const brake = has('B') || has('LT');
    return { type: 'drive', steer: steer, gas: !brake && (has('A') || has('RT')), brake: brake, drift: has('X') || has('RB') };
  }

  Ark.register('host', 'kart-race', {
    // Sound: a whoosh on a boost, a knock when karts bump, a chime for each lap.
    sounds: function (prev, v) {
      const out = [];
      const a = prev.events;
      const b = v.events;
      if (!a || !b) return out;
      if (b.boosts > a.boosts) out.push('whoosh');
      if (b.bumps > a.bumps + 2) out.push('puck');
      if (b.laps > a.laps) out.push('correct');
      if (b.cuts > (a.cuts || 0)) out.push('wrong');
      if (b.items > (a.items || 0)) out.push('eat');
      if (b.spins > (a.spins || 0)) out.push('crash');
      if (b.blocked > (a.blocked || 0)) out.push('lock');
      if (b.used > (a.used || 0) && !(b.boosts > a.boosts)) out.push('shoot');
      return out;
    },
    padHint: 'Stick or D-pad ← → steer · RT / A gas · LT / B brake, hold to reverse · X / RB drift · Y / LB item · Setup: ↑↓ row, ←→ change, A start · End: A rematch, Y settings',
    padPoll: padPoll,
    pad: function (btn, v, slot) {
      if (v.phase === 'setup') {
        if (!pads[slot]) pads[slot] = { row: 0 };
        const input = Ark.setup.pad(btn, v, ROWS, pads[slot]);
        if (view) {
          overlayKey = '';
          renderOverlay(view);
        }
        return input;
      }
      if (v.phase === 'over') {
        if (btn === 'A' || btn === 'START') return { type: 'rematch' };
        return btn === 'Y' ? { type: 'setup' } : null;
      }
      if (v.phase === 'race' && (btn === 'Y' || btn === 'LB')) return { type: 'item' };
      return null; // driving is read every frame by padPoll
    },
    mount: function (el) {
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'kr-host';
      root.innerHTML = '<div class="kr-hud"></div><div class="kr-arena"><canvas></canvas><div class="kr-overlay"></div></div>';
      el.appendChild(root);
      hud = root.querySelector('.kr-hud');
      arena = root.querySelector('.kr-arena');
      canvas = root.querySelector('canvas');
      overlay = root.querySelector('.kr-overlay');
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      trackNames = v.trackNames || trackNames;
      if (!view || v.race !== view.race || !v.karts) shown = null; // a new race: back to the grid
      view = v;
      viewAt = performance.now();
      renderHud(v);
      renderOverlay(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = hud = arena = canvas = overlay = view = shown = line = walls = null;
      lineKey = hudKey = overlayKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
