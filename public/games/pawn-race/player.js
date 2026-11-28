(function () {
  Ark.loadCss('/games/pawn-race/style.css');
  const ready = Ark.loadScript('/games/pawn-race/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let card = null; // the card picked from the hand

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (v.phase !== 'move' || v.turn !== v.you) return;
    const c = e.target.closest('[data-card]');
    if (c && !c.disabled) { card = Number(c.getAttribute('data-card')); api.vibrate(8); return render(); }
    const o = e.target.closest('[data-opt]');
    if (o) { api.send({ type: 'move', option: Number(o.getAttribute('data-opt')) }); api.vibrate(15); card = null; }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const won = v.result.winner === me;
      return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
    }
    if (v.turn !== me || v.phase !== 'move') return 'Their turn…';
    if (v.options[0] && v.options[0].kind === 'discard') return '<strong>No move!</strong> Throw a card away';
    return card === null ? '<strong>Your turn!</strong> Pick a card' : 'Pick a move';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'move' && v.turn === me;
    const usable = {};
    if (mine) v.options.forEach(function (o) { usable[o.card] = true; });
    const home = function (s) { return v.pawns[s].filter(function (x) { return x === 45; }).length; };
    let html = '<div class="pr-ptop"><span class="p' + (me + 1) + '-text">● You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span><span>Home: you ' + home(me) + ' · them ' + home(1 - me) + '</span></div>' +
      '<p class="pr-msg">' + message(v) + '</p>';
    let ghost = null;
    const opts = mine && card !== null ? v.options.map(function (o, i) { return [o, i]; }).filter(function (x) { return x[0].card === card; }) : [];
    if (opts.length === 1 && opts[0][0].kind !== 'discard') ghost = { s: me, pawn: opts[0][0].pawn, to: opts[0][0].to };
    html += ArkPawns.boardHtml(v, { ghost: ghost });
    html += '<div class="pr-phand">' + v.hands[me].map(function (c, i) {
      return '<button type="button" data-card="' + i + '"' + (mine && usable[i] ? '' : ' disabled') + '>' + ArkPawns.cardHtml(c, card === i ? 'on' : '') + '</button>';
    }).join('') + '</div>';
    if (opts.length) html += '<div class="pr-opts">' + opts.map(function (x) { return '<button type="button" data-opt="' + x[1] + '">' + Ark.escapeHtml(ArkPawns.describe(v, me, x[0])) + '</button>'; }).join('') + '</div>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'pawn-race', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'pr-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (!prev || prev.n !== v.n) card = null;
      if (prev && v.phase === 'move' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      render();
      Ark.phoneClock(v.phase === 'move' && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; card = null; },
  });
})();
