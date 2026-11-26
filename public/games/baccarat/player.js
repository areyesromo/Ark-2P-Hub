(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/baccarat/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const AMOUNTS = [25, 50, 100, 200, 500];
  const SIDE = { player: 'Player', banker: 'Banker', tie: 'Tie' };
  const PAYS = { player: 'pays evens', banker: 'evens less 5%', tie: 'pays 8 to 1' };
  const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + -n : '±0');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let side = null;
  let amount = 100;

  function onClick(e) {
    if (!view) return;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const s = e.target.closest('[data-side]');
    if (s) { side = s.getAttribute('data-side'); api.vibrate(8); return render(); }
    const a = e.target.closest('[data-amount]');
    if (a && !a.disabled) { amount = Number(a.getAttribute('data-amount')); api.vibrate(8); return render(); }
    if (e.target.closest('.bc-go') && side) {
      api.send({ type: 'bet', side: side, amount: Math.min(amount, view.maxBets[view.you]) });
      api.vibrate(20);
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="big ark-result draw">Level!</span>';
      return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    }
    if (v.phase === 'bet') return v.locked[me] ? 'Bet placed: ' + v.bets[me].amount + ' on ' + SIDE[v.bets[me].side] + '. Waiting for them…' : '<strong>Place your bet</strong> (secret till the deal)';
    const d = v.deal;
    const c = v.result.change[me];
    return (d.winner === 'tie' ? 'A tie ' + d.totals.player + '–' + d.totals.banker : SIDE[d.winner] + ' wins ' + d.totals[d.winner] + ' to ' + d.totals[d.winner === 'player' ? 'banker' : 'player']) +
      ' <b class="' + (c > 0 ? 'won' : c < 0 ? 'lost' : '') + '">' + signed(c) + '</b>' + (v.result.bets[me] === 'out' ? '<br><small>Out of time: you sat it out</small>' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    let html = '<div class="bc-ptop"><span>You <b>' + v.chips[me].toLocaleString() + '</b></span><span>Coup ' + Math.min(v.coup, v.coups) + '/' + v.coups + '</span><span>Them <b>' + v.chips[1 - me].toLocaleString() + '</b></span></div>';
    if (v.phase === 'deal' && v.deal) {
      html += '<div class="bc-phands">' + ['player', 'banker'].map(function (w) {
        return '<div class="bc-phand' + (v.deal.winner === w ? ' won' : '') + '"><h4>' + SIDE[w] + ' <b>' + v.deal.totals[w] + '</b></h4>' + ArkBJ.cards(v.deal[w]) + '</div>';
      }).join('') + '</div>';
    }
    html += '<p class="bc-msg">' + message(v) + '</p>';
    if (v.phase === 'bet' && !v.locked[me]) {
      const max = v.maxBets[me];
      html += '<div class="bc-sides">' + ['player', 'banker', 'tie'].map(function (s) {
        return '<button type="button" data-side="' + s + '" class="' + s + (side === s ? ' on' : '') + '">' + SIDE[s] + '<small>' + PAYS[s] + '</small></button>';
      }).join('') + '</div>' +
        '<div class="bc-amounts">' + AMOUNTS.map(function (a) {
          return '<button type="button" data-amount="' + a + '" class="' + (Math.min(amount, max) === a ? 'on' : '') + '"' + (a > max ? ' disabled' : '') + '>' + ArkBJ.chip(a) + '</button>';
        }).join('') + '</div>' +
        '<button type="button" class="primary bc-go"' + (side ? '' : ' disabled') + '>' + (side ? 'Bet ' + Math.min(amount, max) + ' on ' + SIDE[side] : 'Pick a side') + '</button>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'baccarat', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bc-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && prev.coup !== v.coup) side = null; // (a fresh choice each coup)
      render();
      Ark.phoneClock(v.phase === 'bet' && v.timed && !v.locked[v.you] ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; side = null; },
  });
})();
