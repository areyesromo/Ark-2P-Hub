(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/red-dog/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const PAYS = { 5: '5 to 1', 4: '4 to 1', 2: '2 to 1', 1: 'evens' };
  const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + -n : '±0');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const b = e.target.closest('[data-raise]');
    if (b && !b.disabled) {
      api.send({ type: 'raise', raise: Number(b.getAttribute('data-raise')) });
      api.vibrate(20);
      Ark.showPick(b, 'data-raise');
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="big ark-result draw">Level!</span>';
      return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    }
    if (v.phase === 'raise') {
      if (v.locked[me]) return 'Decided. Waiting for them…';
      return 'Spread ' + v.spread + ', pays ' + PAYS[v.pays] + '<br><small>' + v.inside + ' of the ' + v.packLeft + ' cards left fall inside</small>';
    }
    const r = v.result;
    const c = r.change[me];
    const what = { inside: 'Inside!', outside: 'Outside', post: 'It matched a card', trips: 'Three of a kind!', pair: 'A pair: antes back', next: 'No gap: antes back' }[r.outcome];
    return what + ' <b class="' + (c > 0 ? 'won' : c < 0 ? 'lost' : '') + '">' + signed(c) + '</b>' + (r.raises[me] === 'fold' ? '<br><small>Out of time: you folded</small>' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const posts = v.posts || [null, null];
    const mine = v.phase === 'raise' && !v.locked[me];
    const picked = v.raises[me];
    const btn = function (n, label, sub) {
      const cls = picked === n ? 'picked' : picked !== null && picked !== undefined ? 'dim' : '';
      return '<button data-raise="' + n + '" class="' + cls + '"' + (mine ? '' : ' disabled') + '>' + label + '<small>' + sub + '</small></button>';
    };
    root.innerHTML =
      '<div class="rd-ptop"><span>You <b>' + v.chips[me].toLocaleString() + '</b></span><span>Hand ' + Math.min(v.hand, v.hands) + '/' + v.hands + '</span><span>Them <b>' + v.chips[1 - me].toLocaleString() + '</b></span></div>' +
      '<div class="rd-cards rd-pcards">' + ArkBJ.card(posts[0]) + '<div class="rd-third">' + (v.third ? ArkBJ.card(v.third) : '<div class="rd-gap">?</div>') + '</div>' + ArkBJ.card(posts[1]) + '</div>' +
      '<p class="rd-msg">' + message(v) + '</p>' +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>'
        : v.phase === 'raise' ? '<div class="rd-buttons">' + btn(0, 'Stay', v.ante + ' in') + btn(1, 'Raise one', 2 * v.ante + ' in') + btn(2, 'Raise two', 3 * v.ante + ' in') + '</div>' : '');
  }

  Ark.register('player', 'red-dog', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'rd-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
      Ark.phoneClock(v.phase === 'raise' && v.timed && !v.locked[v.you] ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; },
  });
})();
