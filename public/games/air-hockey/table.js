// Air hockey drawing shared by the TV and the phones. Everything is drawn in
// table units (the caller sets the canvas transform), so the TV can draw the
// table sideways and each phone upright, facing its player.
(function () {
  const RINK = 0.35; // rink border around the playing surface, in table units

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /** Rink, surface, markings and goal mouths. */
  function drawTable(g, f, colors) {
    roundRect(g, -RINK, -RINK, f.w + 2 * RINK, f.h + 2 * RINK, 1.6);
    g.fillStyle = '#1b2036';
    g.fill();
    roundRect(g, 0, 0, f.w, f.h, 1.3);
    g.fillStyle = '#081022';
    g.fill();

    g.strokeStyle = 'rgba(160,190,255,0.18)';
    g.lineWidth = 0.06;
    g.beginPath();
    g.moveTo(f.w / 2, 0);
    g.lineTo(f.w / 2, f.h);
    g.stroke();
    g.beginPath();
    g.arc(f.w / 2, f.h / 2, 1.4, 0, Math.PI * 2);
    g.stroke();

    [0, 1].forEach(function (slot) {
      const x = slot === 0 ? 0 : f.w;
      g.strokeStyle = colors[slot];
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(x, f.h / 2, f.goalH / 2 + 0.6, slot === 0 ? -Math.PI / 2 : Math.PI / 2, slot === 0 ? Math.PI / 2 : Math.PI * 1.5);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = g.shadowColor = colors[slot];
      g.shadowBlur = 16;
      g.fillRect(slot === 0 ? -RINK : f.w, f.h / 2 - f.goalH / 2, RINK, f.goalH);
      g.shadowBlur = 0;
    });
  }

  function drawMallet(g, f, x, y, color) {
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, f.malletR, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.arc(x, y, f.malletR * 0.62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, f.malletR * 0.32, 0, Math.PI * 2);
    g.fill();
  }

  function drawPuck(g, f, x, y) {
    g.shadowColor = '#ffffff';
    g.shadowBlur = 14;
    g.fillStyle = '#f5f7ff';
    g.beginPath();
    g.arc(x, y, f.puckR, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }

  /** Where to draw the puck now: the last snapshot moved on by its velocity, kept on the table. */
  function puckNow(view, sinceMs) {
    const f = view.field;
    const p = view.puck;
    const dt = view.phase === 'play' ? Math.min(sinceMs, 100) / 1000 : 0;
    return {
      x: Math.min(f.w + f.puckR, Math.max(-f.puckR, p.x + p.vx * dt)),
      y: Math.min(f.h - f.puckR, Math.max(f.puckR, p.y + p.vy * dt)),
    };
  }

  /** Ease drawn mallets towards the latest server positions (hides the ~30 Hz steps). */
  function easeMallets(shown, view) {
    if (!shown) return view.mallets.map(function (m) { return { x: m.x, y: m.y }; });
    view.mallets.forEach(function (m, i) {
      shown[i].x += (m.x - shown[i].x) * 0.5;
      shown[i].y += (m.y - shown[i].y) * 0.5;
    });
    return shown;
  }

  function playerColors() {
    const css = getComputedStyle(document.documentElement);
    return [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
  }

  window.ArkAirHockeyTable = {
    RINK: RINK,
    drawTable: drawTable,
    drawMallet: drawMallet,
    drawPuck: drawPuck,
    puckNow: puckNow,
    easeMallets: easeMallets,
    playerColors: playerColors,
  };
})();
