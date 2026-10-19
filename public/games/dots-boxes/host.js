(function () {
  Ark.loadCss('/games/dots-boxes/style.css');
  const boardReady = Ark.loadScript('/games/dots-boxes/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  // Controller players: a cursor dot, and whether they pressed A (an arrow then draws).
  const cursors = {};
  const armed = {};

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function status(v) {
    if (v.phase === 'play') {
      const again = v.lastBoxes.length && v.lastLine && v.lastLine.by === v.turn;
      return nameOf(v, v.turn) + (again ? ' closed a box: go again!' : "'s turn") + ' <span class="clock">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>';
    }
    if (v.phase === 'roundEnd') return v.result.draw ? 'Same number of boxes: a draw' : nameOf(v, v.result.winner) + ' takes the round, ' + Math.max(v.score[0], v.score[1]) + ' to ' + Math.min(v.score[0], v.score[1]) + '! 🎉';
    if (v.phase === 'over') {
      return '🏆 ' + nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>' +
        '<div class="sub">Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    return '';
  }

  function initials(v) {
    return v.players.map(function (p) { return esc((p.name || '?').slice(0, 1).toUpperCase()); });
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const local = v.phase === 'play' && v.players[v.turn].local ? v.turn : null;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="db-status">' + status(v) + '</div>' +
      '<div class="db-row"><div class="db-count p1-text">▣ ' + v.score[0] + '</div>' +
      ArkDB.boardSvg(v, Object.assign({ names: initials(v) }, local === null ? {} : { cursor: cursorOf(local, v), armed: armed[local], cursorSlot: local })) +
      '<div class="db-count p2-text">▣ ' + v.score[1] + '</div></div>';
  }

  function cursorOf(slot, v) {
    if (!cursors[slot]) cursors[slot] = { r: Math.floor(v.size / 2), c: Math.floor(v.size / 2) };
    return cursors[slot];
  }

  Ark.register('host', 'dots-boxes', {
    padHint: 'D-pad moves the dot · A, then a direction draws the line from it · B cancels · A: rematch at the end',
    // Sound: a click for every line, a chime for a box.
    sounds: function (prev, v) {
      const out = [];
      const k = function (x) { return x.lastLine ? [x.round, x.lastLine.dir, x.lastLine.r, x.lastLine.c].join(':') : ''; };
      if (k(v) && k(v) !== k(prev)) out.push(v.lastBoxes.length ? 'point' : 'tick');
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd' && v.result.draw) out.push('wrong');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const cur = cursorOf(slot, v);
      const d = { LEFT: [0, -1], RIGHT: [0, 1], UP: [-1, 0], DOWN: [1, 0] }[btn];
      if (btn === 'A') { armed[slot] = !armed[slot]; render(); return null; }
      if (btn === 'B') { armed[slot] = false; render(); return null; }
      if (!d) return null;
      if (armed[slot]) {
        // Draw from the cursor dot towards the arrow, if that line is on the grid and open.
        const line = btn === 'RIGHT' ? ['h', cur.r, cur.c] : btn === 'LEFT' ? ['h', cur.r, cur.c - 1] : btn === 'DOWN' ? ['v', cur.r, cur.c] : ['v', cur.r - 1, cur.c];
        const lines = line[0] === 'h' ? v.h : v.v;
        if (!lines[line[1]] || lines[line[1]][line[2]] !== null) return null;
        armed[slot] = false;
        return { type: 'line', dir: line[0], r: line[1], c: line[2] };
      }
      cursors[slot] = { r: Math.min(v.size, Math.max(0, cur.r + d[0])), c: Math.min(v.size, Math.max(0, cur.c + d[1])) };
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'db-host';
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      [0, 1].forEach(function (s) { delete cursors[s]; delete armed[s]; });
    },
  });
})();
