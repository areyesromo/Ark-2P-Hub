(function () {
  // The cards and chips are Blackjack's (the same table).
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/holdem/style.css');
  const ready = Promise.all([Ark.loadScript('/games/blackjack/table.js'), Ark.loadScript('/games/holdem/poker.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let seen = new Set();
  let seenHand = 0;

  // The turn clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.hd-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    const cards = v.cards[slot] || (v.phase === 'deal' && v.hand ? [null, null] : v.result && v.result.how === 'fold' && v.acts[slot] && v.acts[slot].act === 'fold' ? [] : [null, null]);
    const turn = v.turn === slot;
    const won = v.result && v.result.winner === slot;
    return '<section class="hd-seat p' + (slot + 1) + (turn ? ' turn' : '') + (won ? ' won' : '') + '">' +
      '<header>' + nameOf(v, slot) + (v.button === slot ? ' <span class="hd-button">D</span>' : '') + '</header>' +
      '<div class="hd-stack">' + v.stacks[slot].toLocaleString() + ' <small>chips</small></div>' +
      '<div class="hd-hole">' + ArkBJ.cards(cards, 'h' + v.hand + 's' + slot, seen) + '</div>' +
      '<div class="hd-act">' + ArkPoker.actText(v.acts[slot]) + '</div>' +
      (v.result && v.result.names ? '<div class="hd-hand-name">' + esc(v.result.names[slot]) + '</div>' : '') +
      (turn && v.timed ? '<div class="hd-clock">⏱ <span class="hd-secs">' + secsLeft() + 's</span></div>' : '') +
      '</section>';
  }

  function bets(v) {
    return [0, 1].map(function (s) {
      return '<div class="hd-bet p' + (s + 1) + '">' + (v.bets[s] ? ArkBJ.stack(v.bets[s]) + '<b>' + v.bets[s] + '</b>' : '') + '</div>';
    }).join('');
  }

  function board(v) {
    let html = '<div class="hd-board">';
    for (let i = 0; i < 5; i++) html += v.board[i] ? ArkBJ.card(v.board[i], !seen.has('b' + v.hand + ':' + i) && seen.add('b' + v.hand + ':' + i), i < 3 ? i * 120 : 0) : '<div class="hd-slot"></div>';
    return html + '</div>';
  }

  function banner(v) {
    if (v.phase === 'over') return '<div class="hd-banner"><span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' takes every chip!</span></div>';
    const r = v.result;
    if (!r) return '';
    if (r.winner === null) return '<div class="hd-banner">Split pot · ' + esc(r.names[0]) + '</div>';
    const how = r.how === 'fold' ? 'They folded' : esc(r.names[r.winner]);
    return '<div class="hd-banner">' + nameOf(v, r.winner) + ' wins ' + r.pot.toLocaleString() + ' <small>' + how + '</small></div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    if (v.hand !== seenHand) { seen = new Set(); seenHand = v.hand; }
    root.innerHTML =
      '<div class="hd-head"><span>Hand <strong>' + v.hand + '</strong></span><span>Blinds <strong>' + v.blinds[0] + ' / ' + v.blinds[1] + '</strong> <small>up in ' + v.nextBlindsIn + ' hand' + (v.nextBlindsIn === 1 ? '' : 's') + '</small></span></div>' +
      '<div class="hd-table">' + seat(v, 0) +
      '<div class="hd-middle">' + board(v) + '<div class="hd-pot">' + (v.pot ? ArkBJ.stack(v.pot) + ' Pot <b>' + v.pot.toLocaleString() + '</b>' : '') + '</div>' + '<div class="hd-bets">' + bets(v) + '</div>' + '</div>' +
      seat(v, 1) + banner(v) + '</div>';
  }

  Ark.register('host', 'holdem', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.hand !== prev.hand) return ['whoosh'];
      if (v.board.length > prev.board.length) return ['tick'];
      if (v.result && !prev.result) return [v.result.how === 'fold' ? 'tick' : 'reveal'];
      if (v.pot > prev.pot) return ['drop'];
      if (v.n > prev.n) return ['knock'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hd-host';
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; seen = new Set(); },
  });
})();
