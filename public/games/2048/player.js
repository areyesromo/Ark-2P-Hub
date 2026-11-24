(function () {
  Ark.loadCss('/games/2048/style.css');
  Ark.loadCss('/shared/steer-pad.css');
  const padReady = Ark.loadScript('/shared/steer-pad.js');

  let root = null;
  let pad = null;
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let giveUpArmed = false;

  function move(dir) {
    if (!view || view.phase !== 'play') return;
    api.send({ type: 'move', dir: dir });
    api.vibrate(10);
    pad.show(dir);
  }

  function render(v) {
    view = v;
    if (!pad) return;
    const key = [v.score, v.biggest, v.best, v.reached].join('|');
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML =
      '<div class="score">Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong>' +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts')) + '</div>' +
      '<div class="status">' + (v.reached ? '🎉 You made 2048! Keep going…' : 'Biggest tile ' + v.biggest) + '</div>';
  }

  Ark.register('player', '2048', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'g2048-phone';
      root.innerHTML = '<div class="info"></div><button class="ghost give-up">End this run</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      const btn = root.querySelector('.give-up');
      // Two taps, so a stray one doesn't throw a good board away.
      btn.addEventListener('click', function () {
        if (!giveUpArmed) {
          giveUpArmed = true;
          btn.textContent = 'Tap again to end it';
          setTimeout(function () { giveUpArmed = false; btn.textContent = 'End this run'; }, 3000);
          return;
        }
        api.send({ type: 'give-up' });
      });
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return;
        pad = window.ArkSteerPad.create(move, 'Swipe (or tap a side) to slide');
        root.insertBefore(pad.el, btn);
        if (view) render(view);
      });
    },
    update: render,
    unmount: function () {
      root = pad = info = view = null;
      lastKey = '';
      giveUpArmed = false;
    },
  });
})();
