(function () {
  Ark.loadCss('/games/connect-four/style.css');
  const boardReady = Ark.loadScript('/games/connect-four/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let lastMoveKey = '';
  const cursors = {}; // controller players aim with LEFT/RIGHT: slot -> column

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function status(v) {
    if (v.phase === 'play') return nameOf(v, v.turn) + "'s turn <span class=\"clock\">⏱ " + Math.ceil(v.timeLeftMs / 1000) + 's</span>';
    if (v.phase === 'roundEnd') return v.result.draw ? 'Board full. Draw!' : nameOf(v, v.result.winner) + ' connects four! 🎉';
    if (v.phase === 'over') {
      return '🏆 ' + nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>' +
        '<div class="sub">Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    return '';
  }

  function moveKey(v) {
    return v.lastMove ? [v.round, v.lastMove.col, v.lastMove.row].join(':') : '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const key = moveKey(v);
    const animate = key !== lastMoveKey;
    lastMoveKey = key;
    const aimer = v.phase === 'play' && v.players[v.turn].local ? v.turn : null;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="c4-status">' + status(v) + '</div>' +
      ArkC4.boardHtml(v, { animate: animate, cursor: aimer !== null ? cursorOf(aimer) : null, cursorSlot: aimer });
  }

  function cursorOf(slot) {
    if (cursors[slot] === undefined) cursors[slot] = 3;
    return cursors[slot];
  }

  Ark.register('host', 'connect-four', {
    padHint: 'D-pad ← → (or stick) aims · A or ↓ drops · A: rematch at the end',
    // Sound: a clunk for every disc; a buzz for a drawn round (wins come from the TV shell).
    sounds: function (prev, v) {
      const out = [];
      if (moveKey(v) && moveKey(v) !== moveKey(prev)) out.push('drop');
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd' && v.result.draw) out.push('wrong');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const c = cursorOf(slot);
      if (btn === 'LEFT' || btn === 'RIGHT') {
        cursors[slot] = Math.min(v.cols - 1, Math.max(0, c + (btn === 'LEFT' ? -1 : 1)));
        render();
        return null;
      }
      if (btn === 'A' || btn === 'DOWN') return { type: 'drop', col: c };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'c4-host';
      el.appendChild(root);
      boardReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      lastMoveKey = '';
      Object.keys(cursors).forEach(function (k) { delete cursors[k]; });
    },
  });
})();
