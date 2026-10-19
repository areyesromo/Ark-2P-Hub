(function () {
  Ark.loadCss('/games/mancala/style.css');
  const boardReady = Ark.loadScript('/games/mancala/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  // Controller players: which of their pits they aim at, as a column on the TV (0 = left).
  const cols = {};

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  // P1's pits run 0..5 left to right along the bottom; P2's 12..7 along the top.
  const pitAt = function (slot, col) { return slot === 0 ? col : 12 - col; };

  function moveNote(v) {
    const m = v.lastMove;
    if (!m) return '';
    if (m.captured) return ' · ' + nameOf(v, m.slot) + ' captured ' + m.captured.stones + '!';
    if (m.again && v.phase === 'play') return ' · in the store: go again!';
    return '';
  }

  function status(v) {
    if (v.phase === 'play') return nameOf(v, v.turn) + "'s turn" + moveNote(v) + ' <span class="clock">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>';
    if (v.phase === 'roundEnd') {
      const st = v.result.stores;
      return v.result.draw ? 'A draw: ' + st[0] + ' each' : nameOf(v, v.result.winner) + ' wins the round ' + Math.max(st[0], st[1]) + ' : ' + Math.min(st[0], st[1]) + '! 🎉';
    }
    if (v.phase === 'over') {
      return '🏆 ' + nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>' +
        '<div class="sub">Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    return '';
  }

  function colOf(slot, v) {
    if (cols[slot] === undefined) {
      // Start on a pit that has stones.
      const first = v.legal.length ? v.legal[0] : pitAt(slot, 0);
      cols[slot] = slot === 0 ? first : 12 - first;
    }
    return cols[slot];
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const local = v.phase === 'play' && v.players[v.turn].local ? v.turn : null;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="mc-status">' + status(v) + '</div>' +
      '<div class="mc-wrap">' + ArkMC.boardHtml(v, local === null ? {} : { cursor: pitAt(local, colOf(local, v)), cursorSlot: local, tappable: true }) + '</div>';
  }

  Ark.register('host', 'mancala', {
    padHint: 'D-pad ← → picks a pit · A sows it · A: rematch at the end',
    // Sound: a patter for a sow, a chime for a capture or a go-again.
    sounds: function (prev, v) {
      const out = [];
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (k(v) && k(v) !== k(prev)) out.push(v.lastMove.captured || v.lastMove.again ? 'point' : 'drop');
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd' && v.result.draw) out.push('wrong');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const c = colOf(slot, v);
      if (btn === 'LEFT' || btn === 'RIGHT') {
        cols[slot] = Math.min(5, Math.max(0, c + (btn === 'LEFT' ? -1 : 1)));
        render();
        return null;
      }
      if (btn === 'A' || btn === 'DOWN') return { type: 'sow', pit: pitAt(slot, c) };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mc-host';
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      delete cols[0];
      delete cols[1];
    },
  });
})();
