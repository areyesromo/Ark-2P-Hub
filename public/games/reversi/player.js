(function () {
  Ark.loadCss('/games/reversi/style.css');
  const boardReady = Ark.loadScript('/games/reversi/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let lastKey = '';
  let buzzed = '';

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const cell = e.target.closest('[data-cell]');
    if (!cell || !view || view.phase !== 'play' || view.turn !== view.you) return;
    const c = Number(cell.getAttribute('data-cell'));
    if (!view.legal.includes(c)) return;
    api.send({ type: 'place', cell: c });
    api.vibrate(20);
    // Screen first: the disc goes down at once (the server's view brings the flips a moment later).
    cell.innerHTML = ArkReversi.disc(view.you + 1, 'pop');
    root.querySelectorAll('.rv-hint').forEach(function (h) { h.remove(); });
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'play') {
      return v.turn === you
        ? '<strong>Your turn!</strong> Tap a glowing square' + (v.timed ? ' · ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '')
        : 'Their turn…';
    }
    if (v.phase === 'pass') return v.passed === you ? 'No move for you: they go again' : 'They have no move: <strong>go again!</strong>';
    const d = v.result.discs;
    if (v.result.draw) return '<span class="ark-result draw">A draw, ' + d[0] + ' each</span>';
    const won = v.result.winner === you;
    const line = d[you] + ' to ' + d[1 - you];
    if (v.phase === 'over') return won ? '<span class="won big ark-result">You win! 🏆</span><small>' + line + '</small>' : '<span class="lost big ark-result">You lose</span><small>' + line + '</small>';
    return won ? '<span class="won">You take the game, ' + line + '</span>' : '<span class="lost">They take the game, ' + line + '</span>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const you = v.you;
    const key = ArkReversi.moveKey(v);
    const animate = key !== lastKey;
    lastKey = key;
    const mine = v.phase === 'play' && v.turn === you;
    root.innerHTML =
      '<div class="rv-top"><span class="you-are">' + ArkReversi.disc(you + 1) + ' You are ' + (you ? 'light' : 'dark') + '</span>' +
      '<span class="score">' + (v.winScore > 1 ? 'Games ' + v.scores[you] + ' – ' + v.scores[1 - you] : '') + '</span></div>' +
      '<p class="msg' + (mine ? ' mine' : '') + '">' + message(v) + '</p>' +
      ArkReversi.boardHtml(v, { animate: animate, hints: mine, tappable: mine }) +
      ArkReversi.shareHtml(v) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'reversi', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'rv-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.phase === 'play' && v.turn === v.you && (prev.turn !== v.you || prev.phase !== 'play')) api.vibrate(40); // your go
      if ((v.phase === 'roundEnd' || v.phase === 'over') && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        if (!v.result.draw) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      lastKey = buzzed = '';
    },
  });
})();
