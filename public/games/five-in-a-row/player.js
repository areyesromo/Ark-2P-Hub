(function () {
  Ark.loadCss('/games/five-in-a-row/style.css');
  const ready = Ark.loadScript('/games/five-in-a-row/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let aim = null; // the crossing tapped once (tap it again to place: the squares are small)
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.gm-place') && aim !== null) return place();
    const p = e.target.closest('[data-c]');
    if (!p || v.phase !== 'play' || v.turn !== v.you) return;
    const c = Number(p.getAttribute('data-c'));
    if (aim === c) return place();
    aim = c;
    api.vibrate(8);
    render();
  }

  function place() {
    api.send({ type: 'place', cell: aim });
    api.vibrate(15);
    // Screen first: the stone shows at once (the next view confirms it).
    const board = view.board.slice();
    board[aim] = view.you + 1;
    view = Object.assign({}, view, { board: board, turn: 1 - view.you });
    aim = null;
    render();
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'play') {
      if (v.turn !== me) return 'Their turn…';
      return aim === null ? '<strong>Your turn!</strong> Tap where to go' : 'Tap it again (or Place) to put your stone there';
    }
    const r = v.result;
    if (r.winner === null) return 'The board is full: a draw';
    const won = r.winner === me;
    return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    root.innerHTML = '<div class="gm-top"><span class="you"><b class="gm-stone p' + (me + 1) + '"></b> You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span>' +
      (v.captures ? '<span>Pairs ' + v.taken[me] + ' / ' + v.taken[1 - me] + '</span>' : '') +
      (v.timed && mine ? '<span>' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '') + '</div>' +
      '<p class="gm-msg">' + message(v) + '</p>' +
      ArkGomoku.boardHtml(v, { tappable: mine, aim: mine ? aim : null, aimSlot: me }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '<button class="gm-place"' + (mine && aim !== null ? '' : ' disabled') + '>Place stone</button>');
  }

  Ark.register('player', 'five-in-a-row', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'gm-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (aim !== null && (v.board[aim] || v.turn !== v.you)) aim = null;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase && v.result.winner !== null) {
        buzzed = v.round + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () { root = view = null; aim = null; buzzed = ''; },
  });
})();
