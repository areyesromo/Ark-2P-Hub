(function () {
  Ark.loadCss('/games/memory-1p/style.css');
  const ready = Ark.loadScript('/games/memory-1p/board.js');

  let root = null;
  let field = null;
  let info = null;
  let view = null;
  let boardKey = '';
  let api = null;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkSoloMemory) return;
    const key = JSON.stringify([v.cards, v.matched]);
    if (key !== boardKey) {
      boardKey = key;
      field.innerHTML = window.ArkSoloMemory.html(v, null);
    }
    info.innerHTML = '<strong>' + v.tries + '</strong> tries · ' + v.pairsLeft + ' pairs to find' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
  }

  Ark.register('player', 'memory-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mem-phone';
      root.innerHTML = '<div class="info"></div><div class="mem-field"></div>';
      el.appendChild(root);
      field = root.querySelector('.mem-field');
      info = root.querySelector('.info');
      field.addEventListener('click', function (e) {
        const card = e.target.closest('[data-cell]');
        if (!card || !view || view.phase !== 'play') return;
        api.send({ type: 'flip', cell: Number(card.getAttribute('data-cell')) });
        api.vibrate(6);
      });
      ready.then(render);
    },
    update: function (v) {
      if (view && v.lastMiss > view.lastMiss) api.vibrate([40, 30, 40]);
      view = v;
      render();
    },
    unmount: function () {
      root = field = info = view = api = null;
      boardKey = '';
    },
  });
})();
