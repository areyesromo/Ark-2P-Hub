(function () {
  Ark.loadCss('/games/chinese-checkers/style.css');
  const ready = Ark.loadScript('/games/chinese-checkers/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = null;
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const svg = e.target.closest('.cc-board');
    if (!svg || v.phase !== 'play' || v.turn !== v.you) return;
    const c = ArkStar.holeAt(svg, e.clientX, e.clientY, v.you === 1);
    if (c < 0) return;
    if (v.board[c] === v.you + 1) { picked = picked === c ? null : c; api.vibrate(8); return render(); }
    if (picked !== null && ArkStar.movesFrom(v.board, picked).includes(c)) {
      api.send({ type: 'move', from: picked, to: c });
      api.vibrate(15);
      picked = null;
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'play') {
      if (v.turn !== me) return 'Their turn…';
      return picked === null ? '<strong>Your turn!</strong> Tap one of your pieces' : 'Tap a lit hole to move there';
    }
    const r = v.result;
    if (r.winner === null) return 'Level!';
    const won = r.winner === me;
    return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    const opts = { flip: me === 1, me: me, tap: mine, picked: mine ? picked : null, targets: mine && picked !== null ? ArkStar.movesFrom(v.board, picked) : [] };
    root.innerHTML = '<div class="cc-top"><span class="p' + (me + 1) + '-text">● You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span><span>' + v.home[me] + '/10 home · ' + v.toGo[me] + ' to go</span></div>' +
      '<p class="cc-msg">' + message(v) + '</p>' + ArkStar.boardHtml(v, opts) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'chinese-checkers', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'cc-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (v.turn !== v.you) picked = null;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase && v.result.winner !== null) {
        buzzed = v.round + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
      Ark.phoneClock(v.phase === 'play' && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; picked = null; buzzed = ''; },
  });
})();
