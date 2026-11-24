(function () {
  Ark.loadCss('/games/morris/style.css');
  const ready = Ark.loadScript('/games/morris/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let from = null;
  let buzzed = '';

  function send(input) {
    api.send(input);
    api.vibrate(15);
    from = null;
  }

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const hit = e.target.closest('[data-p]');
    if (!hit || v.phase !== 'play' || v.turn !== v.you) return;
    const p = Number(hit.getAttribute('data-p'));
    if (v.step === 'take') { if (v.takeable.includes(p)) send({ type: 'take', at: p }); return; }
    if (v.stage === 'place') { if (v.actions.some(function (a) { return a.at === p; })) send({ type: 'place', at: p }); return; }
    if (from !== null && v.actions.some(function (a) { return a.from === from && a.to === p; })) return send({ type: 'move', from: from, to: p });
    const moves = v.actions.filter(function (a) { return a.from === p; });
    if (!moves.length) { from = null; return render(); }
    if (moves.length === 1 && v.stage !== 'fly') return send({ type: 'move', from: p, to: moves[0].to });
    from = from === p ? null : p;
    render();
  }

  function message(v) {
    const me = v.you;
    if (v.phase !== 'play') {
      const r = v.result;
      if (r.winner === null) return 'A draw (fifty moves without a mill)';
      const won = r.winner === me;
      return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
    }
    if (v.turn !== me) return 'Their turn…';
    if (v.step === 'take') return '<strong>A mill!</strong> Tap one of theirs to take';
    if (v.stage === 'place') return '<strong>Your turn:</strong> place a piece';
    if (from !== null) return 'Now where it goes';
    return v.stage === 'fly' ? '<strong>Three left: fly!</strong> Pick a piece' : '<strong>Your turn:</strong> pick a piece to move';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    const targets = mine && from !== null ? new Set(v.actions.filter(function (a) { return a.from === from; }).map(function (a) { return a.to; })) : new Set();
    const shown = mine ? v : Object.assign({}, v, { actions: [], takeable: [] });
    root.innerHTML = '<div class="mo-top"><span>' + ArkMorris.stones(1, me) + ' You ' + (v.counts[me] + v.inHand[me]) + ' · Them ' + (v.counts[1 - me] + v.inHand[1 - me]) + '</span>' +
      '<span>' + (v.inHand[me] ? v.inHand[me] + ' to place' : '') + (mine && v.timed ? ' · ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '') + '</span></div>' +
      '<p class="mo-msg">' + message(v) + '</p>' +
      ArkMorris.boardHtml(shown, { tappable: mine, from: from === null ? undefined : from, targets: targets }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '');
  }

  Ark.register('player', 'morris', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mo-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (from !== null && !v.actions.some(function (a) { return a.from === from; })) from = null;
      if (prev && v.phase === 'play' && v.turn === v.you && (prev.turn !== v.you || prev.step !== v.step)) api.vibrate(v.step === 'take' ? [40, 30, 40] : 40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase && v.result.winner !== null) { buzzed = v.round + v.phase; api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200); }
      render();
    },
    unmount: function () { root = view = null; from = null; buzzed = ''; },
  });
})();
