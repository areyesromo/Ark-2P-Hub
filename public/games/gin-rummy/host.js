(function () {
  Ark.loadCss('/games/gin-rummy/style.css');
  const ready = Ark.loadScript('/games/gin-rummy/cards.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    const active = v.turn === slot && (v.phase === 'draw' || v.phase === 'discard');
    const clock = active && v.timed && v.timeLeftMs ? ' <span class="gr-clock' + (v.timeLeftMs < 8000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    const pct = Math.min(100, (100 * v.scores[slot]) / v.target);
    let hand;
    if (v.phase === 'show' && v.result && !v.result.draw) hand = ArkGin.shownHtml(v.result.shown[slot]);
    else {
      hand = '<div class="gr-backs">';
      for (let i = 0; i < v.counts[slot]; i++) hand += ArkGin.card(null, '', ' style="--i:' + i + '"');
      hand += '</div>';
    }
    return '<section class="gr-seat p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<header><span class="gr-name">' + nameOf(v, slot) + (v.dealer === slot ? ' <small>dealt</small>' : '') + '</span>' +
      '<span class="gr-score">' + v.scores[slot] + '<small>/' + v.target + '</small></span></header>' +
      '<div class="gr-bar"><i style="width:' + pct + '%"></i></div>' +
      hand +
      '<footer>' + (active ? (v.phase === 'draw' ? 'Drawing…' : 'Throwing one away…') : '') + clock + '</footer></section>';
  }

  function caption(v) {
    const l = v.last;
    if (v.phase === 'show') {
      const r = v.result;
      if (r.draw) return 'The deck ran out: a drawn hand';
      const what = { gin: 'Gin!', undercut: 'Undercut!', knock: 'Knock!' }[r.kind];
      return '<b>' + what + '</b> ' + nameOf(v, r.winner) + ' scores ' + r.points;
    }
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="ark-result draw">Level at ' + v.scores[0] + '. A draw!</span>';
      return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' to ' + v.scores[1 - v.winner] + '</span>';
    }
    if (!l) return nameOf(v, v.turn) + ' goes first';
    if (l.what === 'stock') return nameOf(v, l.by) + ' took from the deck';
    if (l.what === 'pile') return nameOf(v, l.by) + ' took the ' + ArkGin.name(l.card);
    return nameOf(v, l.by) + ' threw away the ' + ArkGin.name(l.card);
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const top = v.pile[v.pile.length - 1];
    const under = v.pile.length > 1 ? v.pile[v.pile.length - 2] : null;
    root.innerHTML = '<div class="gr-tv">' + seat(v, 0) +
      '<div class="gr-middle"><div class="gr-piles">' +
      '<div class="gr-deck">' + ArkGin.card(null) + '<small>' + v.stock + ' in the deck</small></div>' +
      '<div class="gr-discard">' + (under ? ArkGin.card(under, 'under') : '') + (top ? ArkGin.card(top, 'top') : '<div class="gr-card empty"></div>') + '<small>Discard pile</small></div>' +
      '</div><div class="gr-caption">' + caption(v) + '</div>' +
      (v.phase === 'over' ? '<p class="gr-hint">Rematch or back to the lobby from your phones.</p>' : '<p class="gr-hint">Hand ' + v.hand + ' · knock with 10 or less left over</p>') +
      '</div>' + seat(v, 1) + '</div>';
  }

  Ark.register('host', 'gin-rummy', {
    sounds: function (prev, v) {
      const out = [];
      const k = function (x) { return x.last ? x.last.by + x.last.what + (x.last.card || '') + x.stock : ''; };
      if (k(v) !== k(prev) && v.last) out.push(v.last.what === 'knock' ? 'knock' : 'chalk');
      if (v.phase === 'show' && prev.phase !== 'show') out.push(v.result.draw ? 'close' : v.result.kind === 'gin' ? 'fanfare' : 'reveal');
      return out;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'gr-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
    },
  });
})();
