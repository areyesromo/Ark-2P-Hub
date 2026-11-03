// Brick Breaker Duel on the phone (server/games/brick-duel.js): your own wall, balls and
// paddle, and you drag left and right anywhere on it to move the paddle (it follows your finger
// at its top speed, as in Pong). Your rival's count is at the top; no need to watch the TV.
(function () {
  Ark.loadCss('/games/brick-duel/style.css');
  Ark.loadScript('/games/brick-duel/bricks.js');
  const SEND_EVERY_MS = 33;
  const MAX_EXTRAPOLATE_MS = 50; // carry a ball on no further than about one view

  let root = null;
  let strip = null; // the canvas: your side, and where you drag
  let info = null;
  let view = null;
  let viewAt = 0;
  let raf = null;
  let shownPaddle = null;
  let myColor = '#22d3ee';
  let api = null;
  let lastKey = '';
  let lastSent = 0;
  let pendingX = null;
  let sendTimer = null;
  let powerN = undefined;
  let dragging = false;

  function send() {
    sendTimer = null;
    if (pendingX === null || !api) return;
    api.send({ type: 'move', x: pendingX });
    lastSent = Date.now();
    pendingX = null;
  }

  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    e.preventDefault();
    if (e.type === 'pointerdown') {
      dragging = true;
      if (strip.setPointerCapture) strip.setPointerCapture(e.pointerId);
    }
    const r = strip.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    pendingX = Math.round(x * 1000) / 1000;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function render(v) {
    const you = v.you;
    view = v;
    viewAt = performance.now();
    // A buzz when your rival's power brick hits you (not on the first view after joining).
    const n = v.power ? v.power.n : null;
    if (powerN !== undefined && n !== null && n !== powerN && v.power.by !== you && v.power.kind !== 'multi') api.vibrate(150);
    powerN = n;
    const clock = v.suddenDeath ? 'Sudden death!' : v.timeLeft === null ? '' : Math.floor(v.timeLeft / 60) + ':' + String(v.timeLeft % 60).padStart(2, '0');
    const score = '🧱 You ' + v.broken[you] + ' – ' + v.broken[1 - you] + ' Them · ' + v.left[you] + ' left · ' + clock;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.phase === 'play') status = v.shrunk ? '🔻 Your paddle is shrunk!' : 'Drag left and right to move your paddle';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : v.winner === null ? '' : 'lost';
      status = v.winner === null ? 'A draw' : v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    root.querySelector('.bd-court').classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  // Your side, as on the TV: the wall, your paddle (eased towards the server's) and the balls.
  function draw() {
    raf = requestAnimationFrame(draw);
    const v = view;
    if (!v || !v.side || !strip || !window.ArkBricks) return;
    const f = v.field;
    const box = strip.parentElement.getBoundingClientRect();
    const cssW = Math.floor(Math.min(box.width, (box.height * f.w) / f.h));
    const cssH = Math.floor((cssW * f.h) / f.w);
    const dpr = window.devicePixelRatio || 1;
    if (strip.width !== Math.round(cssW * dpr) || strip.height !== Math.round(cssH * dpr)) {
      strip.width = Math.round(cssW * dpr);
      strip.height = Math.round(cssH * dpr);
      strip.style.width = cssW + 'px';
      strip.style.height = cssH + 'px';
    }
    const g = strip.getContext('2d');
    const k = strip.width / f.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = '#0b1020';
    g.fillRect(0, 0, f.w, f.h);
    const side = v.side;
    side.bricks.forEach(function (b) { window.ArkBricks.drawBrick(g, f, b); });
    shownPaddle = shownPaddle === null ? side.paddle : shownPaddle + (side.paddle - shownPaddle) * 0.5;
    g.fillStyle = myColor;
    g.fillRect(shownPaddle - side.paddleW / 2, f.paddleY, side.paddleW, f.paddleH);
    const dt = v.phase === 'play' ? Math.min(performance.now() - viewAt, MAX_EXTRAPOLATE_MS) / 1000 : 0;
    g.fillStyle = '#ffffff';
    side.balls.forEach(function (b) {
      const x = b.held ? shownPaddle : Math.min(f.w - f.ballR, Math.max(f.ballR, b.x + b.vx * dt));
      const y = b.held ? b.y : Math.min(f.h, Math.max(f.ballR, b.y + b.vy * dt));
      g.beginPath();
      g.arc(x, y, f.ballR, 0, Math.PI * 2);
      g.fill();
    });
  }

  Ark.register('player', 'brick-duel', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bd-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="bd-court"><canvas class="bd-strip"></canvas></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      strip = root.querySelector('.bd-strip');
      myColor = getComputedStyle(document.body).getPropertyValue('--me').trim() || myColor;
      raf = requestAnimationFrame(draw);
      strip.addEventListener('pointerdown', onPointer);
      strip.addEventListener('pointermove', onPointer);
      ['pointerup', 'pointercancel'].forEach(function (ev) { strip.addEventListener(ev, function () { dragging = false; }); });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      cancelAnimationFrame(raf);
      root = strip = info = api = view = shownPaddle = null;
      lastKey = '';
      pendingX = null;
      powerN = undefined;
      dragging = false;
    },
  });
})();
