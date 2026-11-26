(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/speed/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const rankOf = function (c) { return RANKS.indexOf(c.slice(0, -1)) + 1; };
  const fits = function (c, t) { const d = Math.abs(rankOf(c) - rankOf(t)); return d === 1 || d === 12; };

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = null; // a card that fits both piles, waiting for a pile
  let buzzed = '';

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'roundEnd') return v.result.winner === me ? '<span class="won">You played every card!</span>' : '<span class="lost">They got rid of theirs first</span>';
    if (v.phase === 'ready') return 'Get ready…';
    if (v.stuck) return 'Nobody can go: turning over…';
    if (picked !== null) return 'Which pile?';
    return 'Tap a card that glows';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const play = v.phase === 'play';
    let html = '<div class="sp-ptop"><span>You <b>' + v.scores[me] + '</b> – <b>' + v.scores[1 - me] + '</b> Them</span><span>Left: you <b>' + v.left[me] + '</b> · them <b>' + v.left[1 - me] + '</b></span></div>' +
      '<div class="sp-ppiles">' + [0, 1].map(function (p) {
        const ok = picked !== null && v.hand && v.hand[picked] && fits(v.hand[picked], v.tops[p]);
        return '<button type="button" class="sp-ppile' + (ok ? ' ok' : '') + '" data-p="' + p + '">' + ArkBJ.card(v.tops[p]) + '</button>';
      }).join('') + '</div>' +
      '<p class="sp-msg">' + message(v) + '</p>';
    if (v.hand) {
      html += '<div class="sp-hand">' + v.hand.map(function (c, i) {
        const ok = play && (fits(c, v.tops[0]) || fits(c, v.tops[1]));
        return '<button type="button" class="sp-hcard' + (ok ? ' ok' : '') + (picked === i ? ' picked' : '') + '" data-i="' + i + '">' + ArkBJ.card(c) + '</button>';
      }).join('') + '</div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'speed', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sp-phone';
      root.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        if (!view || view.phase !== 'play' || !view.hand) return;
        const card = e.target.closest('[data-i]');
        const pile = e.target.closest('[data-p]');
        if (card) {
          e.preventDefault();
          const i = Number(card.getAttribute('data-i'));
          const c = view.hand[i];
          const ok = [0, 1].filter(function (p) { return fits(c, view.tops[p]); });
          // One pile it fits: straight on. Both: pick the pile.
          if (ok.length === 1) { api.send({ type: 'play', card: i, pile: ok[0] }); api.vibrate(10); picked = null; }
          else if (ok.length === 2) picked = picked === i ? null : i;
          else { api.vibrate([20, 30, 20]); picked = null; }
          render();
        } else if (pile && picked !== null) {
          e.preventDefault();
          api.send({ type: 'play', card: picked, pile: Number(pile.getAttribute('data-p')) });
          api.vibrate(10);
          picked = null;
          render();
        }
      });
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (!prev || prev.n !== v.n || prev.phase !== v.phase) picked = null;
      if (v.result && buzzed !== v.round + v.phase) { buzzed = v.round + v.phase; api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200); }
      render();
    },
    unmount: function () { root = view = null; picked = null; buzzed = ''; },
  });
})();
