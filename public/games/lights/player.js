(function () {
  Ark.loadCss('/games/lights/style.css');
  const ready = Ark.loadScript('/games/lights/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkLights) return;
    const k = v.board.join('') + '|' + v.moves + '|' + v.phase + '|' + v.best;
    if (k === key) return;
    key = k;
    root.querySelector('.lo-field').innerHTML = window.ArkLights.html(v);
    root.querySelector('.info').innerHTML = '<strong>' + v.moves + '</strong> ' + (v.moves === 1 ? 'move' : 'moves') + ' · par ' + v.par +
      (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    root.querySelector('.reset').disabled = v.phase !== 'play';
  }

  Ark.register('player', 'lights', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'lo-phone';
      root.innerHTML = '<div class="info"></div><div class="lo-field"></div><button class="ghost reset">↺ Start again</button>';
      el.appendChild(root);
      // On touch-down, so quick presses keep up.
      root.querySelector('.lo-field').addEventListener('pointerdown', function (e) {
        const cell = e.target.closest('[data-cell]');
        if (!cell || !view || view.phase !== 'play') return;
        e.preventDefault();
        api.send({ type: 'press', cell: Number(cell.getAttribute('data-cell')) });
        api.vibrate(10);
      });
      root.querySelector('.reset').addEventListener('click', function () { api.send({ type: 'reset' }); });
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
