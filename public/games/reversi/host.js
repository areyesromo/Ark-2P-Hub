(function () {
  Ark.loadCss('/games/reversi/style.css');
  const boardReady = Ark.loadScript('/games/reversi/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let lastKey = '';
  const cursors = {}; // controller players aim with the D-pad: slot -> cell

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function banner(v) {
    if (v.phase === 'pass') return nameOf(v, v.passed) + ' has no move, so ' + nameOf(v, v.turn) + ' goes again';
    if (v.phase === 'roundEnd' || v.phase === 'over') {
      const d = v.result.discs;
      if (v.result.draw) return '<span class="ark-result draw">Level at ' + d[0] + ' each. A draw!</span>';
      const w = v.result.winner;
      const head = v.phase === 'over' ? '🏆 ' + nameOf(v, w) + ' wins the match' : nameOf(v, w) + ' takes the game';
      return '<span class="ark-result won">' + head + '</span><small>' + d[w] + ' discs to ' + d[1 - w] + '</small>' +
        (v.phase === 'over' ? '<small>Rematch or back to the lobby from your phones or controllers.</small>' : '');
    }
    return '';
  }

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? '<span class="rv-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    return '<aside class="rv-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      ArkReversi.disc(slot + 1, 'big') +
      '<div class="rv-name">' + nameOf(v, slot) + '</div>' +
      '<div class="rv-count">' + v.discs[slot] + '</div>' +
      '<div class="rv-label">discs</div>' +
      '<div class="rv-turn">' + (active ? 'To play' : '') + clock + '</div>' +
      '</aside>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const key = ArkReversi.moveKey(v);
    const animate = key !== lastKey;
    lastKey = key;
    const p = v.players[v.turn];
    const aimer = v.phase === 'play' && p.local && !p.bot ? v.turn : null;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="rv-stage">' + side(v, 0) +
      ArkReversi.boardHtml(v, { animate: animate, hints: true, cursor: aimer !== null ? cursorOf(aimer, v) : null, cursorSlot: aimer, banner: banner(v) }) +
      side(v, 1) + '</div>';
  }

  function cursorOf(slot, v) {
    if (cursors[slot] === undefined || cursors[slot] >= v.size * v.size) cursors[slot] = v.legal[0] !== undefined ? v.legal[0] : 27;
    return cursors[slot];
  }

  Ark.register('host', 'reversi', {
    padHint: 'D-pad (or stick) moves your ring · A places a disc · A: rematch at the end',
    // A clunk for a disc down, a sweep for a big flip, a buzz for a pass.
    sounds: function (prev, v) {
      const out = [];
      const k = ArkReversi.moveKey(v);
      if (k && k !== ArkReversi.moveKey(prev)) out.push(v.lastMove.flips.length >= 5 ? 'whoosh' : 'drop');
      if (v.phase === 'pass' && prev.phase !== 'pass') out.push('wrong');
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd' && v.result.draw) out.push('close');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const c = cursorOf(slot, v);
      const d = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (d) {
        const x = Math.min(v.size - 1, Math.max(0, (c % v.size) + d[0]));
        const y = Math.min(v.size - 1, Math.max(0, Math.floor(c / v.size) + d[1]));
        cursors[slot] = y * v.size + x;
        render();
        return null;
      }
      if (btn === 'A') return v.legal.includes(c) ? { type: 'place', cell: c } : null;
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'rv-host';
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && (v.turn !== view.turn || v.round !== view.round)) {
        // A fresh turn: aim at a legal square, nearest the old aim.
        const s = v.turn;
        if (cursors[s] !== undefined && v.legal.length && !v.legal.includes(cursors[s])) {
          const at = cursors[s];
          const dist = (c) => Math.max(Math.abs((c % v.size) - (at % v.size)), Math.abs(Math.floor(c / v.size) - Math.floor(at / v.size)));
          cursors[s] = v.legal.slice().sort((a, b) => dist(a) - dist(b))[0];
        }
      }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      lastKey = '';
      Object.keys(cursors).forEach(function (k) { delete cursors[k]; });
    },
  });
})();
