(function () {
  // The cards are Blackjack's.
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/speed/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let shownTops = [null, null]; // (only a pile whose top card just changed slaps down)

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const left = v.left[slot];
    let fan = '';
    for (let k = 0; k < v.handCounts[slot]; k++) fan += ArkBJ.card(null);
    return '<section class="sp-side p' + (slot + 1) + '">' +
      '<header>' + nameOf(v, slot) + '</header>' +
      '<div class="sp-fan">' + fan + '</div>' +
      '<div class="sp-left"><b>' + left + '</b> card' + (left === 1 ? '' : 's') + ' to go</div>' +
      '<div class="sp-bar"><i style="width:' + (100 * (20 - left) / 20) + '%"></i></div></section>';
  }

  function pile(v, p) {
    const by = v.last && v.last.pile === p ? ' by-p' + (v.last.by + 1) : '';
    const fresh = shownTops[p] !== v.tops[p] ? ' fresh' : '';
    return '<div class="sp-pile' + by + fresh + '">' +
      (v.under[p] ? '<div class="sp-under"><div class="sp-edge"></div></div>' : '') + // (the pile beneath: just its edge)
      '<div class="sp-top">' + ArkBJ.card(v.tops[p]) + '</div></div>';
  }

  function spare(n) {
    return '<div class="sp-spare">' + (n ? ArkBJ.card(null) + '<b>' + n + '</b>' : '<div class="sp-empty"></div>') + '</div>';
  }

  function caption(v) {
    if (v.phase === 'ready') return 'Ready… <b>GO!</b> in a moment';
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</span>';
    if (v.phase === 'roundEnd') return nameOf(v, v.result.winner) + ' played every card!';
    if (v.stuck) return 'Nobody can go: turning over the spares…';
    return 'One up or one down · ace next to king and two';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="sp-caption">' + caption(v) + '</div>' +
      '<div class="sp-table">' + side(v, 0) +
      '<div class="sp-middle">' + spare(v.spares[0]) + pile(v, 0) + pile(v, 1) + spare(v.spares[1]) + '</div>' +
      side(v, 1) + '</div>';
    shownTops = v.tops.slice();
  }

  Ark.register('host', 'speed', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.phase === 'play' && prev.phase === 'ready') return ['go'];
      if (v.flips > prev.flips) return ['whoosh'];
      if (v.n > prev.n) return ['knock'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sp-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; },
  });
})();
