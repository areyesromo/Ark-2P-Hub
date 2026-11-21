(function () {
  Ark.loadCss('/games/mine-duel/style.css');
  const ready = Ark.loadScript('/games/mine-duel/field.js');

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
    api.send({ type: 'dig', cell: Number(cell.getAttribute('data-cell')) });
    api.vibrate(15);
    cell.classList.add('digging'); // (screen first: the turf lifts while the server digs)
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'play') {
      if (v.turn !== me) return 'Their turn…';
      const again = v.lastMove && v.lastMove.mine && v.lastMove.by === me;
      return (again ? '<span class="won">Got one! Dig again</span>' : '<strong>Your turn!</strong> Dig for a mine') + (v.timed ? ' · ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '');
    }
    const f = v.result.found;
    const line = '<small>' + f[me] + ' mines to ' + f[1 - me] + '</small>';
    if (v.phase === 'over') return (v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>') + line;
    return (v.result.winner === me ? '<span class="won">You take the field!</span>' : '<span class="lost">They take the field</span>') + line;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const key = ArkMD.moveKey(v);
    const animate = key !== lastKey;
    lastKey = key;
    const mine = v.phase === 'play' && v.turn === me;
    root.innerHTML =
      '<div class="md-score"><span class="you p' + (me + 1) + '"><i class="md-flag p' + (me + 1) + '"></i> You <b>' + v.found[me] + '</b></span>' +
      '<span class="need">first to ' + v.need + '</span>' +
      '<span class="them p' + (2 - me) + '"><b>' + v.found[1 - me] + '</b> Them <i class="md-flag p' + (2 - me) + '"></i></span></div>' +
      '<p class="md-msg' + (mine ? ' mine' : '') + '">' + message(v) + '</p>' +
      ArkMD.fieldHtml(v, { animate: animate, tappable: mine }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'mine-duel', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'md-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      const k = ArkMD.moveKey(v);
      if (prev && k && k !== ArkMD.moveKey(prev) && v.lastMove.mine && v.lastMove.by === v.you) api.vibrate([40, 30, 40]);
      else if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      lastKey = buzzed = '';
    },
  });
})();
