(function () {
  Ark.loadCss('/games/hex/style.css');
  const ready = Ark.loadScript('/games/hex/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let aim = null; // the hexagon tapped once (tap it again to place: they're small)
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.hx-swap')) { api.send({ type: 'swap' }); api.vibrate(15); return; }
    if (e.target.closest('.hx-place') && aim !== null) return place();
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
    view = Object.assign({}, view, { board: board, turn: 1 - view.you, canSwap: false });
    aim = null;
    render();
  }

  function message(v) {
    const me = v.you;
    const goal = 'the two edges in your colour';
    if (v.phase === 'play') {
      if (v.turn !== me) return 'Their turn… (you join ' + goal + ')';
      if (v.canSwap && aim === null) return '<strong>Your turn!</strong> Play, or <b>Swap</b> to take their first stone';
      return aim === null ? '<strong>Your turn!</strong> Join ' + goal : 'Tap it again (or Place) to put your stone there';
    }
    const won = v.result.winner === me;
    return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    root.innerHTML = '<div class="hx-top"><span class="p' + (me + 1) + '-text">● You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span>' +
      (v.timed && mine ? '<span>' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '') + '</div>' +
      '<p class="hx-msg">' + message(v) + '</p>' +
      ArkHex.boardHtml(v, { tappable: mine, aim: mine ? aim : null, aimSlot: me, upright: true }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>'
        : '<div class="hx-buttons">' + (mine && v.canSwap ? '<button class="hx-swap">⇄ Swap</button>' : '') +
          '<button class="hx-place"' + (mine && aim !== null ? '' : ' disabled') + '>Place stone</button></div>');
  }

  Ark.register('player', 'hex', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hx-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (aim !== null && (v.board[aim] || v.turn !== v.you)) aim = null;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () { root = view = null; aim = null; buzzed = ''; },
  });
})();
