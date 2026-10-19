(function () {
  Ark.loadCss('/games/checkers/style.css');
  const boardReady = Ark.loadScript('/games/checkers/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  // Controller players: a cursor square and the piece they picked, per slot.
  const cursors = {};
  const picked = {};

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  const WHY = { pieces: 'took every piece', stuck: 'left them with no moves' };

  function status(v) {
    if (v.phase === 'play') {
      return nameOf(v, v.turn) + "'s turn" + (v.chain ? ': keep jumping!' : v.legal.some(function (m) { return Math.abs(m.to[0] - m.from[0]) === 2; }) ? ': a jump is a must' : '') +
        ' <span class="clock">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>';
    }
    if (v.phase === 'roundEnd') return v.result.draw ? '40 quiet moves: a draw' : nameOf(v, v.result.winner) + ' ' + WHY[v.result.why] + '! 🎉';
    if (v.phase === 'over') {
      return '🏆 ' + nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>' +
        '<div class="sub">Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const local = v.phase === 'play' && v.players[v.turn].local ? v.turn : null;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="ck-status">' + status(v) + '</div>' +
      '<div class="ck-row"><div class="ck-count p1-text">● ' + v.pieces[0] + '</div>' +
      ArkCK.boardHtml(v, local === null ? {} : { cursor: cursorOf(local, v), cursorSlot: local, selected: v.chain || picked[local], showMovable: !picked[local] && !v.chain }) +
      '<div class="ck-count p2-text">● ' + v.pieces[1] + '</div></div>';
  }

  function cursorOf(slot, v) {
    // Start on a piece that can move (or the one mid-jump).
    if (!cursors[slot]) cursors[slot] = (v.chain || (v.legal[0] && v.legal[0].from) || [3, slot ? 2 : 5]).slice();
    return cursors[slot];
  }

  const same = function (a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; };

  Ark.register('host', 'checkers', {
    padHint: 'D-pad moves · A picks a piece, A again on a ◯ moves it · B drops it · A: rematch at the end',
    // Sound: a clunk for every move, a chime for a capture.
    sounds: function (prev, v) {
      const out = [];
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.from + '>' + x.lastMove.to : ''; };
      if (k(v) && k(v) !== k(prev)) out.push(v.lastMove.captured.length ? 'point' : 'drop');
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd' && v.result.draw) out.push('wrong');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const cur = cursorOf(slot, v);
      const d = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (d) {
        // Player 2 sits at the top: their "up" is towards row 7.
        const s = slot ? -1 : 1;
        cursors[slot] = [Math.min(v.size - 1, Math.max(0, cur[0] + d[0] * s)), Math.min(v.size - 1, Math.max(0, cur[1] + d[1] * s))];
        render();
        return null;
      }
      if (btn === 'B') { picked[slot] = null; render(); return null; }
      if (btn !== 'A') return null;
      const from = v.chain || picked[slot];
      if (from && v.legal.some(function (m) { return same(m.from, from) && same(m.to, cur); })) {
        picked[slot] = null;
        return { type: 'move', from: from, to: cur.slice() };
      }
      if (!v.chain && v.legal.some(function (m) { return same(m.from, cur); })) picked[slot] = cur.slice();
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ck-host';
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && v.turn !== view.turn) { picked[0] = picked[1] = null; }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      [0, 1].forEach(function (s) { delete cursors[s]; delete picked[s]; });
    },
  });
})();
