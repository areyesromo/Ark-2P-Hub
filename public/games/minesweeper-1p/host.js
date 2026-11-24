(function () {
  Ark.loadCss('/games/minesweeper-1p/style.css');
  const ready = Ark.loadScript('/games/minesweeper-1p/board.js');

  let root = null;
  let field = null;
  let stats = null;
  let view = null;
  let boardKey = '';
  let statsKey = '';
  const cursor = { x: 0, y: 0 }; // a controller player's cursor

  function render() {
    const v = view;
    if (!v || !window.ArkMines) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const at = cursor.y * v.w + cursor.x;
    const key = v.board + '|' + (local ? at : '');
    if (key !== boardKey) {
      boardKey = key;
      field.innerHTML = window.ArkMines.html(v, { cursor: local ? at : null });
    }
    const left = v.mines - v.flags;
    const s = '<span>💣 <strong>' + left + '</strong> left</span><span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      (v.phase === 'play' && !v.started ? '<span class="muted">Open any cell to start: the first one is always safe</span>' : '') +
      (v.phase === 'over' ? '<span class="' + (v.won ? 'won' : 'lost') + '">' + (v.won ? '🎉 Cleared!' : '💥 Boom') + '</span>' : '');
    if (s !== statsKey) {
      statsKey = s;
      stats.innerHTML = s;
    }
  }

  function moveCursor(dx, dy) {
    cursor.x = (cursor.x + dx + view.w) % view.w;
    cursor.y = (cursor.y + dy + view.h) % view.h;
    render();
  }

  Ark.register('host', 'minesweeper-1p', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return [v.won ? 'correct' : 'boom'];
      if (v.flags !== prev.flags) return ['flag'];
      if (v.board !== prev.board) return ['lock'];
      return [];
    },
    padHint: 'D-pad / arrows move · A / Enter open · X / Q flag',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP') moveCursor(0, -1);
      else if (btn === 'DOWN') moveCursor(0, 1);
      else if (btn === 'LEFT') moveCursor(-1, 0);
      else if (btn === 'RIGHT') moveCursor(1, 0);
      else if (btn === 'A') return { type: 'open', cell: cursor.y * v.w + cursor.x };
      else if (btn === 'X' || btn === 'B') return { type: 'flag', cell: cursor.y * v.w + cursor.x };
      return null;
    },
    overHtml: function (v) {
      return v.won ? 'Cleared ' + v.w + '×' + v.h + ' with ' + v.mines + ' mines' : 'Only a cleared field sets a time';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mines-host';
      root.innerHTML = '<div class="mines-stats"></div><div class="mines-field"></div>';
      el.appendChild(root);
      field = root.querySelector('.mines-field');
      stats = root.querySelector('.mines-stats');
      ready.then(render);
    },
    update: function (v) {
      if (!view || view.w !== v.w) {
        cursor.x = Math.floor(v.w / 2);
        cursor.y = Math.floor(v.h / 2);
      }
      view = v;
      render();
    },
    unmount: function () {
      root = field = stats = view = null;
      boardKey = statsKey = '';
    },
  });
})();
