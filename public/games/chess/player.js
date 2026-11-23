(function () {
  Ark.loadCss('/games/chess/style.css');
  const ready = Ark.loadScript('/games/chess/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let from = null; // the piece picked
  let promoting = null; // { from, to } waiting for what the pawn becomes
  let resigning = false;
  let gotAt = 0;
  let tick = null;
  let buzzed = '';
  let served = null; // the server's last view, while a move of ours shows ahead of it
  let guessTimer = null;

  const mineColour = (v) => (v.you === v.whiteSlot ? 'w' : 'b');

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.ch-resign')) {
      if (!resigning) { resigning = true; render(); setTimeout(function () { resigning = false; render(); }, 3000); return; }
      api.send({ type: 'resign' });
      resigning = false;
      return;
    }
    const pr = e.target.closest('[data-promo]');
    if (pr && promoting) {
      api.send({ type: 'move', from: promoting.from, to: promoting.to, promo: pr.getAttribute('data-promo') });
      promoting = null;
      from = null;
      return render();
    }
    const cell = e.target.closest('[data-sq]');
    if (!cell || v.phase !== 'play' || v.turnSlot !== v.you) return;
    const sq = Number(cell.getAttribute('data-sq'));
    if (from !== null) {
      const moves = v.legal.filter(function (m) { return m.from === from && m.to === sq; });
      if (moves.length) {
        if (moves[0].promo) { promoting = { from: from, to: sq }; return render(); }
        api.send({ type: 'move', from: from, to: sq });
        api.vibrate(15);
        // Screen first: the piece moves at once on a copy of the view; the server's view confirms it
        // (or, if it refused the move, the last one it sent comes back in a second).
        const board = v.board.slice();
        board[sq] = board[from];
        board[from] = '';
        served = v;
        view = Object.assign({}, v, { board: board, last: { from: from, to: sq }, legal: [] });
        clearTimeout(guessTimer);
        guessTimer = setTimeout(function () { if (served) { view = served; served = null; render(); } }, 1000);
        from = null;
        return render();
      }
    }
    from = v.legal.some(function (m) { return m.from === sq; }) && from !== sq ? sq : null;
    render();
  }

  function bankOf(v, slot) {
    return v.ticking === slot ? v.banks[slot] - (performance.now() - gotAt) : v.banks[slot];
  }

  function message(v) {
    const me = v.you;
    if (v.result && v.phase !== 'play') {
      const r = v.result;
      const how = { mate: 'checkmate', time: 'on time', resign: 'by resignation', stalemate: 'stalemate', repetition: 'repetition', fifty: 'fifty moves', material: 'too little to mate', 'time-draw': 'time, too little to mate' }[r.how];
      if (r.winner === null) return '<span class="ark-result draw">A draw</span> <small>(' + how + ')</small>';
      const won = r.winner === me;
      return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span> <small>' + how + '</small>';
    }
    if (v.turnSlot !== me) return 'Their move…';
    if (promoting) return '<strong>Promote to…</strong>';
    return v.check >= 0 ? '<strong>Check!</strong> Your move' : '<strong>Your move</strong>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turnSlot === me;
    const c = mineColour(v);
    const targets = mine && from !== null ? new Set(v.legal.filter(function (m) { return m.from === from; }).map(function (m) { return m.to; })) : new Set();
    const clock = function (slot) { return v.timed ? '<b class="ch-clock" data-slot="' + slot + '">' + ArkChess.clockText(bankOf(v, slot)) + '</b>' : ''; };
    let html = '<div class="ch-bar them' + (v.turnSlot === 1 - me && v.phase === 'play' ? ' active' : '') + '">' + ArkChess.takenHtml(v.captured[c]) + clock(1 - me) + '</div>' +
      '<p class="ch-msg">' + message(v) + '</p>' +
      ArkChess.boardHtml(v, { flip: c === 'b', picked: from, targets: targets, tappable: mine }) +
      '<div class="ch-bar you' + (mine ? ' active' : '') + '">' + ArkChess.takenHtml(v.captured[c === 'w' ? 'b' : 'w']) + clock(me) + '</div>';
    if (promoting) {
      html += '<div class="ch-promo">' + ['q', 'r', 'b', 'n'].map(function (k) {
        return '<button data-promo="' + k + '">' + ArkChess.piece(c === 'w' ? k.toUpperCase() : k) + '</button>';
      }).join('') + '</div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    else if (v.phase === 'play') html += '<button class="ch-resign' + (resigning ? ' sure' : '') + '">' + (resigning ? 'Tap again to resign' : 'Resign') + '</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'chess', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ch-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      tick = setInterval(function () {
        if (!root || !view) return;
        root.querySelectorAll('.ch-clock').forEach(function (c) {
          const ms = bankOf(view, Number(c.getAttribute('data-slot')));
          c.textContent = ArkChess.clockText(ms);
          c.classList.toggle('low', ms < 30000);
        });
      }, 100);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = served || view;
      served = null;
      clearTimeout(guessTimer);
      view = v;
      gotAt = performance.now();
      if (from !== null && !v.legal.some(function (m) { return m.from === from; })) from = null;
      if (prev && v.phase === 'play' && v.turnSlot === v.you && prev.turnSlot !== v.you) api.vibrate(v.check >= 0 ? [40, 40, 40] : 40);
      if (v.phase !== 'play' && v.result && buzzed !== v.game + v.phase) {
        buzzed = v.game + v.phase;
        if (v.result.winner !== null) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      clearInterval(tick);
      clearTimeout(guessTimer);
      served = null;
      root = view = null;
      from = promoting = null;
      buzzed = '';
    },
  });
})();
