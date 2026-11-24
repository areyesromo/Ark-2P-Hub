(function () {
  Ark.loadCss('/games/word-guess-1p/style.css');
  const ready = Ark.loadScript('/games/word-guess-1p/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let shakeN = 0;
  let shown = 0; // guesses already on screen: only a new one turns over
  let guesses = 0;

  function render() {
    const v = view;
    if (!v || !window.ArkSoloWords || !root) return;
    if (v.guesses.length > guesses && !v.already) api.vibrate(v.solved ? [60, 40, 120] : 20);
    guesses = v.guesses.length;
    const k = JSON.stringify([v.guesses, v.entry, v.keys, v.phase, v.message]);
    if (k === key) return;
    key = k;
    if (v.guesses.length < shown) shown = 0; // a new run
    root.querySelector('.wg-main').innerHTML = window.ArkSoloWords.board(v, v.guesses.length > shown ? v.guesses.length - 1 : -1);
    shown = v.guesses.length;
    root.querySelector('.wg-kb').innerHTML = window.ArkSoloWords.keyboard(v);
    root.querySelector('.wg-msg').textContent = v.message ? v.message.text : v.daily ? '📅 Today\'s word' : '🎲 Practice';
    if (v.message && v.message.n !== shakeN) {
      shakeN = v.message.n;
      const row = root.querySelector('.wg-row.current');
      if (row) row.classList.add('shake');
      api.vibrate([40, 30, 40]);
    }
  }

  Ark.register('player', 'word-guess-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wg-phone';
      root.innerHTML = '<div class="wg-msg"></div><div class="wg-main"></div><div class="wg-kb"></div>';
      el.appendChild(root);
      // On touch-down, so fast typing keeps up.
      root.querySelector('.wg-kb').addEventListener('pointerdown', function (e) {
        const k = e.target.closest('[data-k]');
        if (!k || !view || view.phase !== 'play') return;
        e.preventDefault();
        api.send(window.ArkSoloWords.input(k.getAttribute('data-k')));
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
      shown = 0;
      guesses = 0;
    },
  });
})();
