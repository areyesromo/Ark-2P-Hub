(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/go-fish/style.css');
  const ready = Promise.all([Ark.loadScript('/games/blackjack/table.js'), Ark.loadScript('/games/go-fish/fish.js')]);

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.turn === me) return '<strong>Your go: tap a rank to ask for it</strong>' + (v.timed ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '');
    return 'Their go…';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const last = v.log[v.log.length - 1];
    const groups = [];
    (v.hand || []).forEach(function (c) {
      const r = c.slice(0, -1);
      const g = groups.find(function (x) { return x.r === r; });
      if (g) g.cards.push(c); else groups.push({ r: r, cards: [c] });
    });
    const mine = v.turn === me && v.phase === 'play';
    let html = '<div class="gf-ptop"><span>You <b>' + v.books[me].length + '</b> books</span><span>Pond <b>' + v.pond + '</b></span><span>Them <b>' + v.books[1 - me].length + '</b> · ' + v.handCounts[1 - me] + ' cards</span></div>';
    if (last) { const t = ArkFish.askText(last); html += '<div class="gf-psay">' + (last.by === me ? 'You' : 'Them') + ': “' + t.ask + '” ' + t.answer + '</div>'; }
    html += '<p class="gf-msg">' + message(v) + '</p>';
    html += '<div class="gf-groups">' + groups.map(function (g) {
      return '<button type="button" class="gf-group" data-r="' + g.r + '"' + (mine ? '' : ' disabled') + '>' + ArkBJ.cards(g.cards) + '<small>' + (g.cards.length > 1 ? g.cards.length + ' ' : '') + ArkFish.plural(g.r) + '</small></button>';
    }).join('') + '</div>';
    html += ArkFish.books(v.books[me]);
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'go-fish', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'gf-phone';
      root.addEventListener('click', function (e) {
        if (!view) return;
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        const b = e.target.closest('[data-r]');
        if (b && !b.disabled) { api.send({ type: 'ask', rank: b.getAttribute('data-r') }); api.vibrate(12); }
      });
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(30);
      render();
    },
    unmount: function () { root = view = null; },
  });
})();
