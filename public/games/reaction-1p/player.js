(function () {
  Ark.loadCss('/games/reaction-1p/style.css');

  let root = null;
  let btn = null;
  let api = null;
  let key = '';

  function render(v) {
    const k = v.phase + '|' + v.round;
    if (k === key) return;
    key = k;
    const label = { ready: 'Get ready…', wait: 'Wait for green…', go: 'TAP!', early: 'Too soon!', result: (v.last && v.last.ms) + ' ms', over: '' }[v.phase] || '';
    btn.className = 'reaction-tap ' + v.phase;
    btn.innerHTML = '<span class="big">' + label + '</span><span class="sub">Round ' + v.round + ' of ' + v.rounds + '</span>';
    if (v.phase === 'go') api.vibrate(40);
    if (v.phase === 'early') api.vibrate([80, 40, 80]);
  }

  Ark.register('player', 'reaction-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'reaction-phone';
      root.innerHTML = '<button class="reaction-tap"></button>';
      el.appendChild(root);
      btn = root.querySelector('.reaction-tap');
      // On touch-down: every millisecond counts here.
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        api.send({ type: 'tap' });
      });
    },
    update: render,
    unmount: function () {
      root = btn = null;
      key = '';
    },
  });
})();
