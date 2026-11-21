(function () {
  Ark.loadCss('/games/connect-four/style.css');
  const boardReady = Ark.loadScript('/games/connect-four/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let lastMoveKey = '';
  let buzzed = '';
  let served = null; // the server's latest view, while `view` shows a move of ours it hasn't answered yet
  let guessTimer = null;

  function moveKey(v) {
    return v.lastMove ? [v.round, v.lastMove.col, v.lastMove.row].join(':') : '';
  }

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const col = e.target.closest('[data-col]');
    if (!col || !view || view.phase !== 'play' || view.turn !== view.you) return;
    const c = Number(col.getAttribute('data-col'));
    if (view.board[view.rows - 1][c]) return api.vibrate([30, 30, 30]); // full column
    api.send({ type: 'drop', col: c });
    api.vibrate(20);
    guess(c);
  }

  /**
   * Screen first: the disc drops into the column at once, their turn shows, and the server's view
   * confirms it (or, if it refused the move, puts the board back: no view in a second, the last one
   * it sent comes back).
   */
  function guess(c) {
    let row = 0;
    while (row < view.rows && view.board[row][c]) row++;
    if (row >= view.rows) return;
    served = view;
    const board = view.board.map(function (r) { return r.slice(); });
    board[row][c] = view.you + 1;
    view = Object.assign({}, view, { board: board, turn: 1 - view.you, lastMove: { col: c, row: row } });
    render();
    clearTimeout(guessTimer);
    guessTimer = setTimeout(function () {
      if (!served) return;
      view = served;
      served = null;
      render();
    }, 1000);
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'play') {
      return v.turn === you
        ? '<strong>Your turn!</strong> Tap a column' + (v.timed ? ' · ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '')
        : 'Their turn…';
    }
    if (v.phase === 'roundEnd') {
      if (v.result.draw) return 'Board full. Draw!';
      return v.result.winner === you ? '<span class="won">You connected four! 🎉</span>' : '<span class="lost">They connected four</span>';
    }
    if (v.phase === 'over') return v.winner === you ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const you = v.you;
    const key = moveKey(v);
    const animate = key !== lastMoveKey;
    lastMoveKey = key;
    const mine = v.phase === 'play' && v.turn === you;
    root.innerHTML =
      '<div class="score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore + '</div>' +
      '<div class="you-are">You are <i class="disc p' + (you + 1) + '"></i></div>' +
      '<p class="msg">' + message(v) + '</p>' +
      ArkC4.boardHtml(v, { animate: animate, tappable: mine }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'connect-four', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'c4-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      boardReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: function (v) {
      const prev = served || view;
      served = null;
      clearTimeout(guessTimer);
      view = v;
      if (prev && prev.turn !== v.you && v.turn === v.you && v.phase === 'play' && prev.phase === 'play') api.vibrate(40); // your go
      if (v.phase !== 'play' && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        if (v.result && !v.result.draw) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      clearTimeout(guessTimer);
      root = view = served = null;
      lastMoveKey = buzzed = '';
    },
  });
})();
