(function () {
  Ark.loadCss('/games/mahjong/style.css');
  const ready = Ark.loadScript('/games/mahjong/board.js');

  let root = null;
  let board = null;
  let area = null;
  let stats = null;
  let view = null;
  let cursor = null; // a controller's tile

  function render() {
    const v = view;
    if (!v || !root || !window.ArkMahjong) return;
    if (!board) board = window.ArkMahjong.create(area);
    const local = v.player && v.player.local && v.phase === 'play';
    if (local && (cursor === null || !v.tiles[cursor] || !v.tiles[cursor].here)) cursor = firstFree(v);
    board.update(v, { selected: v.selected, hint: v.hint, cursor: local ? cursor : null });
    stats.innerHTML =
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span><strong>' + v.left + '</strong> tiles left</span>' +
      (v.phase === 'paused' ? '<span><strong>⏸ Paused</strong></span>'
        : v.pairsOpen ? '<span><strong>' + v.pairsOpen + '</strong> pairs you can take</span>'
          : v.left ? '<span class="mj-stuck">No pairs left: undo or shuffle</span>' : '');
  }

  function firstFree(v) {
    const i = v.tiles.findIndex(function (t) { return t.here && t.free; });
    return i === -1 ? v.tiles.findIndex(function (t) { return t.here; }) : i;
  }

  function shake() {
    area.classList.remove('shake');
    void area.offsetWidth; // restart the animation
    area.classList.add('shake');
  }

  Ark.register('host', 'mahjong', {
    sounds: function (prev, v) {
      if (v.left < prev.left) return ['point'];
      if (v.nope > prev.nope) return ['wrong'];
      if (v.selected !== null && v.selected !== prev.selected) return ['flag'];
      return [];
    },
    padHint: 'D-pad move · A pick · X hint (15 s) · Y undo · LB / RB shuffle (30 s) · Start pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      if (btn === 'UP' || btn === 'DOWN' || btn === 'LEFT' || btn === 'RIGHT') {
        if (cursor !== null) cursor = window.ArkMahjong.step(v, cursor, btn);
        render();
        return null;
      }
      if (btn === 'A' && cursor !== null) return { type: 'pick', tile: cursor };
      if (btn === 'X') return { type: 'hint' };
      if (btn === 'Y') return { type: 'undo' };
      if (btn === 'LB' || btn === 'RB') return { type: 'shuffle' };
      return null;
    },
    overHtml: function (v) {
      if (!v.cleared) return 'A pile that isn\'t cleared doesn\'t count';
      return 'Cleared' + (v.hints || v.shuffles ? ' (with ' + [v.hints ? v.hints + ' hint' + (v.hints > 1 ? 's' : '') : '', v.shuffles ? v.shuffles + ' shuffle' + (v.shuffles > 1 ? 's' : '') : ''].filter(Boolean).join(' and ') + ')' : ' with no help at all');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mj-host';
      root.innerHTML = '<div class="mj-stats"></div><div class="mj-board"></div>';
      el.appendChild(root);
      area = root.querySelector('.mj-board');
      stats = root.querySelector('.mj-stats');
      ready.then(render);
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      const nope = view && v.nope > view.nope;
      if (!view || v.left > view.left + 2) cursor = null; // a new deal
      view = v;
      render();
      if (nope) shake();
    },
    unmount: function () {
      root = board = area = stats = view = null;
      cursor = null;
    },
  });
})();
