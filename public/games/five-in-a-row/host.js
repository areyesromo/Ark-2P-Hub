(function () {
  Ark.loadCss('/games/five-in-a-row/style.css');
  const ready = Ark.loadScript('/games/five-in-a-row/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const cursors = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? '<span class="gm-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    return '<aside class="gm-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<b class="gm-stone p' + (slot + 1) + ' big"></b><div class="gm-name">' + nameOf(v, slot) + '</div>' +
      (v.captures ? '<div class="gm-taken">' + v.taken[slot] + '/5 pairs taken</div>' : '') +
      '<div class="gm-turn">' + (active ? 'To play' : '') + clock + '</div></aside>';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    const r = v.result;
    if (r.winner === null) return '<div class="gm-banner"><span class="ark-result draw">The board is full: a draw</span></div>';
    const how = r.how === 'captures' ? 'five pairs taken' : 'five in a row';
    return '<div class="gm-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span><small>' + how +
      (v.phase === 'over' ? ' · Rematch or back to the lobby from your phones or controllers' : '') + '</small></div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const p = v.players[v.turn];
    const local = v.phase === 'play' && p.local && !p.bot;
    if (local && cursors[v.turn] === undefined) cursors[v.turn] = 112;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="gm-stage">' + side(v, 0) + '<div class="gm-centre">' +
      ArkGomoku.boardHtml(v, { cursor: local ? cursors[v.turn] : null, cursorSlot: v.turn }) + banner(v) + '</div>' + side(v, 1) + '</div>';
  }

  Ark.register('host', 'five-in-a-row', {
    padHint: 'D-pad (or stick) moves your ring · A places a stone · A: rematch at the end',
    sounds: function (prev, v) {
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (k(v) && k(v) !== k(prev)) return [v.lastMove.took && v.lastMove.took.length ? 'knock' : 'drop'];
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const c = cursors[slot] === undefined ? 112 : cursors[slot];
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
      root.className = 'gm-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; delete cursors[0]; delete cursors[1]; },
  });
})();
