(function () {
  Ark.loadCss('/games/mine-duel/style.css');
  const ready = Ark.loadScript('/games/mine-duel/field.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let lastKey = '';
  const cursors = {}; // controller players: slot -> cell

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? '<span class="md-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    let pips = '';
    for (let i = 0; i < v.need; i++) pips += '<i class="' + (i < v.found[slot] ? 'on' : '') + '"></i>';
    const again = active && v.lastMove && v.lastMove.mine && v.lastMove.by === slot;
    return '<aside class="md-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<div class="md-name">' + nameOf(v, slot) + '</div>' +
      '<div class="md-count"><i class="md-flag big p' + (slot + 1) + '"></i>' + v.found[slot] + '<small>/' + v.need + '</small></div>' +
      '<div class="md-pips">' + pips + '</div>' +
      '<div class="md-turn">' + (active ? (again ? 'Found one! Again' : 'To dig') : '') + clock + '</div></aside>';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    const w = v.result.winner;
    const f = v.result.found;
    if (v.phase === 'over') {
      return '<span class="ark-result won">🏆 ' + nameOf(v, w) + ' wins the match</span><small>' + f[w] + ' mines to ' + f[1 - w] + ' · Rematch or back to the lobby from your phones or controllers</small>';
    }
    return '<span class="ark-result won">' + nameOf(v, w) + ' takes the field</span><small>' + f[w] + ' mines to ' + f[1 - w] + '</small>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const key = ArkMD.moveKey(v);
    const animate = key !== lastKey;
    lastKey = key;
    const p = v.players[v.turn];
    const aimer = v.phase === 'play' && p.local && !p.bot ? v.turn : null;
    const left = v.mines - v.found[0] - v.found[1];
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="md-stage">' + side(v, 0) +
      '<div class="md-centre"><div class="md-left"><i class="md-bomb"></i> ' + left + ' mines still buried</div>' +
      ArkMD.fieldHtml(v, { animate: animate, cursor: aimer !== null ? cursorOf(aimer, v) : null, cursorSlot: aimer, banner: banner(v) }) + '</div>' +
      side(v, 1) + '</div>';
  }

  function cursorOf(slot, v) {
    if (cursors[slot] === undefined) cursors[slot] = Math.floor(v.size * v.size / 2 + v.size / 2);
    return cursors[slot];
  }

  Ark.register('host', 'mine-duel', {
    padHint: 'D-pad (or stick) moves your spade · A digs · A: rematch at the end',
    sounds: function (prev, v) {
      const k = ArkMD.moveKey(v);
      if (!k || k === ArkMD.moveKey(prev)) return [];
      if (v.lastMove.mine) return ['boom'];
      return [v.lastMove.opened.length > 6 ? 'whoosh' : 'chalk'];
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
      if (btn === 'A') return v.board[c] === null ? { type: 'dig', cell: c } : null;
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'md-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
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
