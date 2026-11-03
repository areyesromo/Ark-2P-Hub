// Brick Breaker Duel's bricks, drawn the same on the TV and the phone (in field units: the
// caller scales the canvas). Power bricks are white with a mark: a bar (🔻 shrink), a dot
// (⚪ another ball) or three bars (🧱 a row for your rival).
(function () {
  const ROW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#a3e635'];

  function drawBrick(g, f, b) {
    const x = b[1] * f.brickW + 0.04;
    const y = f.top + b[0] * f.brickH + 0.04;
    const w = f.brickW - 0.08;
    const h = f.brickH - 0.08;
    g.fillStyle = b[2] ? '#f8fafc' : ROW_COLORS[b[0] % ROW_COLORS.length];
    g.fillRect(x, y, w, h);
    if (!b[2]) return;
    g.fillStyle = '#0f172a';
    if (b[2] === 'shrink') g.fillRect(x + w * 0.25, y + h * 0.4, w * 0.5, h * 0.2);
    else if (b[2] === 'multi') {
      g.beginPath();
      g.arc(x + w / 2, y + h / 2, h * 0.28, 0, Math.PI * 2);
      g.fill();
    } else {
      for (let i = 0; i < 3; i++) g.fillRect(x + w * (0.2 + i * 0.25), y + h * 0.2, w * 0.1, h * 0.6);
    }
  }

  window.ArkBricks = { drawBrick: drawBrick };
})();
