(function () {
  Ark.loadCss('/games/go/style.css');
  const ready = Ark.loadScript('/games/go/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let aim = null; // the point tapped once (tap again, or Place, to play there)
  let resignArmed = false;
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.go-resign')) {
      if (!resignArmed) { resignArmed = true; setTimeout(function () { resignArmed = false; render(); }, 3000); return render(); }
      resignArmed = false;
      return api.send({ type: 'resign' });
    }
    if (v.phase !== 'play' || v.turn !== v.you) return;
    if (e.target.closest('.go-pass')) { aim = null; api.send({ type: 'pass' }); api.vibrate(15); return; }
    if (e.target.closest('.go-place') && aim !== null) return place();
    const p = e.target.closest('[data-c]');
    if (!p) return;
    const c = Number(p.getAttribute('data-c'));
    if (aim === c) return place();
    aim = c;
    api.vibrate(8);
    render();
  }

  function place() {
    api.send({ type: 'place', cell: aim });
    api.vibrate(15);
    aim = null;
    render();
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'play') {
      const passed = v.lastMove && v.lastMove.cell === -1 && v.lastMove.by !== me ? 'They passed. ' : '';
      if (v.turn !== me) return 'Their turn…';
      return aim === null ? passed + '<strong>Your turn!</strong> Tap a point' + (passed ? ', or pass to end the game' : '') : 'Tap it again (or Place) to play there';
    }
    const r = v.result;
    const won = r.winner === me;
    const how = r.how === 'resign' ? (won ? 'They resigned' : 'You resigned') : 'You ' + r.points[me] + ' · them ' + r.points[1 - me];
    return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span><br><small>' + how + '</small>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    const col = me === v.black ? 'b' : 'w';
    root.innerHTML = '<div class="go-top"><span><i class="stone ' + col + '"></i> You (' + (col === 'b' ? 'black' : 'white') + ') ' + v.scores[me] + ' – ' + v.scores[1 - me] + '</span>' +
      '<span>taken ' + v.taken[me] + ' / ' + v.taken[1 - me] + '</span></div>' +
      '<p class="go-msg">' + message(v) + '</p>' +
      ArkGo.boardHtml(v, { tappable: mine, aim: mine ? aim : null, aimColour: me === v.black ? 1 : 2, dead: v.result ? v.result.dead : [] }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>'
        : v.phase === 'play' ? '<div class="go-buttons"><button type="button" class="go-place"' + (mine && aim !== null ? '' : ' disabled') + '>Place stone</button>' +
          '<button type="button" class="go-pass"' + (mine ? '' : ' disabled') + '>Pass</button>' +
          '<button type="button" class="go-resign' + (resignArmed ? ' armed' : '') + '">' + (resignArmed ? 'Sure?' : 'Resign') + '</button></div>' : '');
  }

  Ark.register('player', 'go', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'go-phone';
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
      Ark.phoneClock(v.phase === 'play' && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; aim = null; buzzed = ''; },
  });
})();
