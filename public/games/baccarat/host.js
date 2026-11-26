(function () {
  // The cards and chips are Blackjack's.
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/baccarat/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const seen = new Set(); // cards already shown (the new ones slide in)
  const pads = {}; // a controller player's choice so far: { side, k }

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const AMOUNTS = [25, 50, 100, 200, 500];
  const SIDE = { player: 'Player', banker: 'Banker', tie: 'Tie' };
  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + -n : '±0');

  function hand(v, which) {
    const d = v.phase === 'deal' && v.deal ? v.deal : null;
    const won = d && d.winner === which;
    return '<div class="bc-hand ' + which + (won ? ' won' : '') + '"><h3>' + SIDE[which] + (d ? ' <b>' + d.totals[which] + '</b>' : '') + '</h3>' +
      (d ? ArkBJ.cards(d[which], v.coup + which, seen) : '<div class="bj-cards">' + ArkBJ.card(null) + ArkBJ.card(null) + '</div>') + '</div>';
  }

  function seat(v, slot) {
    let state = '';
    const p = v.players[slot];
    if (v.phase === 'bet') {
      if (v.locked[slot]) state = '🔒 Bet placed';
      else if (p.local && !p.bot) {
        const pick = pads[slot] || { side: 'banker', k: 2 };
        state = 'Betting <b>' + Math.min(AMOUNTS[pick.k], v.maxBets[slot]) + '</b> on <b>' + SIDE[pick.side] + '</b> <small>X Player · B Banker · Y Tie · ◀ ▶ amount · A bet</small>';
      } else state = 'Thinking…';
    } else if (v.result) {
      const b = v.result.bets[slot];
      state = (b === 'out' ? 'Out of time' : b.amount + ' on ' + SIDE[b.side]) + ' <b class="' + (v.result.change[slot] > 0 ? 'up' : v.result.change[slot] < 0 ? 'down' : '') + '">' + signed(v.result.change[slot]) + '</b>';
    }
    return '<div class="bc-seat p' + (slot + 1) + (v.phase === 'over' && v.winner === slot ? ' won' : '') + '"><header>' + nameOf(v, slot) + '<span>' + v.chips[slot].toLocaleString() + ' chips</span></header><div class="bc-state">' + state + '</div></div>';
  }

  function road(v) {
    return '<div class="bc-road">' + v.history.map(function (h) { return '<i class="' + h.winner + '">' + h.winner[0].toUpperCase() + '</i>'; }).join('') + '</div>';
  }

  function caption(v) {
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="ark-result draw">Level on chips: a draw</span>';
      return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match!</span>';
    }
    if (v.phase === 'bet') return 'Bet in secret: Player, Banker or Tie?' + (v.timed && v.timeLeftMs ? ' · ⏱ <span class="bc-secs">' + secsLeft() + 's</span>' : '');
    const w = v.deal.winner;
    return w === 'tie' ? 'A tie!' : SIDE[w] + ' wins ' + v.deal.totals[w] + ' to ' + v.deal.totals[w === 'player' ? 'banker' : 'player'];
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML =
      '<div class="bc-head"><span>Coup <strong>' + Math.min(v.coup, v.coups) + '</strong> / ' + v.coups + '</span><span>Player evens · Banker evens less 5% · Tie 8 to 1</span><span>Shoe <strong>' + v.shoeLeft + '</strong></span></div>' +
      '<div class="bc-table"><div class="bc-hands">' + hand(v, 'player') + hand(v, 'banker') + '</div>' + road(v) +
      '<div class="bc-seats">' + seat(v, 0) + seat(v, 1) + '</div></div>' +
      '<div class="bc-caption">' + caption(v) + '</div>';
  }

  Ark.register('host', 'baccarat', {
    sounds: function (prev, v) {
      const out = [];
      if (v.locked.filter(Boolean).length > prev.locked.filter(Boolean).length) out.push('lock');
      if (prev.phase === 'bet' && v.phase === 'deal') out.push('whoosh');
      if (prev.phase !== 'over' && v.phase === 'over') out.push('fanfare');
      return out;
    },
    padHint: 'X Player · B Banker · Y Tie · ◀ ▶ the amount · A places the bet · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'bet' || v.locked[slot]) return null;
      const pick = pads[slot] || (pads[slot] = { side: 'banker', k: 2 });
      const side = { X: 'player', B: 'banker', Y: 'tie' }[btn];
      if (side) pick.side = side;
      else if (btn === 'LEFT') pick.k = Math.max(0, pick.k - 1);
      else if (btn === 'RIGHT') pick.k = Math.min(AMOUNTS.length - 1, pick.k + 1);
      else if (btn === 'A') {
        let amount = AMOUNTS[pick.k];
        while (amount > v.maxBets[slot] && amount > v.minBet) amount = AMOUNTS[AMOUNTS.indexOf(amount) - 1];
        return { type: 'bet', side: pick.side, amount: amount };
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'bc-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.bc-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; seen.clear(); delete pads[0]; delete pads[1]; },
  });
})();
