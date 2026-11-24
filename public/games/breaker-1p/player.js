(function () {
  Ark.loadCss('/games/breaker-1p/style.css');
  const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

  let root = null;
  let strip = null;
  let knob = null;
  let info = null;
  let launchBtn = null;
  let pauseBtn = null;
  let api = null;
  let lastKey = '';
  let lastSent = 0;
  let pendingX = null;
  let sendTimer = null;
  let prevLives = null;

  function send() {
    sendTimer = null;
    if (pendingX === null) return;
    api.send({ type: 'aim', x: pendingX });
    lastSent = Date.now();
    pendingX = null;
  }

  // Follow the finger: the paddle moves to where you touch (0 = left, 1 = right).
  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    e.preventDefault();
    // Keep following the finger even if it slides off the strip.
    if (e.type === 'pointerdown' && strip.setPointerCapture) strip.setPointerCapture(e.pointerId);
    const r = strip.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    knob.style.left = x * 100 + '%';
    pendingX = Math.round(x * 1000) / 1000;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function render(v) {
    if (prevLives !== null && v.lives < prevLives) api.vibrate(150);
    prevLives = v.lives;
    const key = [v.phase, v.score, v.level, v.lives, v.bricksLeft, v.best].join('|');
    if (key === lastKey) return; // views arrive ~30 times a second: only touch the DOM on change
    lastKey = key;
    info.innerHTML =
      '<div class="score">Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts')) + '</div>' +
      '<div class="status">Level ' + v.level + ' · ' + new Array(v.lives + 1).join('● ') + ' · ' + v.bricksLeft + ' bricks</div>';
    launchBtn.classList.toggle('hidden', v.phase !== 'serve');
    pauseBtn.textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    pauseBtn.disabled = v.phase !== 'play' && v.phase !== 'serve' && v.phase !== 'paused';
  }

  Ark.register('player', 'breaker-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'breaker-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<button class="primary launch hidden">🚀 Launch</button>' +
        '<div class="breaker-strip"><div class="knob"></div><div class="hint">Slide left and right</div></div>' +
        '<button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      strip = root.querySelector('.breaker-strip');
      knob = root.querySelector('.knob');
      launchBtn = root.querySelector('.launch');
      pauseBtn = root.querySelector('.pause');
      strip.addEventListener('pointerdown', onPointer);
      strip.addEventListener('pointermove', onPointer);
      launchBtn.addEventListener('click', function () { api.send({ type: 'launch' }); api.vibrate(20); });
      pauseBtn.addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = strip = knob = info = launchBtn = pauseBtn = null;
      lastKey = '';
      pendingX = null;
      prevLives = null;
    },
  });
})();
