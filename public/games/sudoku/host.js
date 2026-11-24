(function () {
  Ark.loadCss('/games/sudoku/style.css');
  const ready = Ark.loadScript('/games/sudoku/board.js');
  const STEP = { UP: -9, DOWN: 9, LEFT: -1, RIGHT: 1 };

  let root = null;
  let field = null;
  let stats = null;
  let view = null;
  let boardKey = '';
  let pen = 1; // the number a controller places with A (X / Y change it)

  /** The cell next to i, wrapping round within its row or column. */
  function step(i, btn) {
    if (btn === 'LEFT' || btn === 'RIGHT') return Math.floor(i / 9) * 9 + ((i % 9) + STEP[btn] + 9) % 9;
    return (i + STEP[btn] + 81) % 81;
  }

  function render() {
    const v = view;
    if (!v || !window.ArkSudoku) return;
    const key = JSON.stringify([v.grid, v.notes, v.selected, v.clashes, v.phase]);
    if (key !== boardKey) {
      boardKey = key;
      field.innerHTML = v.phase === 'paused' ? '<div class="sdk-paused">⏸ Paused</div>' : window.ArkSudoku.html(v);
    }
    const local = v.player && v.player.local;
    stats.innerHTML =
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span><strong>' + v.filled + '</strong> / 81</span>' +
      (local ? '<span>Pen <strong class="pen">' + pen + '</strong> <span class="muted">(X / Y)</span></span>' : '') +
      (v.clashes.length ? '<span class="clash-note">Two of the same number in a line or box</span>' : '');
  }

  Ark.register('host', 'sudoku', {
    sounds: function (prev, v) {
      if (v.moves > prev.moves) return [v.clashes.length > prev.clashes.length ? 'wrong' : 'lock'];
      return [];
    },
    padHint: 'D-pad move · A place the pen number · X / Y change it · B clear · Start pause · keyboard: type 1–9, 0 clears',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      if (STEP[btn]) return { type: 'select', cell: step(v.selected, btn) };
      if (btn === 'X' || btn === 'Y') {
        pen = ((pen - 1 + (btn === 'Y' ? 1 : 8)) % 9) + 1;
        render();
        return null;
      }
      if (btn === 'A') return { type: 'set', cell: v.selected, n: pen };
      if (btn === 'B') return { type: 'set', cell: v.selected, n: 0 };
      return null;
    },
    typing: function (key, v) {
      if (v.phase !== 'play') return null;
      if (/^[1-9]$/.test(key)) return { type: 'set', cell: v.selected, n: Number(key) };
      if (key === '0' || key === 'Delete' || key === 'Backspace') return { type: 'set', cell: v.selected, n: 0 };
      return null;
    },
    overHtml: function (v) {
      return 'Solved in ' + v.moves + ' moves';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sdk-host';
      root.innerHTML = '<div class="sdk-stats"></div><div class="sdk-field"></div>';
      el.appendChild(root);
      field = root.querySelector('.sdk-field');
      stats = root.querySelector('.sdk-stats');
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = field = stats = view = null;
      boardKey = '';
      pen = 1;
    },
  });
})();
