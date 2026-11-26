(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/go-fish/style.css');
  const ready = Promise.all([Ark.loadScript('/games/blackjack/table.js'), Ark.loadScript('/games/go-fish/fish.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    let backs = '';
    for (let k = 0; k < Math.min(13, v.handCounts[slot]); k++) backs += ArkBJ.card(null);
    return '<section class="gf-seat p' + (slot + 1) + (v.turn === slot ? ' turn' : '') + '">' +
      '<header>' + nameOf(v, slot) + '<span><b>' + v.books[slot].length + '</b> book' + (v.books[slot].length === 1 ? '' : 's') + '</span></header>' +
      '<div class="gf-backs">' + backs + '</div><div class="gf-count">' + v.handCounts[slot] + ' cards</div>' + ArkFish.books(v.books[slot]) + '</section>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const last = v.log[v.log.length - 1];
    let middle = '<div class="gf-pond">' + ArkBJ.card(null) + '<b>' + v.pond + '</b><small>the pond</small></div>';
    if (last) {
      const t = ArkFish.askText(last);
      middle += '<div class="gf-say p' + (last.by + 1) + '" data-n="' + last.n + '"><div class="gf-ask">' + nameOf(v, last.by) + ': “' + t.ask + '”</div><div class="gf-answer">' + t.answer + '</div></div>';
    }
    const recent = v.log.slice(-6, -1).reverse().map(function (e) { const t = ArkFish.askText(e); return '<li>' + nameOf(v, e.by) + ' · ' + t.ask + ' ' + t.answer + '</li>'; }).join('');
    const over = v.phase === 'over' ? '<div class="gf-over"><span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins, ' + v.books[v.winner].length + ' books to ' + v.books[1 - v.winner].length + '</span></div>' : '';
    root.innerHTML = '<div class="gf-table">' + seat(v, 0) + '<div class="gf-middle">' + middle + '<ul class="gf-log">' + recent + '</ul></div>' + seat(v, 1) + over + '</div>';
  }

  Ark.register('host', 'go-fish', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      const b = v.books[0].length + v.books[1].length;
      if (b > prev.books[0].length + prev.books[1].length) return ['correct'];
      if (v.n > prev.n) { const e = v.log[v.log.length - 1]; return [e && e.got ? 'point' : 'splash']; }
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'gf-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; },
  });
})();
