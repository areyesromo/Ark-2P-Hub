// Pong on the phone (server/games/pong.js): the whole court, turned so your paddle is at the
// bottom, and you drag left and right anywhere on it to move your paddle (it follows your
// finger at its top speed). No need to watch the TV.
(function () {
  Ark.loadCss('/games/pong/style.css');
  const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

  let root = null;
  let court = null;
  let info = null;
  let api = null;
  let view = null;
  let viewAt = 0;
  let raf = null;
  let lastKey = '';
  let lastSent = 0;
  let pendingY = null;
  let sendTimer = null;
  let colors = null;

  function send() {
    sendTimer = null;
    if (pendingY === null) return;
    api.send({ type: 'move', y: pendingY });
    lastSent = Date.now();
    pendingY = null;
  }

  /**
   * The court turned a quarter so your goal is at the bottom. Field (x, y) to the phone's
   * (0..1, 0..1): player 1 (left goal) has x going up and y going right; player 2 (right goal)
   * the other way round.
   */
  function toScreen(v, x, y) {
    const f = v.field;
    return v.you === 0 ? [y / f.h, 1 - x / f.w] : [1 - y / f.h, x / f.w];
  }

  // Follow the finger across the court: its left-right position is where your paddle goes.
  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    if (!view) return;
    e.preventDefault();
    if (e.type === 'pointerdown' && court.setPointerCapture) court.setPointerCapture(e.pointerId);
    const r = court.getBoundingClientRect();
    const sx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = view.you === 0 ? sx : 1 - sx; // back to the field's top-to-bottom
    pendingY = Math.round(y * 1000) / 1000;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    const v = view;
    if (!v || !v.field || !court) return;
    const box = court.parentElement.getBoundingClientRect();
    // As big as fits, at the court's shape (9 wide by 16 tall once turned).
    const f = v.field;
    const cssW = Math.floor(Math.min(box.width, (box.height * f.h) / f.w));
    const cssH = Math.floor((cssW * f.w) / f.h);
    const dpr = window.devicePixelRatio || 1;
    if (court.width !== Math.round(cssW * dpr) || court.height !== Math.round(cssH * dpr)) {
      court.width = Math.round(cssW * dpr);
      court.height = Math.round(cssH * dpr);
      court.style.width = cssW + 'px';
      court.style.height = cssH + 'px';
    }
    const W = court.width;
    const H = court.height;
    const g = court.getContext('2d');
    g.clearRect(0, 0, W, H);
    // The halfway line.
    g.strokeStyle = 'rgba(255,255,255,0.15)';
    g.setLineDash([W / 30, W / 30]);
    g.lineWidth = Math.max(2, W / 120);
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
    g.setLineDash([]);
    // Paddles: yours at the bottom in your colour.
    const unit = W / f.h; // pixels per field unit across the phone
    [0, 1].forEach(function (slot) {
      const x = slot === 0 ? f.paddleX + f.paddleW / 2 : f.w - f.paddleX - f.paddleW / 2;
      const c = toScreen(v, x, v.paddles[slot]);
      const len = f.paddleH * unit;
      const thick = f.paddleW * unit;
      g.fillStyle = colors[slot];
      g.fillRect(c[0] * W - len / 2, c[1] * H - thick / 2, len, thick);
    });
    // The ball, moved on by its speed since the last view so it doesn't stutter.
    if (v.phase === 'play' || v.phase === 'point') {
      const dt = v.phase === 'play' ? Math.min(0.05, (performance.now() - viewAt) / 1000) : 0; // about one view
      const bx = Math.min(f.w - f.ballR, Math.max(f.ballR, v.ball.x + v.ball.vx * dt));
      const by = Math.min(f.h - f.ballR, Math.max(f.ballR, v.ball.y + v.ball.vy * dt));
      const p = toScreen(v, bx, by);
      g.fillStyle = '#f8fafc';
      g.beginPath();
      g.arc(p[0] * W, p[1] * H, f.ballR * unit, 0, Math.PI * 2);
      g.fill();
    }
  }

  function render(v) {
    view = v;
    viewAt = performance.now();
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.phase === 'point') status = v.lastScorer === you ? 'You scored! 🎉' : 'They scored';
    else if (v.phase === 'play') status = 'Drag left and right to move your paddle';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return; // views arrive ~30x a second; only touch the DOM on change
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    root.querySelector('.pong-court').classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'pong', {
    mount: function (el, a) {
      api = a;
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root = document.createElement('div');
      root.className = 'pong-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="pong-court"><canvas></canvas></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      court = root.querySelector('.pong-court canvas');
      court.addEventListener('pointerdown', onPointer);
      court.addEventListener('pointermove', onPointer);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      raf = requestAnimationFrame(draw);
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      clearTimeout(sendTimer);
      root = court = info = view = null;
      lastKey = '';
      pendingY = null;
    },
  });
})();
