(function () {
  Ark.loadCss('/games/ultimate-ttt/style.css');
  const ready = Ark.loadScript('/games/ultimate-ttt/board.js');
  const esc = Ark.escapeHtml;
  const MARK = ['✕', '◯'];
  const WHERE = ['top-left', 'top', 'top-right', 'left', 'middle', 'right', 'bottom-left', 'bottom', 'bottom-right'];

  let root = null;
  let view = null;
  let loaded = false;
  const cursors = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? '<span class="ut-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    const won = v.boards.filter((b) => b === slot + 1).length;
    return '<aside class="ut-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<div class="mark p' + (slot + 1) + '-text">' + MARK[slot] + '</div><div class="ut-name">' + nameOf(v, slot) + '</div>' +
      '<div>' + won + (won === 1 ? ' board' : ' boards') + '</div>' +
      '<div class="ut-turn">' + (active ? 'To play' : '') + clock + '</div></aside>';
  }

  function note(v) {
    if (v.phase !== 'play') return '';
    if (v.next < 0) return nameOf(v, v.turn) + ' may play in any open board';
    return nameOf(v, v.turn) + ' must play in the ' + WHERE[v.next] + ' board';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    const r = v.result;
    if (r.winner === null) return '<div class="ut-banner"><span class="ark-result draw">No line left: a draw</span></div>';
    return '<div class="ut-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span><small>three boards in a row' +
      (v.phase === 'over' ? ' · Rematch or back to the lobby from your phones or controllers' : '') + '</small></div>';
  }

  /** A controller's cursor starts on the first square it may take. */
  function startAt(v) {
    for (let c = 0; c < 81; c++) if (ArkUttt.legal(v, c)) return c;
    return 40;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const p = v.players[v.turn];
    const local = v.phase === 'play' && p.local && !p.bot;
    if (local && (cursors[v.turn] === undefined || !ArkUttt.legal(v, cursors[v.turn]))) {
      // Keep the cursor if it's on a square it may take; else move it into the board to play in.
      const c = cursors[v.turn];
      if (c === undefined || v.next >= 0 || v.cells[c]) cursors[v.turn] = startAt(v);
    }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="ut-stage">' + side(v, 0) + '<div class="ut-centre">' +
      ArkUttt.boardHtml(v, { cursor: local ? cursors[v.turn] : null, cursorSlot: v.turn }) + banner(v) + '</div>' + side(v, 1) + '</div>' +
      '<div class="ut-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'ultimate-ttt', {
    padHint: 'D-pad (or stick) moves your ring · A places your mark · A: rematch at the end',
    sounds: function (prev, v) {
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (prev.phase === 'play' && v.phase !== 'play') return [v.result.winner === null ? 'close' : 'fanfare'];
      if (k(v) && k(v) !== k(prev)) {
        const won = v.boards.filter(Boolean).length > prev.boards.filter(Boolean).length;
        return [won ? 'point' : 'drop'];
      }
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const c = cursors[slot] === undefined ? startAt(v) : cursors[slot];
      const d = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (d) {
        const xy = ArkUttt.toXY(c);
        cursors[slot] = ArkUttt.fromXY(Math.min(8, Math.max(0, xy[0] + d[0])), Math.min(8, Math.max(0, xy[1] + d[1])));
        render();
        return null;
      }
      return btn === 'A' && ArkUttt.legal(v, c) ? { type: 'place', cell: c } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ut-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; delete cursors[0]; delete cursors[1]; },
  });
})();
