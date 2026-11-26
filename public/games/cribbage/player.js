(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/cribbage/style.css');
  const ready = Promise.all([Ark.loadScript('/games/blackjack/table.js'), Ark.loadScript('/games/cribbage/board.js')]);

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picks = []; // two cards picked for the crib

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You peg out! 🏆</span>' : '<span class="lost big ark-result">They pegged out</span>';
    if (v.phase === 'discard') return v.discarded[me] ? 'Waiting for them…' : '<strong>Pick two for ' + (v.dealer === me ? 'your' : 'their') + ' crib</strong>';
    if (v.phase === 'cut') return 'Cutting the starter…';
    if (v.phase === 'play') return v.turn === me ? '<strong>Your card</strong> · count ' + v.count + (v.timed ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '') : 'They\'re playing · count ' + v.count;
    if (v.phase === 'go') return 'Go: the count starts again';
    if (v.phase === 'show') return 'Counting the hands…';
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    let html = '<div class="cb-ptop"><span>You <b>' + v.scores[me] + '</b> – <b>' + v.scores[1 - me] + '</b> Them</span><span>to ' + v.target + (v.dealer === me ? ' · you deal' : '') + '</span></div>' +
      '<div class="cb-pmid">' + (v.starter ? ArkBJ.card(v.starter) : '') + '<div class="cb-pseq">' + ArkBJ.cards(v.seq.map(function (x) { return x.card; })) + '</div></div>' +
      '<p class="cb-msg">' + message(v) + '</p>';
    if (v.shows.length) html += '<div class="cb-pshows">' + v.shows.map(function (s) { return '<div><b>' + (s.who === 'crib' ? 'Crib' : s.who === me ? 'You' : 'Them') + '</b> ' + ArkCrib.items(s) + '</div>'; }).join('') + '</div>';
    if (v.hand && v.hand.length) {
      html += '<div class="cb-phand">' + v.hand.map(function (c, i) {
        const ok = v.phase === 'discard' ? !v.discarded[me] : v.playable ? v.playable[i] : false;
        return '<button type="button" class="cb-pcard' + (ok ? ' ok' : '') + (picks.includes(i) ? ' picked' : '') + '" data-i="' + i + '">' + ArkBJ.card(c) + '</button>';
      }).join('') + '</div>';
    }
    if (v.phase === 'discard' && !v.discarded[me]) html += '<button type="button" class="primary cb-go"' + (picks.length === 2 ? '' : ' disabled') + '>Into the crib</button>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'cribbage', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'cb-phone';
      root.addEventListener('click', function (e) {
        if (!view) return;
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        if (e.target.closest('.cb-go') && picks.length === 2) {
          api.send({ type: 'discard', cards: picks.slice() });
          picks = [];
          return render();
        }
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const i = Number(b.getAttribute('data-i'));
        if (view.phase === 'discard') {
          picks = picks.includes(i) ? picks.filter(function (x) { return x !== i; }) : picks.concat(i).slice(-2);
          render();
        } else if (view.phase === 'play' && view.turn === view.you && view.playable && view.playable[i]) {
          api.send({ type: 'lay', card: i });
          api.vibrate(10);
        }
      });
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (!prev || prev.deal !== v.deal) picks = [];
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(30);
      render();
    },
    unmount: function () { root = view = null; picks = []; },
  });
})();
