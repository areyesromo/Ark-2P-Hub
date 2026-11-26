(function () {
  Ark.loadCss('/games/hex/style.css');
  const ready = Ark.loadScript('/games/hex/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const cursors = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const middle = (v) => Math.floor(v.size / 2) * v.size + Math.floor(v.size / 2);

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? '<span class="hx-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    return '<aside class="hx-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<div class="hx-name">' + nameOf(v, slot) + '</div>' +
      '<div class="hx-goal">' + (slot === 0 ? 'Joins top ↕ bottom' : 'Joins left ↔ right') + '</div>' +
      '<div class="hx-turn">' + (active ? 'To play' : '') + clock + '</div></aside>';
  }

  function note(v) {
    if (v.phase !== 'play') return '';
    if (v.canSwap) {
      const p = v.players[v.turn];
      return nameOf(v, v.turn) + ' may <b>swap</b>: take the first stone as their own' + (p.local && !p.bot ? ' (Y)' : '');
    }
    if (v.lastMove && v.lastMove.swapped) return nameOf(v, v.lastMove.by) + ' took the first stone';
    return '';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    return '<div class="hx-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, v.result.winner) + ' wins</span><small>edge to edge' +
      (v.phase === 'over' ? ' · Rematch or back to the lobby from your phones or controllers' : '') + '</small></div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const p = v.players[v.turn];
    const local = v.phase === 'play' && p.local && !p.bot;
    if (local && cursors[v.turn] === undefined) cursors[v.turn] = middle(v);
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="hx-stage">' + side(v, 0) + '<div class="hx-centre">' +
      ArkHex.boardHtml(v, { cursor: local ? cursors[v.turn] : null, cursorSlot: v.turn }) + banner(v) + '</div>' + side(v, 1) + '</div>' +
      '<div class="hx-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'hex', {
    padHint: 'D-pad (or stick) moves your ring · A places a stone · Y swaps (when you may) · A: rematch at the end',
    sounds: function (prev, v) {
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (prev.phase === 'play' && v.phase !== 'play') return ['fanfare'];
      if (k(v) && k(v) !== k(prev)) return [v.lastMove.swapped ? 'whoosh' : 'drop'];
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      if (btn === 'Y') return v.canSwap ? { type: 'swap' } : null;
      const c = cursors[slot] === undefined ? middle(v) : cursors[slot];
      const d = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (d) {
        const x = Math.min(v.size - 1, Math.max(0, (c % v.size) + d[0]));
        const y = Math.min(v.size - 1, Math.max(0, Math.floor(c / v.size) + d[1]));
        cursors[slot] = y * v.size + x;
        render();
        return null;
      }
      return btn === 'A' && !v.board[c] ? { type: 'place', cell: c } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hx-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && v.size !== view.size) { delete cursors[0]; delete cursors[1]; }
      view = v;
      render();
    },
    unmount: function () { root = view = null; delete cursors[0]; delete cursors[1]; },
  });
})();
