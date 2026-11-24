(function () {
  Ark.loadCss('/games/stack-1p/style.css');
  const ready = Ark.loadScript('/games/stack-1p/board.js');

  let root = null;
  let api = null;
  let info = null;
  let view = null;
  let track = null;

  function render() {
    if (!root || !view) return;
    const v = view;
    info.innerHTML = '<strong>' + v.score + '</strong> blocks' + (v.perfects > 1 ? ' · 🎯 ' + v.perfects + ' perfect' : '') +
      (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
  }

  Ark.register('player', 'stack-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'stack-phone';
      root.innerHTML = '<div class="info"></div><button type="button" class="drop">DROP</button><button type="button" class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      // On the finger going down, not up: a tap is a moment.
      root.querySelector('.drop').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (!view || view.phase !== 'play') return;
        api.send(track && window.ArkStack ? { type: 'drop', t: Math.round(track.t()) } : { type: 'drop' });
        api.vibrate(10);
      });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
      ready.then(function () {
        if (!root) return;
        track = window.ArkStack.tracker();
        if (view) track.update(view);
      });
      render();
    },
    update: function (v) {
      if (view && v.phase === 'over' && view.phase !== 'over') api.vibrate([80, 40, 80]);
      view = v;
      if (track) track.update(v);
      render();
    },
    unmount: function () {
      root = info = view = track = api = null;
    },
  });
})();
