(function () {
  Ark.loadCss('/games/dots-boxes/style.css');
  const boardReady = Ark.loadScript('/games/dots-boxes/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let buzzed = '';

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const hit = e.target.closest('[data-line]');
    const v = view;
    if (!hit || !v || v.phase !== 'play' || v.turn !== v.you) return;
    const p = hit.getAttribute('data-line').split(',');
    api.send({ type: 'line', dir: p[0], r: Number(p[1]), c: Number(p[2]) });
    api.vibrate(15);
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'play') {
      if (v.turn !== you) return 'Their turn…';
      const again = v.lastBoxes.length && v.lastLine && v.lastLine.by === you;
      return '<strong>' + (again ? 'Box! Go again!' : 'Your turn!') + '</strong> Tap a line · ' + Math.ceil(v.timeLeftMs / 1000) + 's';
    }
    if (v.phase === 'roundEnd') {
      if (v.result.draw) return 'Same number of boxes: a draw';
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
      '<div class="you-are">You are <i class="swatch p' + (you + 1) + '"></i> · boxes ' + v.score[you] + ' vs ' + v.score[1 - you] + '</div>' +
      '<p class="msg">' + message(v) + '</p>' +
      ArkDB.boardSvg(v, { tappable: v.phase === 'play' && v.turn === you, names: ['', ''] }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'dots-boxes', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'db-phone';
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
