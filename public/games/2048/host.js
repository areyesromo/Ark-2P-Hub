(function () {
  Ark.loadCss('/games/2048/style.css');
  const PAD_DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  let root = null;
  let board = null;
  let stats = null;
  let tiles = {}; // id -> element, so tiles slide to their new cell instead of being redrawn
  let size = 4;

  function place(el, t) {
    el.style.left = (t.x * 100) / size + '%';
    el.style.top = (t.y * 100) / size + '%';
  }

  function render(v) {
    size = v.size;
    board.parentNode.className = 'g2048-board look-' + (v.look || 'classic'); // the unlockable looks: see style.css
    const seen = {};
    v.tiles.forEach(function (t) {
      seen[t.id] = true;
      let el = tiles[t.id];
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile v' + Math.min(t.v, 4096) + (t.fresh ? ' fresh' : '') + (t.merged ? ' merged' : '');
        el.style.width = el.style.height = 100 / size + '%';
        el.innerHTML = '<span>' + t.v + '</span>';
        board.appendChild(el);
        tiles[t.id] = el;
      }
      place(el, t);
    });
    // Tiles that merged away: slide them under the new tile, then drop them.
    Object.keys(tiles).forEach(function (id) {
      if (seen[id]) return;
      const el = tiles[id];
      delete tiles[id];
      el.classList.add('gone');
      setTimeout(function () { el.remove(); }, 140);
    });
    stats.innerHTML =
      '<span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span>' +
      '<span>Biggest tile <strong>' + v.biggest + '</strong></span>' +
      '<span>Moves <strong>' + v.moves + '</strong></span>' +
      (v.reached ? '<span class="goal">🎉 2048! Keep going</span>' : '');
  }

  Ark.register('host', '2048', {
    sounds: function (prev, v) {
      if (v.moves === prev.moves) return [];
      return [v.score > prev.score ? 'merge' : 'slide'];
    },
    padHint: 'D-pad, stick or arrows slide the tiles',
    pad: function (btn) {
      return PAD_DIRS[btn] ? { type: 'move', dir: PAD_DIRS[btn] } : null;
    },
    overHtml: function (v) {
      return 'Biggest tile ' + v.biggest + ' · ' + v.moves + ' moves';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'g2048-host';
      root.innerHTML = '<div class="g2048-stats"></div><div class="g2048-wrap"><div class="g2048-board"><div class="cells"><div class="grid"></div></div></div></div>';
      el.appendChild(root);
      board = root.querySelector('.cells');
      stats = root.querySelector('.g2048-stats');
      root.querySelector('.grid').innerHTML = new Array(17).join('<i></i>');
    },
    update: render,
    unmount: function () {
      root = board = stats = null;
      tiles = {};
    },
  });
})();
