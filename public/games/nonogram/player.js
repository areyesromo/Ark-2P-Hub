(function () {
  Ark.loadCss('/games/nonogram/style.css');
  const ready = Ark.loadScript('/games/nonogram/board.js');

  let root = null;
  let board = null;
  let info = null;
  let api = null;
  let view = null;
  let cross = false; // tapping crosses out instead of filling
  let drag = null; // { mark, last }: a finger dragged across squares marks them all the same way

  function render() {
    const v = view;
    if (!v || !root || !window.ArkNono) return;
    if (!board) board = window.ArkNono.create(root.querySelector('.nn-board'));
    board.update(v);
    info.innerHTML = '⏱ ' + Ark.clock(v.elapsed) + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best));
    root.querySelector('.fill').classList.toggle('on', !cross);
    root.querySelector('.cross').classList.toggle('on', cross);
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
  }

  function mark(cell) {
    if (cell === null || !drag || cell === drag.last) return;
    drag.last = cell;
    api.send({ type: 'mark', cell: cell, mark: drag.mark });
  }

  Ark.register('player', 'nonogram', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'nn-phone';
      root.innerHTML =
        '<div class="info"></div><div class="nn-board"></div>' +
        '<div class="nn-tools"><button class="mode fill ghost">■ Fill</button><button class="mode cross ghost">✕ Cross out</button><button class="ghost pause">⏸ Pause</button></div>';
      el.appendChild(root);
      info = root.querySelector('.info');
      const area = root.querySelector('.nn-board');
      area.addEventListener('pointerdown', function (e) {
        if (!view || view.phase !== 'play' || !board) return;
        const cell = board.cellAt(e.clientX, e.clientY);
        if (cell === null) return;
        e.preventDefault();
        // The first square decides: filling an empty square fills the rest of the drag, a filled one clears them.
        const now = view.cells[cell];
        const want = cross ? 2 : 1;
        drag = { mark: now === want ? 'clear' : cross ? 'cross' : 'fill', last: null };
        mark(cell);
        api.vibrate(5);
      });
      area.addEventListener('pointermove', function (e) {
        if (drag && board) mark(board.cellAt(e.clientX, e.clientY));
      });
      const end = function () { drag = null; };
      area.addEventListener('pointerup', end);
      area.addEventListener('pointercancel', end);
      root.querySelector('.fill').addEventListener('click', function () { cross = false; render(); });
      root.querySelector('.cross').addEventListener('click', function () { cross = true; render(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = board = info = view = drag = null;
      cross = false;
    },
  });
})();
