(function () {
  Ark.loadCss('/games/oddone/style.css');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let lastN = 0;

  function render() {
    const v = view;
    if (!v || !root) return;
    const k = JSON.stringify([v.phase, v.round, v.base, v.score, Math.ceil(v.timeLeft / 1000)]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = '✓ <strong>' + v.score + '</strong> · ⏱ ' + Math.ceil(v.timeLeft / 1000) + ' s' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    let html = '';
    if (v.phase === 'play') {
      html = '<div class="oo-grid" style="--n:' + v.size + '">';
      for (let i = 0; i < v.size * v.size; i++) html += '<button type="button" class="oo-cell" data-cell="' + i + '" style="background:' + (i === v.odd ? v.oddColour : v.base) + '"></button>';
      html += '</div>';
    } else if (v.phase === 'ready') html = '<div class="big">Get ready…</div>';
    root.querySelector('.oo-field').innerHTML = html;
  }

  Ark.register('player', 'oddone', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'oo-phone';
      root.innerHTML = '<div class="info"></div><div class="oo-field"></div>';
      el.appendChild(root);
      // On touch-down: a quick eye deserves a quick tap.
      root.querySelector('.oo-field').addEventListener('pointerdown', function (e) {
        const c = e.target.closest('[data-cell]');
        if (!c || !view || view.phase !== 'play') return;
        e.preventDefault();
        api.send({ type: 'pick', cell: Number(c.getAttribute('data-cell')) });
      });
    },
    update: function (v) {
      if (v.last && v.last.n !== lastN) {
        lastN = v.last.n;
        api.vibrate(v.last.ok ? 10 : [60, 40, 60]);
      }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      lastN = 0;
    },
  });
})();
