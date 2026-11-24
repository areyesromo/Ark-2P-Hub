(function () {
  Ark.loadCss('/games/flood/style.css');
  const ready = Ark.loadScript('/games/flood/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkFlood) return;
    const k = JSON.stringify([v.board, v.moves, v.phase, v.best]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = window.ArkFlood.info(v) + (v.best === null || v.best === undefined ? '' : '<span>best ' + v.best + '</span>');
    window.ArkFlood.draw(root.querySelector('canvas'), v);
    root.querySelector('.fld-keys').innerHTML = window.ArkFlood.buttons(v, -1);
  }

  Ark.register('player', 'flood', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'fld-phone';
      root.innerHTML = '<div class="info"></div><canvas class="fld-canvas"></canvas><div class="fld-keys"></div>';
      el.appendChild(root);
      root.addEventListener('pointerdown', function (e) {
        const b = e.target.closest('[data-c]');
        if (!b || b.disabled || !view || view.phase !== 'play') return;
        e.preventDefault();
        api.send({ type: 'pick', colour: Number(b.getAttribute('data-c')) });
        api.vibrate(5);
      });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
