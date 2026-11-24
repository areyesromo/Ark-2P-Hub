(function () {
  Ark.loadCss('/games/hangman-1p/style.css');
  const ready = Ark.loadScript('/games/hangman-1p/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let wrong = 0;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkHangman) return;
    if (v.wrong > wrong) api.vibrate([40, 30, 40]);
    wrong = v.wrong;
    const k = JSON.stringify([v.pattern, v.hits, v.misses, v.phase, v.score, v.best]);
    if (k === key) return;
    key = k;
    const last = v.last;
    root.querySelector('.info').innerHTML = '<strong>' + Ark.formatScore(v.score, 'pts') + '</strong> · word ' + v.wordNo + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts'));
    root.querySelector('.hm-main').innerHTML = window.ArkHangman.gallows(v.wrong, v.maxWrong) + window.ArkHangman.word(v) +
      '<div class="hm-msg">' + (v.phase === 'between' && last ? '✓ +' + last.points : v.phase === 'over' && last && !last.ok ? 'It was <strong>' + last.word.toUpperCase() + '</strong>' : '') + '</div>';
    root.querySelector('.hm-keys').innerHTML = window.ArkHangman.keyboard(v);
  }

  Ark.register('player', 'hangman-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hm-phone';
      root.innerHTML = '<div class="info"></div><div class="hm-main"></div><div class="hm-keys"></div>';
      el.appendChild(root);
      // On touch-down, so fast fingers keep up.
      root.querySelector('.hm-keys').addEventListener('pointerdown', function (e) {
        const b = e.target.closest('[data-k]');
        if (!b || !view || view.phase !== 'play') return;
        e.preventDefault();
        api.send({ type: 'guess', letter: b.getAttribute('data-k') });
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
      wrong = 0;
    },
  });
})();
