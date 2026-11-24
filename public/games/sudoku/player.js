(function () {
  Ark.loadCss('/games/sudoku/style.css');
  const ready = Ark.loadScript('/games/sudoku/board.js');

  let root = null;
  let field = null;
  let info = null;
  let api = null;
  let view = null;
  let noteMode = false;
  let boardKey = '';

  function render() {
    const v = view;
    if (!v || !window.ArkSudoku || !root) return;
    const key = JSON.stringify([v.grid, v.notes, v.selected, v.clashes, v.phase]);
    if (key !== boardKey) {
      boardKey = key;
      field.innerHTML = v.phase === 'paused' ? '<div class="sdk-paused">⏸ Paused</div>' : window.ArkSudoku.html(v);
    }
    info.innerHTML = '⏱ ' + Ark.clock(v.elapsed) + ' · ' + v.filled + '/81' + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best));
    root.querySelector('.notes-btn').classList.toggle('on', noteMode);
    root.querySelector('.notes-btn').textContent = noteMode ? '✏️ Pencil on' : '✏️ Pencil';
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
  }

  Ark.register('player', 'sudoku', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sdk-phone';
      let keys = '';
      for (let n = 1; n <= 9; n++) keys += '<button data-n="' + n + '">' + n + '</button>';
      root.innerHTML =
        '<div class="info"></div><div class="sdk-field"></div>' +
        '<div class="sdk-keys">' + keys + '</div>' +
        '<div class="sdk-tools"><button class="notes-btn ghost">✏️ Pencil</button><button data-n="0" class="ghost">⌫ Clear</button><button class="ghost pause">⏸ Pause</button></div>';
      el.appendChild(root);
      field = root.querySelector('.sdk-field');
      info = root.querySelector('.info');
      field.addEventListener('click', function (e) {
        const cell = e.target.closest('[data-cell]');
        if (!cell) return;
        api.send({ type: 'select', cell: Number(cell.getAttribute('data-cell')) });
        api.vibrate(5);
      });
      root.addEventListener('click', function (e) {
        const key = e.target.closest('[data-n]');
        if (!key || !view) return;
        const n = Number(key.getAttribute('data-n'));
        api.send(noteMode && n ? { type: 'note', cell: view.selected, n: n } : { type: 'set', cell: view.selected, n: n });
        api.vibrate(8);
      });
      root.querySelector('.notes-btn').addEventListener('click', function () { noteMode = !noteMode; render(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = field = info = view = null;
      boardKey = '';
      noteMode = false;
    },
  });
})();
