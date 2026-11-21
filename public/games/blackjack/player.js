(function () {
  Ark.loadCss('/games/blackjack/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let seen = new Set();
  let seenHand = 0;
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const b = e.target.closest('[data-bet]');
    if (b && view.phase === 'bet' && view.bets[view.you] === null) {
      api.send({ type: 'bet', amount: Number(b.getAttribute('data-bet')) });
      api.vibrate(15);
      Ark.showPick(b, 'data-bet');
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && !act.disabled && view.phase === 'play' && view.can) {
      api.send({ type: act.getAttribute('data-act') });
      api.vibrate(15);
    }
  }

  function betting(v) {
    const me = v.you;
    if (v.bets[me] !== null) {
      return '<div class="bj-placed">' + ArkBJ.stack(v.bets[me]) + '<p>Bet ' + v.bets[me] + '. ' + (v.bets[1 - me] === null ? 'Waiting for them…' : 'Dealing…') + '</p></div>';
    }
    const list = v.betChoices.filter(function (n) { return n <= v.chips[me]; });
    let html = '<p class="bj-ask">How much on this hand?</p><div class="bj-rack">';
    list.forEach(function (n) { html += '<button class="bj-chip-btn" data-bet="' + n + '">' + ArkBJ.chip(n, 'big') + '</button>'; });
    html += '</div>';
    const all = v.chips[me];
    if (!v.betChoices.includes(all)) html += '<button class="bj-allin-btn" data-bet="' + all + '">All in · ' + all.toLocaleString() + '</button>';
    if (v.timed) html += '<p class="bj-note">Out of time: you bet ' + Math.min(v.lastBet[me], all) + ' again</p>';
    return html;
  }

  function hands(v) {
    const me = v.you;
    const seat = v.seats[me];
    if (!seat) return '';
    return '<div class="bj-my-hands' + (seat.hands.length > 1 ? ' two' : '') + '">' + seat.hands.map(function (h, i) {
      const r = v.results && v.results[me] ? v.results[me][i] : null;
      const active = v.phase === 'play' && !seat.done && seat.at === i;
      return '<div class="bj-hand' + (active ? ' active' : '') + '">' + ArkBJ.cards(h.cards, 'h' + i, seen) +
        '<div class="bj-under"><span class="bj-total big">' + ArkBJ.totalText(h) + '</span><span class="bj-betline">Bet ' + h.bet + (h.doubled ? ' (doubled)' : '') + '</span></div>' +
        (r ? ArkBJ.result(r) : '') + '</div>';
    }).join('') + '</div>';
  }

  function actions(v) {
    const can = v.can;
    if (!can) {
      const seat = v.seats[v.you];
      return '<p class="bj-note">' + (v.phase === 'play' && seat && seat.done ? 'Done. Waiting for them to finish…' : v.phase === 'dealer' || v.phase === 'reveal' ? 'The dealer plays…' : '') + '</p>';
    }
    const btn = function (act, label, ok, cls) {
      return '<button class="bj-act ' + cls + '" data-act="' + act + '"' + (ok ? '' : ' disabled') + '>' + label + '</button>';
    };
    return '<div class="bj-actions">' + btn('hit', 'Hit', true, 'hit') + btn('stand', 'Stand', true, 'stand') +
      btn('double', 'Double', can.double, 'minor') + btn('split', 'Split', can.split, 'minor') + '</div>' +
      (v.timed ? '<p class="bj-note">' + Math.ceil(v.timeLeftMs / 1000) + 's · out of time: you stand</p>' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    if (v.hand !== seenHand) { seen = new Set(); seenHand = v.hand; }
    let main;
    if (v.phase === 'over') {
      const won = v.winner === me;
      main = '<div class="bj-end">' + (v.winner === null ? '<span class="ark-result draw big">A draw!</span>' : won ? '<span class="ark-result won big">You win! 🏆</span>' : '<span class="ark-result lost big">You lose</span>') +
        '<p>' + v.chips[me].toLocaleString() + ' chips to their ' + v.chips[1 - me].toLocaleString() + '</p><button class="primary rematch">Rematch</button></div>';
    } else if (v.phase === 'bet') {
      main = betting(v);
    } else {
      const d = v.dealer;
      main = '<div class="bj-mini-dealer"><span>Dealer</span>' + ArkBJ.cards(d.cards, 'd', seen) + '<b>' + (d.total !== null ? (d.total > 21 ? 'Bust' : d.total) : '') + '</b></div>' +
        hands(v) + actions(v);
    }
    const lead = v.chips[me] - v.chips[1 - me];
    root.innerHTML =
      '<div class="bj-top"><span class="bj-bank">' + v.chips[me].toLocaleString() + ' <small>chips</small></span>' +
      '<span class="bj-vs ' + (lead > 0 ? 'up' : lead < 0 ? 'down' : '') + '">' + (lead > 0 ? '▲ ' + lead + ' ahead' : lead < 0 ? '▼ ' + -lead + ' behind' : 'Level') + '</span>' +
      '<span class="bj-handno">Hand ' + v.hand + '/' + v.hands + '</span></div>' +
      '<div class="bj-felt">' + main + '</div>';
  }

  Ark.register('player', 'blackjack', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bj-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.phase === 'play' && prev.phase !== 'play') api.vibrate(40); // your cards are in
      if (v.phase === 'settle' && buzzed !== 'h' + v.hand) {
        buzzed = 'h' + v.hand;
        const net = (v.results[v.you] || []).reduce(function (n, r) { return n + r.win; }, 0);
        if (net) api.vibrate(net > 0 ? [50, 40, 50] : 160);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      seen = new Set();
      seenHand = 0;
      buzzed = '';
    },
  });
})();
