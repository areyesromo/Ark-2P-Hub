(function () {
  Ark.loadCss('/games/mancala/style.css');
  const boardReady = Ark.loadScript('/games/mancala/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let buzzed = '';

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const cell = e.target.closest('[data-pit]');
    const v = view;
    if (!cell || !v || v.phase !== 'play' || v.turn !== v.you) return;
    const pit = Number(cell.getAttribute('data-pit'));
    if (v.legal.indexOf(pit) === -1) return api.vibrate([30, 30, 30]); // empty, or theirs
    api.send({ type: 'sow', pit: pit });
    api.vibrate(20);
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'play') {
      const m = v.lastMove;
      const note = m && m.captured ? (m.slot === you ? 'You captured ' + m.captured.stones + '! ' : 'They captured ' + m.captured.stones + '. ') : '';
      if (v.turn !== you) return note + 'Their turn…';
      return note + '<strong>' + (m && m.again && m.slot === you ? 'Go again!' : 'Your turn!') + '</strong> Tap a bowl on your side · ' + Math.ceil(v.timeLeftMs / 1000) + 's';
    }
    if (v.phase === 'roundEnd') {
      if (v.result.draw) return 'A draw!';
      return v.result.winner === you ? '<span class="won">You win the round! 🎉</span>' : '<span class="lost">They win the round</span>';
    }
    if (v.phase === 'over') return v.winner === you ? '<span class="won big">You win! 🏆</span>' : '<span class="lost big">You lose</span>';
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const you = v.you;
    root.innerHTML =
      '<div class="score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore + '</div>' +
      '<div class="you-are">Your store is on the right <i class="dot p' + (you + 1) + '"></i></div>' +
      '<p class="msg">' + message(v) + '</p>' +
      ArkMC.boardHtml(v, { viewer: you, tappable: v.phase === 'play' && v.turn === you }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'mancala', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mc-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && prev.turn !== v.you && v.turn === v.you && v.phase === 'play' && prev.phase === 'play') api.vibrate(40); // your go
      if (v.phase !== 'play' && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        if (v.result && !v.result.draw) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      buzzed = '';
    },
  });
})();
