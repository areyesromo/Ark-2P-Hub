(function () {
  Ark.loadCss('/games/chinese-checkers/style.css');
  const ready = Ark.loadScript('/games/chinese-checkers/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const pads = {}; // a controller player's aim: { at, picked }

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? ' ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '';
    const p = v.players[slot];
    const help = active && p.local && !p.bot ? '<small>D-pad moves · A picks a piece, A again moves it · B puts it back</small>' : '';
    return '<aside class="cc-side p' + (slot + 1) + (active ? ' active' : '') + '"><div class="cc-name">' + nameOf(v, slot) + '</div>' +
      '<div class="cc-stat"><b>' + v.home[slot] + '</b> of 10 home</div><div class="cc-stat"><b>' + v.toGo[slot] + '</b> steps to go</div>' +
      '<div class="cc-turn">' + (active ? 'To play' + clock : '') + help + '</div></aside>';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    const r = v.result;
    if (r.winner === null) return '<div class="cc-banner"><span class="ark-result draw">Out of moves: level</span></div>';
    return '<div class="cc-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + (r.how === 'home' ? ' fills the far point!' : ' is further on') + '</span>' +
      (v.phase === 'over' ? '<small>Rematch or back to the lobby from your phones or controllers</small>' : '') + '</div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const s = v.turn;
    const p = v.phase === 'play' ? v.players[s] : null;
    let opts = {};
    if (p && p.local && !p.bot) {
      const pad = pads[s] || (pads[s] = { at: v.board.indexOf(s + 1), picked: null });
      opts = { cursor: pad.at, cursorSlot: s, picked: pad.picked, targets: pad.picked !== null ? ArkStar.movesFrom(v.board, pad.picked) : [] };
    }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="cc-stage">' + side(v, 0) + '<div class="cc-centre">' + ArkStar.boardHtml(v, opts) + banner(v) + '</div>' + side(v, 1) + '</div>';
  }

  Ark.register('host', 'chinese-checkers', {
    padHint: 'D-pad moves your ring · A picks a piece, then A on a lit hole moves it · B puts it back · A: rematch at the end',
    sounds: function (prev, v) {
      if (prev.phase === 'play' && v.phase !== 'play') return ['fanfare'];
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (k(v) && k(v) !== k(prev)) return ['drop'];
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const pad = pads[slot] || (pads[slot] = { at: v.board.indexOf(slot + 1), picked: null });
      if (['LEFT', 'RIGHT', 'UP', 'DOWN'].includes(btn)) pad.at = ArkStar.nextHole(pad.at, btn);
      else if (btn === 'B') pad.picked = null;
      else if (btn === 'A') {
        if (v.board[pad.at] === slot + 1) pad.picked = pad.at;
        else if (pad.picked !== null && ArkStar.movesFrom(v.board, pad.picked).includes(pad.at)) {
          const from = pad.picked;
          pad.picked = null;
          return { type: 'move', from: from, to: pad.at };
        }
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'cc-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && (view.turn !== v.turn || view.round !== v.round)) { delete pads[0]; delete pads[1]; }
      view = v;
      render();
    },
    unmount: function () { root = view = null; delete pads[0]; delete pads[1]; },
  });
})();
