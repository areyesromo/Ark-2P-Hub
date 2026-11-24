(function () {
  Ark.loadCss('/games/asteroids-1p/style.css');

  let root = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let lives = null;
  const held = { left: false, right: false, thrust: false };
  let sent = '';

  // Turning and thrust are held: send their state whenever it changes.
  function sendCtl() {
    const ctl = { type: 'ctl', rot: held.left && !held.right ? -1 : held.right && !held.left ? 1 : 0, thrust: held.thrust };
    const key = ctl.rot + '|' + ctl.thrust;
    if (key === sent) return;
    sent = key;
    api.send(ctl);
  }

  function press(e) {
    const btn = e.target.closest && e.target.closest('[data-c]');
    if (!btn) return;
    e.preventDefault();
    // Keep the button's own pointer, so lifting the finger off it still lets go (it can fail on some browsers: fine).
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* not captured */ }
    const c = btn.getAttribute('data-c');
    btn.classList.add('on');
    if (c === 'fire') {
      api.send({ type: 'fire' });
      api.vibrate(8);
      return;
    }
    held[c] = true;
    sendCtl();
  }

  function release(e) {
    const btn = e.target.closest && e.target.closest('[data-c]');
    if (!btn) return;
    btn.classList.remove('on');
    const c = btn.getAttribute('data-c');
    if (c === 'fire') return;
    held[c] = false;
    sendCtl();
  }

  function render(v) {
    if (lives !== null && v.lives < lives) api.vibrate(250);
    lives = v.lives;
    const key = [v.phase, v.score, v.lives, v.wave, v.best].join('|');
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML = 'Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong> · ' + new Array(Math.max(0, v.lives) + 1).join('▲ ') + '· wave ' + v.wave +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts'));
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
  }

  Ark.register('player', 'asteroids-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'asteroids-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="asteroids-pad">' +
        '<div class="turns"><button data-c="left">⟲</button><button data-c="right">⟳</button></div>' +
        '<div class="acts"><button data-c="thrust">🔥 Thrust</button><button data-c="fire" class="fire">💥 Fire</button></div>' +
        '</div><button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      const pad = root.querySelector('.asteroids-pad');
      pad.addEventListener('pointerdown', press);
      pad.addEventListener('pointerup', release);
      pad.addEventListener('pointercancel', release);
      pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      root = info = null;
      lastKey = sent = '';
      lives = null;
      held.left = held.right = held.thrust = false;
    },
  });
})();
