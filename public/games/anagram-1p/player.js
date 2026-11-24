(function () {
  Ark.loadCss('/games/anagram-1p/style.css');
  const ready = Ark.loadScript('/games/anagram-1p/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let round = '';
  let picks = [];

  function render() {
    const v = view;
    if (!v || !root || !window.ArkAnagram) return;
    const r = window.ArkAnagram.roundKey(v);
    if (r !== round) {
      if (v.last && round && v.last.n && !v.last.ok && !v.last.skipped) api.vibrate([40, 30, 40]);
      round = r;
      picks = [];
    }
    const k = JSON.stringify([r, picks, v.phase, Math.ceil(v.timeLeft / 1000)]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = '✓ <strong>' + v.right + '</strong> · ⏱ ' + Math.ceil(v.timeLeft / 1000) + ' s' +
      (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    root.querySelector('.an-main').innerHTML = v.phase === 'ready' ? '<div class="an-ready">Get ready…</div>' : window.ArkAnagram.html(v, picks, null);
    root.querySelector('.an-msg').innerHTML = window.ArkAnagram.feedback(v);
    const play = v.phase === 'play';
    root.querySelector('.back').disabled = !play || !picks.length;
    root.querySelector('.skip').disabled = !play;
  }

  Ark.register('player', 'anagram-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'an-phone';
      root.innerHTML = '<div class="info"></div><div class="an-main"></div><div class="an-msg"></div><div class="an-buttons"><button class="ghost back">⌫ Back</button><button class="ghost skip">⏭ Skip (−3 s)</button></div>';
      el.appendChild(root);
      // On touch-down, so fast fingers keep up.
      root.querySelector('.an-main').addEventListener('pointerdown', function (e) {
        const t = e.target.closest('[data-i]');
        if (!t || !view || view.phase !== 'play' || !view.letters) return;
        e.preventDefault();
        const i = Number(t.getAttribute('data-i'));
        if (picks.indexOf(i) !== -1) return;
        picks.push(i);
        api.vibrate(5);
        if (picks.length === view.letters.length) api.send({ type: 'guess', word: picks.map(function (j) { return view.letters[j]; }).join('') });
        render();
      });
      root.querySelector('.back').addEventListener('click', function () { picks.pop(); render(); });
      root.querySelector('.skip').addEventListener('click', function () { api.send({ type: 'skip' }); });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = round = '';
      picks = [];
    },
  });
})();
