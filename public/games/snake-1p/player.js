(function () {
  Ark.loadCss('/games/snake-1p/style.css');
  Ark.loadCss('/shared/steer-pad.css');
  const padReady = Ark.loadScript('/shared/steer-pad.js');

  let root = null;
  let pad = null; // ArkSteerPad
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let prevScore = 0; // to buzz on each bite
  let prevPhase = '';

  function turn(dir) {
    if (!view || (view.phase !== 'play' && view.phase !== 'countdown')) return;
    api.send({ type: 'turn', dir: dir });
    api.vibrate(15);
    pad.show(dir);
  }

  function render(v) {
    view = v;
    if (!pad) return;
    if (v.phase === 'play' && v.score > prevScore) api.vibrate(25);
    if (v.phase === 'over' && prevPhase && prevPhase !== 'over') api.vibrate(200); // crashed
    prevScore = v.score;
    prevPhase = v.phase;
    let status = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Tap a side or swipe to turn';
    else if (v.phase === 'paused') status = 'Paused';
    const best = v.best === null || v.best === undefined ? '' : ' · best ' + v.best;
    const key = [v.phase, v.score, v.dir, status, best].join('|');
    if (key === lastKey) return; // views arrive every tick; only touch the DOM on change
    lastKey = key;
    info.innerHTML = '<div class="score">Score <strong>' + v.score + '</strong>' + best + '</div><div class="status">' + status + '</div>';
    if (v.phase === 'play' || v.phase === 'countdown') pad.show(v.dir);
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    root.querySelector('.pause').disabled = v.phase !== 'play' && v.phase !== 'paused';
  }

  Ark.register('player', 'snake-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'snk1-phone';
      root.innerHTML = '<div class="info"></div><button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return; // unmounted while loading
        pad = window.ArkSteerPad.create(turn);
        root.insertBefore(pad.el, root.querySelector('.pause'));
        if (view) render(view);
      });
    },
    update: render,
    unmount: function () {
      root = pad = info = view = null;
      lastKey = prevPhase = '';
      prevScore = 0;
    },
  });
})();
