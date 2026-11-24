(function () {
  Ark.loadCss('/games/gems/style.css');
  const ready = Ark.loadScript('/games/gems/board.js');
  const STEP = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

  let root = null;
  let board = null;
  let stats = null;
  let view = null;
  // A controller: a cursor, and the gem picked with A (then a direction swaps it).
  const pad = { cursor: 27, picked: null };

  function marks() {
    const local = view && view.player && view.player.local && view.phase === 'play';
    return local ? { cursor: pad.cursor, selected: pad.picked } : { cursor: null, selected: null };
  }

  function render() {
    if (!view || !board) return;
    board.show(view, marks());
    const chain = view.last && view.last.steps && view.last.steps.length > 1 ? '<span class="chain">Chain ×' + view.last.steps.length + '!</span>' : '';
    stats.innerHTML = '<span>Score <strong>' + Ark.formatScore(view.score, 'pts') + '</strong></span><span>Swaps left <strong>' + view.movesLeft + '</strong></span>' + chain;
  }

  Ark.register('host', 'gems', {
    sounds: function (prev, v) {
      if (v.nope > prev.nope) return ['wrong'];
      if (v.swaps > prev.swaps) return v.last.steps.length > 1 ? ['correct'] : ['merge'];
      return [];
    },
    padHint: 'D-pad moves · A picks a gem, then a direction swaps it · B lets go',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      const n = v.size;
      const step = STEP[btn];
      if (step) {
        const x = (pad.cursor % n) + step[0];
        const y = Math.floor(pad.cursor / n) + step[1];
        if (x < 0 || y < 0 || x >= n || y >= n) return null;
        const to = y * n + x;
        if (pad.picked !== null) {
          const from = pad.picked;
          pad.picked = null;
          pad.cursor = to;
          render();
          return { type: 'swap', a: from, b: to };
        }
        pad.cursor = to;
        render();
        return null;
      }
      if (btn === 'A') pad.picked = pad.picked === pad.cursor ? null : pad.cursor;
      else if (btn === 'B') pad.picked = null;
      render();
      return null;
    },
    overHtml: function (v) {
      return 'Longest chain ' + v.bestChain + ' · longest line ' + v.biggest;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'gems-host';
      root.innerHTML = '<div class="gems-stats"></div><div class="gems-wrap"><div class="gems-frame"><div class="gems-cells"></div></div></div>';
      el.appendChild(root);
      stats = root.querySelector('.gems-stats');
      ready.then(function () {
        if (!root) return;
        board = window.ArkGems.create(root.querySelector('.gems-cells'));
        render();
      });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      if (board) board.stop();
      root = board = stats = view = null;
      pad.cursor = 27;
      pad.picked = null;
    },
  });
})();
