(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/cribbage/style.css');
  const ready = Promise.all([Ark.loadScript('/games/blackjack/table.js'), Ark.loadScript('/games/cribbage/board.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    let backs = '';
    for (let k = 0; k < v.handCounts[slot]; k++) backs += ArkBJ.card(null);
    const status = v.phase === 'discard' ? (v.discarded[slot] ? 'Two in the crib ✓' : 'Choosing two for the crib…') : v.turn === slot ? 'To play' + (v.timed ? ' · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '') : v.goBy === slot ? '"Go"' : '';
    return '<section class="cb-seat p' + (slot + 1) + (v.turn === slot ? ' turn' : '') + '">' +
      '<header>' + nameOf(v, slot) + (v.dealer === slot ? ' <span class="cb-dealer">Dealer</span>' : '') + '<b>' + v.scores[slot] + '</b></header>' +
      '<div class="cb-backs">' + backs + '</div><footer>' + status + '</footer></section>';
  }

  function middle(v) {
    if (v.phase === 'show' || (v.phase === 'over' && v.shows.length)) {
      return '<div class="cb-show">' + v.shows.map(function (s) {
        const who = s.who === 'crib' ? nameOf(v, v.dealer) + '\'s crib' : nameOf(v, s.who) + '\'s hand';
        return '<div class="cb-count"><div class="cb-who">' + who + '</div>' + ArkBJ.cards(s.cards.concat(v.starter ? [] : [])) + '<div class="cb-items">' + ArkCrib.items(s) + '</div></div>';
      }).join('') + '</div>';
    }
    const ev = v.event && v.event.n === v.n ? '<div class="cb-event p' + (v.event.by + 1) + '">' + nameOf(v, v.event.by) + ': ' + esc(v.event.why.join(', ')) + ' for <b>' + v.event.pts + '</b></div>' : '';
    return '<div class="cb-play">' + ArkBJ.cards(v.seq.map(function (x) { return x.card; })) + '</div>' +
      '<div class="cb-total">' + (v.phase === 'play' || v.phase === 'go' ? 'Count <b>' + v.count + '</b>' : v.phase === 'discard' ? 'Lay two in the crib' : '') + '</div>' + ev;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const over = v.phase === 'over' ? '<div class="cb-over"><span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' pegs out!</span></div>' : '';
    root.innerHTML = '<div class="cb-boardwrap">' + ArkCrib.pegBoard(v) + '<div class="cb-target">to ' + v.target + '</div></div>' +
      '<div class="cb-table">' + seat(v, 0) +
      '<div class="cb-centre"><div class="cb-pack"><div class="cb-starter">' + ArkBJ.card(v.starter || null) + '<small>Starter</small></div>' +
      '<div class="cb-crib">' + (v.cribCount ? ArkBJ.card(null) + '<b>' + v.cribCount + '</b>' : '<div class="cb-slot"></div>') + '<small>Crib</small></div></div>' +
      middle(v) + '</div>' + seat(v, 1) + over + '</div>';
  }

  Ark.register('host', 'cribbage', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.n > prev.n) return ['point'];
      if (v.seq.length > prev.seq.length) return ['knock'];
      if (v.starter && !prev.starter) return ['reveal'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'cb-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; },
  });
})();
