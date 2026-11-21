(function () {
  Ark.loadCss('/games/blackjack/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let seen = new Set(); // cards already on the table (new ones slide in)
  let seenHand = 0;
  const aim = {}; // controller players: slot -> the chip they're on while betting

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function spot(v, slot) {
    const seat = v.seats[slot];
    const bet = v.bets[slot];
    let body = '';
    let status = '';
    if (v.phase === 'bet') {
      body = bet === null ? '<div class="bj-wait">Placing a bet…</div>' : '<div class="bj-wait in">' + (bet === true ? 'Bet placed ✓' : ArkBJ.stack(bet)) + '</div>';
      const p = v.players[slot];
      if (bet === null && p.local && !p.bot) body += chipPicker(v, slot);
    } else if (seat) {
      body = seat.hands.map(function (h, i) {
        const r = v.results && v.results[slot] ? v.results[slot][i] : null;
        const active = v.phase === 'play' && !seat.done && seat.at === i;
        return '<div class="bj-hand' + (active ? ' active' : '') + (seat.hands.length > 1 ? ' split' : '') + '">' +
          ArkBJ.cards(h.cards, 'p' + slot + 'h' + i, seen) +
          '<div class="bj-under">' + (h.bet ? ArkBJ.stack(h.bet) : '') +
          '<span class="bj-total">' + ArkBJ.totalText(h) + '</span>' + (h.doubled ? '<span class="bj-tag">Doubled</span>' : '') + '</div>' +
          (r ? ArkBJ.result(r) : '') + '</div>';
      }).join('');
      if (v.phase === 'play') status = seat.done ? 'Done ✓' : 'Playing…';
    }
    const p = v.players[slot];
    const local = v.phase === 'play' && p.local && !p.bot && seat && !seat.done;
    return '<section class="bj-spot p' + (slot + 1) + '">' +
      '<header><span class="bj-name">' + nameOf(v, slot) + '</span><span class="bj-bank">' + v.chips[slot].toLocaleString() + ' <small>chips</small></span></header>' +
      '<div class="bj-spot-body">' + body + '</div>' +
      '<footer>' + status + (local ? ' <span class="bj-keys">A hit · B stand · X double · Y split</span>' : '') + '</footer></section>';
  }

  function chipPicker(v, slot) {
    const options = choices(v, slot);
    const at = Math.min(aim[slot] || 0, options.length - 1);
    return '<div class="bj-pick">' + options.map(function (n, i) {
      return n === v.chips[slot] && !v.betChoices.includes(n) ? '<span class="bj-allin' + (i === at ? ' on' : '') + '">All in ' + n + '</span>' : ArkBJ.chip(n, i === at ? 'on' : '');
    }).join('') + '</div><div class="bj-keys">◀ ▶ pick a chip · A bet it</div>';
  }

  function choices(v, slot) {
    const list = v.betChoices.filter(function (b) { return b <= v.chips[slot]; });
    return list.length ? list : [v.chips[slot]];
  }

  function banner(v) {
    if (v.phase === 'over') {
      const c = v.chips;
      if (v.winner === null) return '<div class="bj-banner"><span class="ark-result draw">Level on ' + c[0].toLocaleString() + ' chips. A draw!</span></div>';
      return '<div class="bj-banner"><span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</span>' +
        '<small>' + c[v.winner].toLocaleString() + ' chips to ' + c[1 - v.winner].toLocaleString() + ' · Rematch or back to the lobby from your phones</small></div>';
    }
    return '';
  }

  function headline(v) {
    const clock = v.timed && v.timeLeftMs && (v.phase === 'bet' || v.phase === 'play') ? '<span class="bj-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    const what = {
      bet: 'Place your bets' + (v.shuffled ? ' · fresh shoe 🔀' : ''),
      deal: 'Dealing…',
      play: 'Hit or stand on your phone',
      reveal: 'Cards up!',
      dealer: 'The dealer plays',
      settle: v.hand === v.hands ? 'That was the last hand' : 'Next hand coming up',
      over: 'Final chips',
    }[v.phase] || '';
    return '<div class="bj-head"><span>Hand ' + v.hand + ' of ' + v.hands + (v.hand === v.hands && v.phase !== 'over' ? ' · <b>last hand!</b>' : '') + '</span>' +
      '<strong>' + what + '</strong>' + clock + '</div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    if (v.hand !== seenHand) { seen = new Set(); seenHand = v.hand; }
    const d = v.dealer;
    root.innerHTML = headline(v) +
      '<div class="bj-table">' +
      '<div class="bj-dealer">' + (d ? ArkBJ.cards(d.cards, 'd', seen) + '<span class="bj-total dealer">' + (d.total !== null ? (d.total > 21 ? 'Dealer busts!' : 'Dealer ' + d.total) : 'Dealer') + '</span>' : '<div class="bj-shoe"></div>') + '</div>' +
      '<div class="bj-felt-text"><span>Blackjack pays 3 to 2</span><small>Dealer stands on all 17s · same cards for both players</small></div>' +
      '<div class="bj-spots">' + spot(v, 0) + spot(v, 1) + '</div>' +
      banner(v) + '</div>';
  }

  Ark.register('host', 'blackjack', {
    padHint: 'Bet: ◀ ▶ pick a chip, A bets it · Play: A hit, B stand, X double, Y split · A: rematch at the end',
    sounds: function (prev, v) {
      const out = [];
      const count = function (x) {
        let n = x.dealer ? x.dealer.cards.filter(Boolean).length : 0;
        (x.seats || []).forEach(function (s) { if (s) s.hands.forEach(function (h) { n += h.cards.length; }); });
        return n;
      };
      if (v.phase === 'deal' && prev.phase !== 'deal') out.push('whoosh');
      else if (v.hand === prev.hand && count(v) > count(prev)) out.push('chalk');
      if (v.phase === 'settle' && prev.phase !== 'settle') {
        const net = (v.results || []).flat().reduce(function (n, r) { return n + r.win; }, 0);
        out.push(net > 0 ? 'correct' : net < 0 ? 'wrong' : 'tick');
      }
      if (v.phase === 'bet' && prev.phase !== 'bet') out.push('tick');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase === 'bet' && v.bets[slot] === null) {
        const options = choices(v, slot);
        const at = Math.min(aim[slot] || 0, options.length - 1);
        if (btn === 'LEFT' || btn === 'RIGHT') {
          aim[slot] = Math.max(0, Math.min(options.length - 1, at + (btn === 'LEFT' ? -1 : 1)));
          render();
          return null;
        }
        return btn === 'A' ? { type: 'bet', amount: options[at] } : null;
      }
      if (v.phase === 'play') return { A: { type: 'hit' }, B: { type: 'stand' }, X: { type: 'double' }, Y: { type: 'split' } }[btn] || null;
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'bj-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      seen = new Set();
      seenHand = 0;
      Object.keys(aim).forEach(function (k) { delete aim[k]; });
    },
  });
})();
