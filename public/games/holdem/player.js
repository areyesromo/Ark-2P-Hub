(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/holdem/style.css');
  const ready = Promise.all([Ark.loadScript('/games/blackjack/table.js'), Ark.loadScript('/games/holdem/poker.js')]);

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let buzzed = '';

  // The turn clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.hd-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You take every chip! 🏆</span>' : '<span class="lost big ark-result">Out of chips</span>';
    const r = v.result;
    if (r) {
      if (r.winner === null) return 'Split pot';
      const mine = r.winner === me;
      return '<span class="' + (mine ? 'won' : 'lost') + '">' + (mine ? 'You win ' : 'They win ') + r.pot.toLocaleString() + '</span>' + (r.names ? ' <small>' + Ark.escapeHtml(r.names[r.winner]) + '</small>' : r.how === 'fold' ? ' <small>' + (mine ? 'they folded' : 'you folded') + '</small>' : '');
    }
    if (v.phase === 'deal' || v.phase === 'street') return 'Dealing…';
    if (v.turn === me) return '<strong>Your turn</strong>' + (v.timed ? ' <small class="hd-secs">' + secsLeft() + 's</small>' : '');
    return 'They\'re thinking…';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const o = v.turn === me ? v.options : null;
    let html = '<div class="hd-ptop"><span>Them <b>' + v.stacks[1 - me].toLocaleString() + '</b>' + (v.button === 1 - me ? ' <span class="hd-button">D</span>' : '') + '</span>' +
      '<span>Blinds ' + v.blinds[0] + '/' + v.blinds[1] + '</span></div>' +
      '<div class="hd-pact">' + ArkPoker.actText(v.acts[1 - me]) + (v.cards[1 - me] ? ' ' + ArkBJ.cards(v.cards[1 - me]) : '') + '</div>' +
      '<div class="hd-pboard">' + v.board.map(function (c) { return ArkBJ.card(c); }).join('') + '</div>' +
      '<div class="hd-ppot">Pot <b>' + v.pot.toLocaleString() + '</b>' + (v.bets[1 - me] > v.bets[me] ? ' · to call <b>' + (v.bets[1 - me] - v.bets[me]).toLocaleString() + '</b>' : '') + '</div>' +
      '<p class="hd-msg">' + message(v) + '</p>' +
      '<div class="hd-mine">' + ArkBJ.cards(v.cards[me] || []) + '<div class="hd-me"><span>You <b>' + v.stacks[me].toLocaleString() + '</b>' + (v.button === me ? ' <span class="hd-button">D</span>' : '') + '</span>' + ArkPoker.actText(v.acts[me]) + '</div></div>';
    if (o) {
      html += '<div class="hd-acts">' +
        (o.check ? '' : '<button type="button" class="hd-fold" data-a="fold">Fold</button>') +
        '<button type="button" class="hd-call" data-a="' + (o.check ? 'check' : 'call') + '">' + (o.check ? 'Check' : 'Call ' + o.call.toLocaleString()) + '</button></div>';
      const r = ArkPoker.raises(v);
      if (r.length) html += '<div class="hd-raises">' + r.map(function (x) { return '<button type="button" data-a="raise" data-to="' + x.to + '"><small>' + x.label + '</small>' + (v.bets[1 - me] ? 'Raise to ' : 'Bet ') + x.to.toLocaleString() + '</button>'; }).join('') + '</div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'holdem', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hd-phone';
      root.addEventListener('click', function (e) {
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        const b = e.target.closest('[data-a]');
        if (!b || !view) return;
        const msg = { type: 'act', action: b.getAttribute('data-a') };
        if (b.hasAttribute('data-to')) msg.to = Number(b.getAttribute('data-to'));
        api.send(msg);
        api.vibrate(15);
      });
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      gotAt = Date.now();
      if (prev && v.phase === 'play' && v.turn === v.you && (prev.turn !== v.you || prev.n !== v.n)) api.vibrate(40);
      if (v.result && buzzed !== v.hand + ':' + v.phase && v.result.winner !== null) { buzzed = v.hand + ':' + v.phase; api.vibrate(v.result.winner === v.you ? [50, 40, 50] : 120); }
      render();
    },
    unmount: function () { clearInterval(tick); root = view = null; buzzed = ''; },
  });
})();
