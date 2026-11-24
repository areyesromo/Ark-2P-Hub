(function () {
  Ark.loadCss('/games/memory-1p/style.css');
  const ready = Ark.loadScript('/games/memory-1p/board.js');

  let root = null;
  let field = null;
  let stats = null;
  let view = null;
  let boardKey = '';
  let cursor = 0; // a controller's place on the grid

  function render() {
    const v = view;
    if (!v || !root || !window.ArkSoloMemory) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const key = JSON.stringify([v.cards, v.matched, local && cursor]);
    if (key !== boardKey) {
      boardKey = key;
      field.innerHTML = window.ArkSoloMemory.html(v, local ? cursor : null);
    }
    stats.innerHTML =
      '<span><strong>' + v.tries + '</strong> tries</span>' +
      '<span><strong>' + v.pairsLeft + '</strong> pairs to find</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      (v.streak > 1 ? '<span>🔥 <strong>' + v.streak + '</strong> in a row</span>' : '');
  }

  function shake() {
    const grid = field && field.querySelector('.mem-grid');
    if (!grid) return;
    grid.classList.remove('shake');
    void grid.offsetWidth; // restart the animation
    grid.classList.add('shake');
  }

  Ark.register('host', 'memory-1p', {
    sounds: function (prev, v) {
      const found = v.matched.filter(Boolean).length > prev.matched.filter(Boolean).length;
      if (found) return ['point'];
      if (v.lastMiss > prev.lastMiss) return ['wrong'];
      if (v.up.length > prev.up.length) return ['flag'];
      return [];
    },
    padHint: 'D-pad move · A turn a card over',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      const n = v.cards.length;
      if (btn === 'LEFT') cursor = (cursor + n - 1) % n;
      else if (btn === 'RIGHT') cursor = (cursor + 1) % n;
      else if (btn === 'UP') cursor = (cursor + n - v.w) % n;
      else if (btn === 'DOWN') cursor = (cursor + v.w) % n;
      else if (btn === 'A') return { type: 'flip', cell: cursor };
      else return null;
      render();
      return null;
    },
    overHtml: function (v) {
      return 'Every pair found in ' + v.tries + ' tries · ' + Ark.clock(v.elapsed) + ' · best run ' + v.bestStreak + ' in a row';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mem-host';
      root.innerHTML = '<div class="mem-stats"></div><div class="mem-field"></div>';
      el.appendChild(root);
      field = root.querySelector('.mem-field');
      stats = root.querySelector('.mem-stats');
      ready.then(render);
    },
    update: function (v) {
      const missed = view && v.lastMiss > view.lastMiss;
      if (!view || v.tries < view.tries) cursor = 0;
      view = v;
      render();
      if (missed) shake();
    },
    unmount: function () {
      root = field = stats = view = null;
      boardKey = '';
      cursor = 0;
    },
  });
})();
