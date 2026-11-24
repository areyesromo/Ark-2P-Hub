(function () {
  Ark.loadCss('/games/runner/style.css');

  let root = null;
  let api = null;
  let lastKey = '';
  let phase = '';

  // Both buttons are held: pressing sends on, letting go sends off.
  function hold(btn, type) {
    const set = function (on) {
      return function (e) {
        e.preventDefault();
        if (on) try { btn.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
        btn.classList.toggle('on', on);
        api.send({ type: type, on: on });
        if (on) api.vibrate(8);
      };
    };
    btn.addEventListener('pointerdown', set(true));
    btn.addEventListener('pointerup', set(false));
    btn.addEventListener('pointercancel', set(false));
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function render(v) {
    const key = [v.phase, v.score, v.best].join('|');
    if (v.phase === 'over' && phase === 'play') api.vibrate(200); // crashed
    phase = v.phase;
    if (key === lastKey) return;
    lastKey = key;
    root.querySelector('.info').innerHTML = '<strong>' + v.score + ' m</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best + ' m');
    root.querySelector('.jump .sub').textContent = v.phase === 'ready' ? 'Tap to start' : 'Hold for a higher jump';
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    root.querySelector('.pause').disabled = v.phase !== 'play' && v.phase !== 'paused';
  }

  Ark.register('player', 'runner', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'runner-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<button class="jump"><span class="big">⬆ JUMP</span><span class="sub"></span></button>' +
        '<button class="duck"><span class="big">⬇ DUCK</span></button>' +
        '<button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      hold(root.querySelector('.jump'), 'jump');
      hold(root.querySelector('.duck'), 'duck');
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      root = null;
      lastKey = phase = '';
    },
  });
})();
