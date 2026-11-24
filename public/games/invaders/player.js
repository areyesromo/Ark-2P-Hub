(function () {
  Ark.loadCss('/games/invaders/style.css');
  const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

  let root = null;
  let strip = null;
  let knob = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let lastSent = 0;
  let pendingX = null;
  let sendTimer = null;
  let lives = null;

  function send() {
    sendTimer = null;
    if (pendingX === null) return;
    api.send({ type: 'aim', x: pendingX });
    lastSent = Date.now();
    pendingX = null;
  }

  // Slide along the strip: the cannon goes where your finger is (0 = left, 1 = right).
  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    e.preventDefault();
    if (e.type === 'pointerdown') try { strip.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    const r = strip.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    knob.style.left = x * 100 + '%';
    pendingX = Math.round(x * 1000) / 1000;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function render(v) {
    if (lives !== null && v.lives < lives) api.vibrate(200);
    lives = v.lives;
    const key = [v.phase, v.score, v.lives, v.wave, v.best].join('|');
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML = 'Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong> · ' + new Array(Math.max(0, v.lives) + 1).join('▲ ') + '· wave ' + v.wave +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts'));
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
  }

  Ark.register('player', 'invaders', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'invaders-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<button class="fire">🔫 FIRE</button>' +
        '<div class="invaders-strip"><div class="knob"></div><div class="hint">Slide to move</div></div>' +
        '<button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      strip = root.querySelector('.invaders-strip');
      knob = root.querySelector('.knob');
      strip.addEventListener('pointerdown', onPointer);
      strip.addEventListener('pointermove', onPointer);
      // Fire on touch-down: a shot that waits for the finger to lift is late.
      root.querySelector('.fire').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        api.send({ type: 'fire' });
        api.vibrate(10);
      });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = strip = knob = info = null;
      lastKey = '';
      pendingX = null;
      lives = null;
    },
  });
})();
