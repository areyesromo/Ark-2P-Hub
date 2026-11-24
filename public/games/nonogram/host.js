(function () {
  Ark.loadCss('/games/nonogram/style.css');
  const ready = Ark.loadScript('/games/nonogram/board.js');

  let root = null;
  let board = null;
  let stats = null;
  let view = null;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkNono) return;
    if (!board) board = window.ArkNono.create(root.querySelector('.nn-board'));
    board.update(v);
    const lines = v.rowsDone.filter(Boolean).length + v.colsDone.filter(Boolean).length;
    stats.innerHTML =
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span><strong>' + lines + '</strong> / ' + 2 * v.n + ' lines</span>' +
      (v.phase === 'paused' ? '<span><strong>⏸ Paused</strong></span>' : '');
  }

  /** The square next to i, wrapping round within its row or column. */
  function step(v, btn) {
    const n = v.n;
    const r = Math.floor(v.selected / n);
    const c = v.selected % n;
    if (btn === 'LEFT') return r * n + (c + n - 1) % n;
    if (btn === 'RIGHT') return r * n + (c + 1) % n;
    if (btn === 'UP') return ((r + n - 1) % n) * n + c;
    return ((r + 1) % n) * n + c;
  }

  Ark.register('host', 'nonogram', {
    sounds: function (prev, v) {
      if (v.moves > prev.moves) return ['lock'];
      return [];
    },
    padHint: 'D-pad move · A fill · X / B cross out · A or X again clears · Start pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      if (btn === 'UP' || btn === 'DOWN' || btn === 'LEFT' || btn === 'RIGHT') return { type: 'select', cell: step(v, btn) };
      const now = v.cells[v.selected];
      if (btn === 'A') return { type: 'mark', cell: v.selected, mark: now === 1 ? 'clear' : 'fill' };
      if (btn === 'X' || btn === 'B') return { type: 'mark', cell: v.selected, mark: now === 2 ? 'clear' : 'cross' };
      return null;
    },
    overHtml: function (v) {
      return v.n + '×' + v.n + ' solved in ' + v.moves + ' moves';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'nn-host';
      root.innerHTML = '<div class="nn-stats"></div><div class="nn-board"></div>';
      el.appendChild(root);
      stats = root.querySelector('.nn-stats');
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = board = stats = view = null;
    },
  });
})();
