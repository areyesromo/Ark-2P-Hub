(function () {
  Ark.loadCss('/games/hidden-ranks/style.css');
  const ready = Ark.loadScript('/games/hidden-ranks/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = null; // setup: a place in the arrangement; play: a square

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (v.phase === 'deploy') {
      if (e.target.closest('.hr-shuffle')) { api.send({ type: 'shuffle' }); picked = null; return; }
      if (e.target.closest('.hr-ready')) { api.send({ type: 'ready' }); api.vibrate(20); return; }
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.getAttribute('data-i'));
      if (picked === null) { picked = i; return render(); }
      if (picked !== i) api.send({ type: 'swap', a: picked, b: i });
      picked = null;
      api.vibrate(8);
      return render();
    }
    if (v.phase !== 'play' || v.turn !== v.you) return;
    const sq = e.target.closest('[data-c]');
    if (!sq) return;
    const c = Number(sq.getAttribute('data-c'));
    const p = v.board[c];
    if (p && p.s === v.you) { picked = picked === c ? null : c; api.vibrate(8); return render(); }
    if (picked !== null && v.moves.some(function (m) { return m[0] === picked && m[1] === c; })) {
      api.send({ type: 'move', from: picked, to: c });
      api.vibrate(15);
      picked = null;
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'deploy') return v.ready[me] ? 'Ready. Waiting for them…' : '<strong>Set out your army</strong> · tap two to swap them';
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const r = v.result;
      if (r.winner === null) return 'Level: a draw';
      const won = r.winner === me;
      return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
    }
    const m = v.lastMove;
    const said = m && m.fight ? ArkRanks.fightText(m.fight) + '<br>' : '';
    if (v.turn !== me) return said + 'Their turn…';
    return said + (picked === null ? '<strong>Your move!</strong> Tap a piece' : 'Tap where it goes');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    let html = '<div class="hr-ptop"><span class="p' + (me + 1) + '-text">● You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span><span>lost: you ' + v.taken[me].length + ' · them ' + v.taken[1 - me].length + '</span></div>' +
      '<p class="hr-msg">' + message(v) + '</p>';
    if (v.phase === 'deploy') {
      // Your two rows as they'll stand (the front row on top).
      const order = me === 0 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
      html += '<div class="hr-setup">' + order.map(function (i) {
        return '<button type="button" data-i="' + i + '" class="' + (picked === i ? 'picked' : '') + '"' + (v.ready[me] ? ' disabled' : '') + '>' + ArkRanks.pieceHtml({ s: me, rank: v.setup[i] }) + '</button>';
      }).join('') + '</div>';
      if (!v.ready[me]) html += '<div class="hr-buttons"><button type="button" class="hr-shuffle">🔀 Shuffle</button><button type="button" class="primary hr-ready">Ready</button></div>';
    } else if (v.board) {
      const mine = v.phase === 'play' && v.turn === me;
      const targets = mine && picked !== null ? v.moves.filter(function (m) { return m[0] === picked; }).map(function (m) { return m[1]; }) : [];
      html += ArkRanks.boardHtml(v, { flip: me === 1, me: me, tap: mine, picked: mine ? picked : null, targets: targets });
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'hidden-ranks', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hr-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && (prev.phase !== v.phase || (v.phase === 'play' && v.turn !== v.you))) picked = null;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      render();
      Ark.phoneClock((v.phase === 'play' && v.turn === v.you) || (v.phase === 'deploy' && !v.ready[v.you]) ? (v.timed ? v.timeLeftMs : 0) : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; picked = null; },
  });
})();
