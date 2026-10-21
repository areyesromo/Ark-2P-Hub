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
  // The racers and tyres (shared with the server): pick panel and kart shapes once loaded.
  Ark.loadScript('/games/kart-race/racers.js').then(function () {
    window.ArkKartRacers.RACERS.forEach(spriteFor); // start loading the kart pictures before the race
    overlayKey = hudKey = '';
    if (view && overlay) {
      renderOverlay(view);
      renderHud(view);
    }
  });
  // Kart bodies by the racer's type: the outline (nose at +x), how far the nose reaches and the body's half width.
  const SHAPES = {
    classic: { nose: 0.55, half: 0.28, pts: [[0.55, 0], [0.3, -0.28], [-0.5, -0.28], [-0.5, 0.28], [0.3, 0.28]] },
    long: { nose: 0.75, half: 0.26, pts: [[0.75, 0], [0.4, -0.26], [-0.5, -0.26], [-0.5, 0.26], [0.4, 0.26]] },
    stubby: { nose: 0.42, half: 0.32, pts: [[0.42, 0], [0.25, -0.32], [-0.45, -0.32], [-0.45, 0.32], [0.25, 0.32]] },
    wings: { nose: 0.55, half: 0.25, pts: [[0.55, 0], [0.3, -0.25], [0.2, -0.25], [0.2, -0.42], [-0.1, -0.42], [-0.1, -0.25], [-0.5, -0.25], [-0.5, 0.25], [-0.1, 0.25], [-0.1, 0.42], [0.2, 0.42], [0.2, 0.25], [0.3, 0.25]] },
    boxy: { nose: 0.45, half: 0.33, pts: [[0.45, -0.33], [-0.5, -0.33], [-0.5, 0.33], [0.45, 0.33]] },
    pointed: { nose: 0.6, half: 0.22, pts: [[0.6, 0], [0.1, -0.22], [-0.5, -0.22], [-0.5, 0.22], [0.1, 0.22]] },
  };
  const STAT_ROWS = [['speed', 'Speed'], ['accel', 'Accel.'], ['handling', 'Handling'], ['weight', 'Weight']];
  // Controllers on the setup screen: the settings rows, then their own racer and tyres.
  const PICK_ROWS = ['racer', 'tyre'];
  const esc = Ark.escapeHtml;
  let trackNames = []; // from the server's views
  const ROWS = [
    { key: 'track', title: 'Track', fmt: function (n) { return n === 0 ? 'Mixed' : trackNames[n - 1] || 'Track ' + n; } },
    { key: 'laps', title: 'Laps', fmt: function (n) { return n + ' laps'; } },
    { key: 'races', title: 'Races', fmt: function (n) { return n === 1 ? 'One race' : 'Best of ' + n; } },
    { key: 'items', title: 'Items (? boxes)', fmt: function (n) { return n ? 'On' : 'Off'; } },
  ];
  Ark.loadScript('/games/kart-race/items.js').then(function () { hudKey = ''; });
  /** An item's emoji (from items.js, once it's here). */
  function itemIcon(kind) {
    return window.ArkKartItems && ArkKartItems[kind] ? ArkKartItems[kind].emoji : '🎁';
  }
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
  let barrier = null; // { road, edge }: the road and its barriers (see track.js)
  let barrierPic = null; // the barriers drawn once, at the canvas's size: { key, canvas }
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

  /** The dial's top: room for the fastest racer on a boost. */
  function gaugeTop(v) {
    return v.boostSpeed + 2;
  }

  function gaugeHtml(v, k) {
    const top = gaugeTop(v);
    let ticks = '';
    for (let kmh = 0; kmh <= top * KMH; kmh += 20) {
      const f = kmh / (top * KMH);
      ticks += '<path d="M' + dialAt(f, 40) + ' L' + dialAt(f, 46) + '"/>';
    }
    return '<div class="kr-gauge"><svg viewBox="0 0 100 86">' +
      '<path class="track" d="' + dialArc(0, 1, 43) + '"/>' +
      '<path class="red" d="' + dialArc((k.top || v.maxSpeed) / top, 1, 43) + '"/>' +
      '<path class="fill" d="' + dialArc(0, 1, 43) + '" pathLength="1"/>' +
      '<g class="ticks">' + ticks + '</g>' +
      '<line class="needle" x1="50" y1="50" x2="50" y2="14"/><circle cx="50" cy="50" r="4"/></svg>' +
      '<div class="read"><b>0</b><span>km/h</span></div><div class="drift"><i></i></div></div>';
  }

  /** Move the needles and readouts (every view; the rest of the HUD only changes now and then). */
  function updateGauges(v) {
    hud.querySelectorAll('.kr-gauge').forEach(function (el, slot) {
      const k = v.karts[slot];
      const f = Math.min(1, Math.abs(k.speed) / gaugeTop(v));
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

  /** "🔥 Rex · 🏁" under a player's name. */
  function racerLine(k) {
    const R = window.ArkKartRacers;
    if (!R || !k.racer) return '';
    const r = R.racer(k.racer);
    return '<div class="racer"><img src="' + r.portrait + '" alt=""> ' + r.name + ' · ' + R.tyre(k.tyre).emoji + '</div>';
  }

  /** One stat as 6 cells: the racer's own, plus (green) or minus (red) for the tyres. */
  function statBar(base, mod) {
    let h = '';
    for (let i = 1; i <= 6; i++) {
      const cls = mod > 0 && i > base && i <= base + mod ? 'plus' : mod < 0 && i > base + mod && i <= base ? 'minus' : i <= base ? 'on' : '';
      h += '<i class="' + cls + '"></i>';
    }
    return h;
  }

  /** Both players' racers and tyres on the setup screen; a controller's Racer / Tyres row outlined. */
  function picksHtml(v) {
    const R = window.ArkKartRacers;
    if (!R || !v.picks) return '';
    return '<div class="kr-picks-tv">' + [0, 1].map(function (slot) {
      const pick = v.picks[slot];
      const r = R.racer(pick.racer);
      const t = R.tyre(pick.tyre);
      const row = v.players[slot].local && pads[slot] ? PICK_ROWS[(pads[slot].row || 0) - ROWS.length] : null;
      const f = function (key) { return row === key ? ' focus p' + (slot + 1) : ''; };
      return '<div class="pick p' + (slot + 1) + '"><div class="name">' + nameOf(v, slot) + '</div>' +
        '<div class="line' + f('racer') + '"><img src="' + r.portrait + '" alt=""> <b>' + r.name + '</b> <span class="muted">' + R.TYPES[r.type].label + '</span></div>' +
        '<div class="line' + f('tyre') + '"><span class="em">' + t.emoji + '</span> ' + t.name + ' tyres</div>' +
        '<div class="kr-car">' + (r.sprite ? '<img class="kr-kart" src="' + r.sprite + '" alt="">' : '') + '<div class="rows">' +
        STAT_ROWS.map(function (s) {
          return '<div class="stat"><span>' + s[1] + '</span><div class="bar">' + statBar(r.stats[s[0]], t.mod[s[0]] || 0) + '</div></div>';
        }).join('') + '</div></div></div>';
    }).join('') + '</div>';
  }

  /** Ark.setup.focus for the settings rows only (a player on their Racer / Tyres row is outlined in the picks panel instead). */
  function settingsFocus(v) {
    const onPicks = function (slot) { return pads[slot] && (pads[slot].row || 0) >= ROWS.length; };
    const focus = Ark.setup.focus(v, ROWS, [0, 1].map(function (slot) { return onPicks(slot) ? { row: 0 } : pads[slot]; }));
    Object.keys(focus).forEach(function (key) {
      focus[key] = focus[key].split(' ').filter(function (c) { return !onPicks(Number(c.slice(1)) - 1); }).join(' ');
      if (!focus[key]) delete focus[key];
    });
    return focus;
  }

  /** A controller's ← / → on its Racer or Tyres row: the next one along (wrapping round). */
  function cyclePick(v, slot, key, dir) {
    const R = window.ArkKartRacers;
    if (!R || !v.picks) return null;
    const list = key === 'racer' ? R.RACERS : R.TYRES;
    const i = list.map(function (x) { return x.id; }).indexOf(v.picks[slot][key]);
    return { type: key, id: list[(i + dir + list.length) % list.length].id };
  }

  function renderHud(v) {
    let html = '';
    if (v.karts) {
      const side = function (slot) {
        const k = v.karts[slot];
        return '<div class="kr-side p' + (slot + 1) + '"><div class="info"><div class="name">' + nameOf(v, slot) + '</div>' +
          '<div class="pos">' + ordinal(v.positions[slot]) + (k.items && k.items.length ? ' <span class="item"><b>' + itemIcon(k.items[0]) + '</b>' + k.items.slice(1).map(itemIcon).join('') + '</span>' : '') + (k.gold ? ' <span class="item">🌟</span>' : '') + '</div>' +
          '<div class="lap">' + (k.finished ? '🏁 Finished' : k.cut ? '<span class="cut">⛔ Shortcut!</span>' : 'Lap ' + Math.min(v.laps, k.laps + 1) + ' / ' + v.laps) + '</div>' +
          racerLine(k) + '<div class="coins">🟡 ' + (k.coins || 0) + ' / 15</div><div class="laptime"></div></div>' + gaugeHtml(v, k) + '</div>';
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
      html = '<div class="panel kr-setup"><div class="title">🏎️ Kart Race</div><div class="kr-setup-row">' + Ark.setup.html(v, ROWS, settingsFocus(v)) + '<div class="kr-setup-col">' + previewHtml(v, v.settings.track) + picksHtml(v) + '</div></div>' +
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

  /**
   * The barriers as one picture: the area a kart can reach, widened by the barrier's thickness
   * and filled with red and white stripes, then the reachable area itself cut back out. Drawn as
   * areas, not lines, so a barrier shared by two stretches is drawn once and the inside of a
   * tight bend doesn't tie itself in knots.
   */
  function barrierImage(v) {
    const key = v.track.index + ':' + canvas.width + 'x' + canvas.height;
    if (barrierPic && barrierPic.key === key) return barrierPic.canvas;
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    const k = canvas.width / v.field.w;
    const stripes = document.createElement('canvas');
    stripes.width = stripes.height = 12;
    const sg = stripes.getContext('2d');
    sg.fillStyle = '#f1f5f9';
    sg.fillRect(0, 0, 12, 12);
    sg.fillStyle = '#ef4444';
    sg.beginPath();
    sg.moveTo(0, 0); sg.lineTo(6, 0); sg.lineTo(12, 6); sg.lineTo(12, 12); sg.lineTo(0, 0);
    sg.moveTo(0, 6); sg.lineTo(6, 12); sg.lineTo(0, 12);
    sg.fill();
    // Fill one shape (built in field units) in pixels, so the stripes keep their size.
    const fill = function (build, style) {
      g.setTransform(k, 0, 0, k, 0, 0);
      g.beginPath();
      build();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = style;
      g.fill();
    };
    const area = function (extra, style) {
      const L = Road.edgeLines(barrier.road, barrier.edge, extra);
      const line = barrier.road.line;
      const n = line.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        fill(function () {
          g.moveTo(L.left[i][0], L.left[i][1]);
          g.lineTo(L.left[j][0], L.left[j][1]);
          g.lineTo(L.right[j][0], L.right[j][1]);
          g.lineTo(L.right[i][0], L.right[i][1]);
          g.closePath();
        }, style);
        // A disc too, so the inside of a tight bend (where the strip folds over) has no gaps.
        const r = Math.min(barrier.edge.left[i], barrier.edge.right[i]) + extra;
        fill(function () { g.arc(line[i][0], line[i][1], r, 0, Math.PI * 2); }, style);
      }
    };
    area(Road.BARRIER + 0.06, '#1f2937'); // a dark rim outside
    area(Road.BARRIER, g.createPattern(stripes, 'repeat'));
    g.globalCompositeOperation = 'destination-out';
    area(0, '#000');
    barrierPic = { key: key, canvas: c };
    return c;
  }

  function drawTrack(g, v) {
    const W = v.trackWidth;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // Tyre barriers round the grass verge (drawn once per track and size, then reused).
    g.drawImage(barrierImage(v), 0, 0, v.field.w, v.field.h);
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

  /** Coins: gold discs, squashed side to side so they look like they're spinning. */
  function drawCoins(g, v, now) {
    (v.coins || []).forEach(function (c, i) {
      const w = Math.abs(Math.cos(now / 300 + i * 0.7));
      g.save();
      g.translate(c.x, c.y);
      g.scale(0.25 + 0.75 * w, 1);
      g.fillStyle = '#a16207';
      g.beginPath();
      g.arc(0, 0, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#facc15';
      g.beginPath();
      g.arc(0, 0, 0.24, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(-0.04, -0.15, 0.08, 0.3);
      g.restore();
    });
  }

  /** Webs and oil on the road, the Bouncers, Seekers and Bombs, and bombs going off. */
  function drawTrackItems(g, v, now) {
    (v.oils || []).forEach(function (o) {
      g.fillStyle = 'rgba(15, 23, 42, 0.85)';
      g.beginPath();
      g.ellipse(o.x, o.y, 0.62, 0.48, 0.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(167, 139, 250, 0.6)'; // the sheen
      g.lineWidth = 0.06;
      g.beginPath();
      g.arc(o.x - 0.1, o.y - 0.08, 0.28, 3.6, 5.2);
      g.stroke();
    });
    (v.webs || []).forEach(function (w) {
      g.strokeStyle = 'rgba(241, 245, 249, 0.85)';
      g.lineWidth = 0.04;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        g.beginPath();
        g.moveTo(w.x - Math.cos(a) * 0.55, w.y - Math.sin(a) * 0.55);
        g.lineTo(w.x + Math.cos(a) * 0.55, w.y + Math.sin(a) * 0.55);
        g.stroke();
      }
      [0.2, 0.38, 0.55].forEach(function (r) {
        g.beginPath();
        g.arc(w.x, w.y, r, 0, Math.PI * 2);
        g.stroke();
      });
    });
    (v.shots || []).forEach(function (s) {
      g.save();
      g.translate(s.x, s.y);
      if (s.kind === 'bouncer') {
        g.rotate(now / 80);
        g.fillStyle = '#2dd4bf';
        g.beginPath();
        g.arc(0, 0, 0.3, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#f0fdfa';
        g.lineWidth = 0.06;
        g.beginPath();
        g.arc(0, 0, 0.18, 0, Math.PI * 1.3);
        g.stroke();
      } else if (s.kind === 'seeker') {
        g.rotate(s.angle);
        g.fillStyle = '#ef4444';
        g.beginPath();
        g.moveTo(0.4, 0);
        g.lineTo(-0.3, -0.24);
        g.lineTo(-0.18, 0);
        g.lineTo(-0.3, 0.24);
        g.closePath();
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 0.05;
        g.stroke();
      } else if (s.kind === 'bomb') {
        g.fillStyle = '#111827';
        g.beginPath();
        g.arc(0, 0, 0.34, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#6b7280';
        g.lineWidth = 0.05;
        g.stroke();
        // The fuse blinks faster as it burns down.
        const blink = Math.floor(now / Math.max(60, (s.fuse || 0) / 6)) % 2;
        g.fillStyle = blink ? '#f97316' : '#facc15';
        g.beginPath();
        g.arc(0.2, -0.28, 0.09, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    });
    (v.blasts || []).forEach(function (b) {
      const t = Math.min(1, b.age / 600);
      g.strokeStyle = 'rgba(249, 115, 22, ' + (1 - t) + ')';
      g.fillStyle = 'rgba(250, 204, 21, ' + 0.4 * (1 - t) + ')';
      g.lineWidth = 0.2;
      g.beginPath();
      g.arc(b.x, b.y, 0.5 + 2 * t, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });
  }

  /** ? boxes, spinning gently in rainbow colours, and the bananas on the road. */
  function drawBoxes(g, v, now) {
    v.boxes.forEach(function (b, i) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(now / 700 + i);
      // A gold double box (two items) or a rainbow one.
      g.fillStyle = b.double ? '#eab308' : 'hsl(' + ((now / 8 + i * 40) % 360) + ', 85%, 60%)';
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
      g.fillText(b.double ? '2' : '?', 0, 0.04);
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

  // Top-down kart pictures (nose up), loaded on first use: src -> Image.
  const sprites = {};
  // Karts (and their effects) are laid out for a picture 1.25 long, then scaled up to the size
  // racers.js asks for.
  const KART_LEN = 1.25;

  /** A racer's kart picture, once it has loaded (null until then, or if they have none yet). */
  function spriteFor(racer) {
    if (!racer || !racer.sprite) return null;
    let img = sprites[racer.sprite];
    if (!img) {
      img = sprites[racer.sprite] = new Image();
      img.src = racer.sprite;
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  function drawKart(g, k, s, slot, now) {
    const R = window.ArkKartRacers;
    const racer = R && k.racer ? R.racer(k.racer) : null;
    const shape = SHAPES[racer ? racer.shape : 'classic'];
    const wheel = R && k.tyre ? R.tyre(k.tyre).wheel : { len: 0.24, wide: 0.14 };
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.angle + (k.spin ? now / 60 : 0)); // spinning out after a banana
    const big = (R && R.KART_LEN ? R.KART_LEN : KART_LEN) / KART_LEN;
    const FX = R && R.KART_FX ? R.KART_FX : { ringLong: 0.75, ringWide: 0.525, starGlow: 0.72, starPulse: 0.06, magnetArc: 0.68, magnetGap: 0.22, magnetSweep: 0.18 };
    g.scale(big, big);
    if (k.hover) {
      // Hovering: a shadow on the ground below, the kart lifted a little bigger above it.
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(-0.15, 0.2, 0.7, 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.scale(1.12, 1.12);
    }
    if (k.shrunk) g.scale(0.7, 0.7); // Thunder
    function starGlow() {
      // Star: a pulsing rainbow glow.
      g.fillStyle = 'hsla(' + Math.floor(now / 4) % 360 + ', 95%, 60%, 0.45)';
      g.beginPath();
      g.arc(0, 0, FX.starGlow + FX.starPulse * Math.sin(now / 80), 0, Math.PI * 2);
      g.fill();
    }
    const pic = spriteFor(racer);
    if (k.star && !pic) starGlow();
    if (pic) {
      // The racer's kart picture over a ring in the player's colour (both may race the same racer).
      g.fillStyle = colors[slot];
      g.globalAlpha = 0.55;
      g.beginPath();
      g.ellipse(0, 0, FX.ringLong, FX.ringWide, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = colors[slot];
      g.lineWidth = 0.08;
      g.stroke();
      if (k.star) starGlow(); // over the ring, so it shows all round
      const w = (KART_LEN * pic.naturalWidth) / pic.naturalHeight;
      g.save();
      g.rotate(Math.PI / 2); // the picture's nose points up; the kart's points along +x
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 8;
      g.drawImage(pic, -w / 2, -KART_LEN / 2, w, KART_LEN);
      g.restore();
    } else {
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 8;
      // Wheels.
      g.fillStyle = '#111827';
      const wy = shape.half + 0.06; // wheels just outside the body
      [[-0.32, -wy], [0.28, -wy], [-0.32, wy], [0.28, wy]].forEach(function (w) { g.fillRect(w[0] - wheel.len / 2, w[1] - wheel.wide / 2, wheel.len, wheel.wide); });
      // Body: the racer's shape in the player's colour, with a stripe in the racer's type colour.
      g.fillStyle = colors[slot];
      g.beginPath();
      shape.pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#fff';
      g.lineWidth = 0.05;
      g.stroke();
      if (racer) {
        g.fillStyle = racer.stripe;
        g.fillRect(-0.45, -0.05, shape.nose - 0.1 + 0.45, 0.1);
      }
      // Driver's helmet.
      g.fillStyle = '#f8fafc';
      g.beginPath();
      g.arc(-0.1, 0, 0.14, 0, Math.PI * 2);
      g.fill();
    }
    const tail = pic ? KART_LEN / 2 - 0.5 : 0; // a kart picture reaches further back
    // Boost flame and drift sparks, over the kart so they always show.
    if (k.boosting) {
      // Exhaust flame.
      g.fillStyle = Math.floor(now / 60) % 2 ? '#f97316' : '#facc15';
      g.beginPath();
      g.moveTo(-0.5 - tail, -0.16);
      g.lineTo(-0.95 - tail - Math.random() * 0.25, 0);
      g.lineTo(-0.5 - tail, 0.16);
      g.fill();
    }
    if (k.drifting) {
      // Sparks off the back wheels: blue while charging, orange once a mini-boost is ready.
      g.fillStyle = k.driftCharge >= 1 ? '#fb923c' : '#60a5fa';
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        g.beginPath();
        g.arc(-0.45 - tail - Math.random() * 0.35, side * (0.34 + Math.random() * 0.15), 0.05 + Math.random() * 0.05, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (k.frozen) {
      // Freeze: an icy tint and a frosty ring.
      g.fillStyle = 'rgba(186, 230, 253, 0.35)';
      g.beginPath();
      g.arc(0, 0, 0.7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#e0f2fe';
      g.lineWidth = 0.06;
      g.setLineDash([0.12, 0.1]);
      g.stroke();
      g.setLineDash([]);
    }
    if (k.webbed) {
      // Caught in a web: strands over the kart.
      g.strokeStyle = 'rgba(241, 245, 249, 0.9)';
      g.lineWidth = 0.04;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-0.6, -0.4 + i * 0.4);
        g.lineTo(0.6, 0.4 - i * 0.4);
        g.stroke();
      }
    }
    if (k.oiled) {
      // Oily: a dark slick sheen.
      g.fillStyle = 'rgba(30, 27, 75, 0.45)';
      g.beginPath();
      g.ellipse(0, 0, 0.7, 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (k.magnet) {
      // Magnet: arcs pulsing out in front.
      g.strokeStyle = 'rgba(248, 113, 113, 0.8)';
      g.lineWidth = 0.06;
      for (let i = 0; i < 2; i++) {
        const r = FX.magnetArc + i * FX.magnetGap + ((now / 400) % 1) * FX.magnetSweep;
        g.beginPath();
        g.arc(0, 0, r, -0.6, 0.6);
        g.stroke();
      }
    }
    if (k.shield) {
      g.strokeStyle = 'rgba(125, 211, 252, ' + (0.6 + 0.3 * Math.sin(now / 120)) + ')';
      g.lineWidth = 0.1;
      g.beginPath();
      g.arc(0, 0, pic ? 0.9 : 0.75, 0, Math.PI * 2);
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
      // The same road and barriers the server drives on (shared down the middle where two
      // stretches run close together).
      const road = Road.build(v.track.points);
      line = road.line;
      barrier = { road: road, edge: Road.barriers(road, v.trackWidth / 2, v.wallOut) };
      barrierPic = null;
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
    drawCoins(g, v, now);
    drawBoxes(g, v, now);
    drawTrackItems(g, v, now);
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
      if (b.zapped > (a.zapped || 0)) out.push('boom');
      if (b.frozen > (a.frozen || 0)) out.push('splash');
      if (b.fired > (a.fired || 0)) out.push('shoot');
      if (b.exploded > (a.exploded || 0)) out.push('boom');
      if (b.snagged > (a.snagged || 0)) out.push('drop');
      if (b.swapped > (a.swapped || 0)) out.push('lock');
      if (b.starHits > (a.starHits || 0)) out.push('fanfare');
      if (b.coins > (a.coins || 0)) out.push('tick');
      if (b.coinsLost > (a.coinsLost || 0)) out.push('drop');
      if (b.spins > (a.spins || 0)) out.push('crash');
      if (b.blocked > (a.blocked || 0)) out.push('lock');
      if (b.used > (a.used || 0) && !(b.boosts > a.boosts)) out.push('shoot');
      return out;
    },
    padHint: 'Stick or D-pad ← → steer · RT / A gas · LT / B brake, hold to reverse · X / RB drift · Y / LB item · Setup: ↑↓ row (the last two are your racer and tyres), ←→ change, A start · End: A rematch, Y settings',
    padPoll: padPoll,
    pad: function (btn, v, slot) {
      if (v.phase === 'setup') {
        if (!pads[slot]) pads[slot] = { row: 0 };
        const rows = ROWS.concat(PICK_ROWS.map(function (key) { return { key: key }; }));
        const row = pads[slot].row || 0;
        // ← → on the Racer / Tyres rows cycles this player's pick; everything else is the usual setup.
        const input = row >= ROWS.length && (btn === 'LEFT' || btn === 'RIGHT')
          ? cyclePick(v, slot, PICK_ROWS[row - ROWS.length], btn === 'LEFT' ? -1 : 1)
          : Ark.setup.pad(btn, v, rows, pads[slot]);
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
      root = hud = arena = canvas = overlay = view = shown = line = barrier = barrierPic = null;
      lineKey = hudKey = overlayKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
