// Mini Golf drawing, shared by the TV and the phones. Everything is drawn in
// course units (20 x 12); the caller sets the canvas transform.
(function () {
  const WOOD = '#8b5a2b';
  const WOOD_DARK = '#5c3a1a';

  function path(g, poly) {
    g.beginPath();
    poly.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.closePath();
  }

  /** The hole: grass, hazards, walls, bumpers, windmill, tee and cup. */
  function drawHole(g, v, now) {
    const h = v.hole;
    // Grass, with mown stripes.
    path(g, h.bounds);
    g.fillStyle = '#2f8f46';
    g.fill();
    g.save();
    path(g, h.bounds);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < v.field.w; x += 2) g.fillRect(x, 0, 1, v.field.h);
    // Sand, speckled.
    h.sand.forEach(function (p) {
      path(g, p);
      g.fillStyle = '#e6cf8f';
      g.fill();
      g.fillStyle = 'rgba(150,110,50,0.35)';
      for (let i = 0; i < 40; i++) {
        const x = p[0][0] + ((i * 7.31) % 1) * (p[1][0] - p[0][0]);
        const y = p[0][1] + ((i * 3.77) % 1) * (p[2][1] - p[0][1]);
        g.fillRect(x, y, 0.06, 0.06);
      }
    });
    // Water, with drifting ripples.
    h.water.forEach(function (p) {
      path(g, p);
      g.fillStyle = '#2563eb';
      g.fill();
      g.save();
      path(g, p);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 0.06;
      const shift = (now / 1500) % 1;
      for (let y = 0; y < v.field.h; y += 0.8) {
        g.beginPath();
        for (let x = 0; x <= v.field.w; x += 0.5) g.lineTo(x, y + 0.12 * Math.sin((x + shift * 4) * 1.6 + y));
        g.stroke();
      }
      g.restore();
    });
    g.restore();
    // Tee mat.
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(h.tee[0] - 0.45, h.tee[1] - 0.45, 0.9, 0.9);
    // Cup and flag.
    g.fillStyle = '#0b0d0c';
    g.beginPath();
    g.arc(h.cup[0], h.cup[1], v.cupR, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 0.05;
    g.stroke();
    g.strokeStyle = '#f5f5f4';
    g.lineWidth = 0.07;
    g.beginPath();
    g.moveTo(h.cup[0], h.cup[1]);
    g.lineTo(h.cup[0] + 0.9, h.cup[1] - 0.9);
    g.stroke();
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.moveTo(h.cup[0] + 0.9, h.cup[1] - 0.9);
    g.lineTo(h.cup[0] + 0.35, h.cup[1] - 1.35);
    g.lineTo(h.cup[0] + 0.55, h.cup[1] - 0.55);
    g.closePath();
    g.fill();
    // Walls: wooden blocks and a wooden rail round the edge.
    h.blocks.forEach(function (p) {
      path(g, p);
      g.fillStyle = WOOD;
      g.fill();
      g.strokeStyle = WOOD_DARK;
      g.lineWidth = 0.08;
      g.stroke();
    });
    path(g, h.bounds);
    g.strokeStyle = WOOD;
    g.lineWidth = 0.3;
    g.lineJoin = 'round';
    g.stroke();
    // Bumpers.
    h.bumpers.forEach(function (b) {
      g.fillStyle = '#dc2626';
      g.beginPath();
      g.arc(b[0], b[1], b[2], 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fecaca';
      g.lineWidth = 0.1;
      g.beginPath();
      g.arc(b[0], b[1], b[2] * 0.65, 0, Math.PI * 2);
      g.stroke();
    });
    // Windmill blade.
    if (h.windmill) {
      const m = h.windmill;
      g.save();
      g.translate(m.x, m.y);
      g.rotate(v.millAngle);
      g.fillStyle = '#f8fafc';
      g.strokeStyle = '#475569';
      g.lineWidth = 0.06;
      g.fillRect(-m.len, -0.12, m.len * 2, 0.24);
      g.strokeRect(-m.len, -0.12, m.len * 2, 0.24);
      g.restore();
      g.fillStyle = '#b91c1c';
      g.beginPath();
      g.arc(m.x, m.y, 0.3, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** A ball (unless it's in the cup). mine: drawn a little bigger with a halo. */
  function drawBall(g, v, b, color, mine) {
    if (b.holed) return;
    const r = v.ballR * (mine ? 1.25 : 1);
    if (mine) {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.arc(b.x, b.y, r * 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 6;
    g.fillStyle = color;
    g.beginPath();
    g.arc(b.x, b.y, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#fff';
    g.lineWidth = 0.06;
    g.stroke();
  }

  /** The aim: a dotted line in the shot's direction, longer with more power. */
  function drawAim(g, b, aim, color) {
    if (b.holed || b.done) return;
    const len = 0.7 + aim.power * 5;
    const dx = Math.cos(aim.angle);
    const dy = Math.sin(aim.angle);
    g.strokeStyle = color;
    g.globalAlpha = aim.power ? 0.95 : 0.45;
    g.lineWidth = 0.09;
    g.setLineDash([0.18, 0.16]);
    g.beginPath();
    g.moveTo(b.x + dx * 0.35, b.y + dy * 0.35);
    g.lineTo(b.x + dx * len, b.y + dy * len);
    g.stroke();
    g.setLineDash([]);
    // Arrow head.
    const ex = b.x + dx * len;
    const ey = b.y + dy * len;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(ex + dx * 0.3, ey + dy * 0.3);
    g.lineTo(ex - dy * 0.18, ey + dx * 0.18);
    g.lineTo(ex + dy * 0.18, ey - dx * 0.18);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  /** How a hole's score is called, relative to par. */
  function scoreName(strokes, par, maxStrokes) {
    if (strokes > maxStrokes) return 'picked up';
    if (strokes === 1) return 'hole in one!';
    const d = strokes - par;
    return { '-3': 'albatross!', '-2': 'eagle!', '-1': 'birdie', 0: 'par', 1: 'bogey', 2: 'double bogey' }[d] || (d > 0 ? '+' + d : d + '');
  }

  /** The scorecard table: holes across, par and both players down. */
  function cardHtml(v, names) {
    const n = v.holeCount;
    let head = '<tr><th>Hole</th>';
    let par = '<tr class="par"><th>Par</th>';
    for (let i = 0; i < n; i++) {
      head += '<th>' + (i + 1) + '</th>';
      par += '<td>' + (v.pars[i] || '') + '</td>';
    }
    head += '<th>Total</th></tr>';
    const parTotal = v.pars.slice(0, v.card[0].length).reduce(function (s, x) { return s + x; }, 0);
    par += '<td>' + v.pars.reduce(function (s, x) { return s + x; }, 0) + '</td></tr>';
    const rows = [0, 1].map(function (slot) {
      let tr = '<tr class="p' + (slot + 1) + '"><th>' + names[slot] + '</th>';
      for (let i = 0; i < n; i++) {
        const s = v.card[slot][i];
        const cls = s === undefined ? '' : s > v.maxStrokes ? 'up' : s < v.pars[i] ? 'under' : s > v.pars[i] ? 'over' : 'even';
        tr += '<td class="' + cls + (i === v.holeNo - 1 ? ' now' : '') + '">' + (s === undefined ? '' : s) + '</td>';
      }
      const total = v.card[slot].reduce(function (s, x) { return s + x; }, 0);
      const diff = total - parTotal;
      return tr + '<td class="total">' + total + (v.card[slot].length ? ' <small>(' + (diff > 0 ? '+' : '') + (diff || 'E') + ')</small>' : '') + '</td></tr>';
    });
    return '<table class="mg-card">' + head + par + rows.join('') + '</table>';
  }

  const ROWS = [{ key: 'holes', title: 'Holes', fmt: function (n) { return n + ' holes'; } }];

  window.ArkGolf = { drawHole: drawHole, drawBall: drawBall, drawAim: drawAim, scoreName: scoreName, cardHtml: cardHtml, ROWS: ROWS };
})();
