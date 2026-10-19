(function () {
  Ark.loadCss('/games/checkers/style.css');
  const boardReady = Ark.loadScript('/games/checkers/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let selected = null; // the piece you tapped, [c, r]
  let buzzed = '';

  const same = function (a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; };

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const sq = e.target.closest('[data-sq]');
    const v = view;
    if (!sq || !v || v.phase !== 'play' || v.turn !== v.you) return;
    const at = sq.getAttribute('data-sq').split(',').map(Number);
    const from = v.chain || selected;
    if (from && v.legal.some(function (m) { return same(m.from, from) && same(m.to, at); })) {
      api.send({ type: 'move', from: from, to: at });
      selected = null;
      api.vibrate(20);
      return;
    }
    if (!v.chain && v.legal.some(function (m) { return same(m.from, at); })) selected = at;
    else if (!v.chain) {
      selected = null;
      // Your own piece that can't move (a jump elsewhere is a must): a short buzz.
      const x = v.board[at[1]][at[0]];
      if (x && (x - 1) % 2 === v.you) api.vibrate([30, 30, 30]);
    }
    render();
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'play') {
      if (v.turn !== you) return 'Their turn…';
      const jump = v.legal.some(function (m) { return Math.abs(m.to[0] - m.from[0]) === 2; });
      return '<strong>' + (v.chain ? 'Keep jumping!' : jump ? 'You must jump!' : 'Your turn!') + '</strong> ' +
        (v.chain || selected ? 'Tap a ◯' : 'Tap a piece') + ' · ' + Math.ceil(v.timeLeftMs / 1000) + 's';
    }
    if (v.phase === 'roundEnd') {
      if (v.result.draw) return '40 quiet moves: a draw';
      return v.result.winner === you ? '<span class="won">You win the round! 🎉</span>' : '<span class="lost">They win the round</span>';
    }
    if (v.phase === 'over') return v.winner === you ? '<span class="won big">You win! 🏆</span>' : '<span class="lost big">You lose</span>';
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const you = v.you;
    const mine = v.phase === 'play' && v.turn === you;
    root.innerHTML =
      '<div class="score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore + '</div>' +
      '<div class="you-are">You are <i class="man p' + (you + 1) + '"></i> · ● ' + v.pieces[you] + ' vs ' + v.pieces[1 - you] + '</div>' +
      '<p class="msg">' + message(v) + '</p>' +
      ArkCK.boardHtml(v, { flip: you === 1, tappable: mine, selected: mine ? v.chain || selected : null, showMovable: mine && !selected && !v.chain }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'checkers', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ck-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      boardReady.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (!prev || prev.turn !== v.turn || prev.round !== v.round) selected = null;
      if (prev && prev.turn !== v.you && v.turn === v.you && v.phase === 'play' && prev.phase === 'play') api.vibrate(40); // your go
      if (v.phase !== 'play' && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        if (v.result && !v.result.draw) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = selected = null;
      buzzed = '';
    },
  });
})();
