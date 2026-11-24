(function () {
  Ark.loadCss('/games/gems/style.css');
  const ready = Ark.loadScript('/games/gems/board.js');
  const SWIPE_PX = 18;

  let root = null;
  let board = null;
  let api = null;
  let view = null;
  let picked = null; // a gem tapped, waiting for its neighbour
  let touch = null;

  function render() {
    if (!view || !board) return;
    board.show(view, { selected: picked, cursor: null });
    root.querySelector('.info').innerHTML = 'Score <strong>' + Ark.formatScore(view.score, 'pts') + '</strong> · ' + view.movesLeft + ' swaps left' +
      (view.best === null || view.best === undefined ? '' : ' · best ' + Ark.formatScore(view.best, 'pts'));
  }

  const cellAt = function (e) {
    const el = e.target.closest && e.target.closest('[data-cell]');
    return el ? Number(el.getAttribute('data-cell')) : null;
  };

  function swap(a, b) {
    picked = null;
    api.send({ type: 'swap', a: a, b: b });
    api.vibrate(10);
    render();
  }

  // Swipe a gem towards a neighbour, or tap one gem then the one next to it.
  function down(e) {
    const cell = cellAt(e);
    if (cell === null || !view || view.phase !== 'play') return;
    e.preventDefault();
    touch = { cell: cell, x: e.clientX, y: e.clientY, done: false };
  }
  function move(e) {
    if (!touch || touch.done) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    const n = view.size;
    const x = (touch.cell % n) + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0);
    const y = Math.floor(touch.cell / n) + (Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy));
    touch.done = true;
    if (x >= 0 && y >= 0 && x < n && y < n) swap(touch.cell, y * n + x);
  }
  function up() {
    if (!touch) return;
    const t = touch;
    touch = null;
    if (t.done) return;
    const n = view.size;
    const near = picked !== null && Math.abs((picked % n) - (t.cell % n)) + Math.abs(Math.floor(picked / n) - Math.floor(t.cell / n)) === 1;
    if (near) return swap(picked, t.cell);
    picked = picked === t.cell ? null : t.cell;
    render();
  }

  Ark.register('player', 'gems', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'gems-phone';
      root.innerHTML = '<div class="info"></div><div class="gems-frame"><div class="gems-cells"></div></div><p class="muted hint">Swipe a gem into its neighbour, or tap one then the other.</p>';
      el.appendChild(root);
      const frame = root.querySelector('.gems-frame');
      frame.addEventListener('pointerdown', down);
      frame.addEventListener('pointermove', move);
      frame.addEventListener('pointerup', up);
      frame.addEventListener('pointercancel', function () { touch = null; });
      ready.then(function () {
        if (!root) return;
        board = window.ArkGems.create(root.querySelector('.gems-cells'));
        render();
      });
    },
    update: function (v) {
      if (view && v.nope > view.nope) api.vibrate([40, 30, 40]);
      view = v;
      render();
    },
    unmount: function () {
      if (board) board.stop();
      root = board = view = touch = null;
      picked = null;
    },
  });
})();
