(function () {
  Ark.loadCss('/games/kenken/style.css');
  const ready = Ark.loadScript('/games/kenken/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkKenKen) return;
    const k = JSON.stringify([v.grid, v.selected, v.clashes, v.phase]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = '<strong>' + v.filled + '</strong> / ' + v.n * v.n + (v.clashes.length ? ' · <span class="bad">⚠ clash</span>' : '') +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best));
    root.querySelector('.kk-field').innerHTML = window.ArkKenKen.html(v);
    let keys = '';
    for (let d = 1; d <= v.n; d++) keys += '<button data-v="' + d + '">' + d + '</button>';
    root.querySelector('.kk-keys').innerHTML = keys + '<button data-v="0" class="clear">✕</button>';
  }

  Ark.register('player', 'kenken', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'kk-phone';
      root.innerHTML = '<div class="info"></div><div class="kk-field"></div><div class="kk-keys"></div><p class="muted hint">Tap a square, then a number.</p>';
      el.appendChild(root);
      root.addEventListener('click', function (e) {
        if (!view || view.phase !== 'play') return;
        const cell = e.target.closest('[data-cell]');
        if (cell) {
          api.send({ type: 'select', cell: Number(cell.getAttribute('data-cell')) });
          return;
        }
        const k = e.target.closest('[data-v]');
        if (k) {
          api.send({ type: 'set', cell: view.selected, value: Number(k.getAttribute('data-v')) });
          api.vibrate(6);
        }
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
