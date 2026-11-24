(function () {
  Ark.loadCss('/games/flappy/style.css');

  let root = null;
  let btn = null;
  let api = null;
  let lastKey = '';

  function render(v) {
    const key = v.phase + '|' + v.score + '|' + v.best;
    if (key === lastKey) return;
    lastKey = key;
    root.querySelector('.info').innerHTML = 'Pipes <strong>' + v.score + '</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    btn.querySelector('.big').textContent = v.phase === 'ready' ? 'Tap to start' : v.phase === 'paused' ? 'Paused' : 'FLAP';
    btn.classList.toggle('off', v.phase === 'paused');
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    root.querySelector('.pause').disabled = v.phase !== 'play' && v.phase !== 'paused';
  }

  Ark.register('player', 'flappy', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'flappy-phone';
      root.innerHTML = '<div class="info"></div><button class="flappy-tap"><span class="big">FLAP</span><span class="sub">Tap anywhere here</span></button><button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      btn = root.querySelector('.flappy-tap');
      // On touch-down: a flap that waits for the finger to lift comes too late.
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        api.send({ type: 'flap' });
        api.vibrate(10);
      });
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      root = btn = null;
      lastKey = '';
    },
  });
})();
