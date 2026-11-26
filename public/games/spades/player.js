(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/spades/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let bid = 3;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.spd-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'handEnd') return 'You ' + (v.result.gained[me] > 0 ? '+' : '') + v.result.gained[me] + ' · them ' + (v.result.gained[1 - me] > 0 ? '+' : '') + v.result.gained[1 - me];
    if (v.turn !== me) return v.phase === 'draw' ? 'They\'re drawing…' : v.phase === 'bid' ? 'They\'re bidding…' : v.phase === 'trick' ? 'Trick!' : 'Their card…';
    const t = v.timed && v.timeLeftMs ? ' <small class="spd-secs">' + secsLeft() + 's</small>' : '';
    if (v.phase === 'draw') return '<strong>Keep this card, or take the next one (sight unseen)?</strong>' + t;
    if (v.phase === 'bid') return '<strong>How many tricks will you take?</strong>' + t;
    return '<strong>Your card</strong>' + t;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    let html = '<div class="spd-ptop"><span>You <b>' + v.scores[me] + '</b> <small>bags ' + v.bags[me] + '</small></span><span>Them <b>' + v.scores[1 - me] + '</b></span></div>';
    if (v.bids[0] !== null || v.bids[1] !== null) html += '<div class="spd-pbids">Bids: you ' + (v.bids[me] === null ? '…' : v.bids[me] === 0 ? 'nil' : v.bids[me]) + ' (took ' + v.tricks[me] + ') · them ' + (v.bids[1 - me] === null ? '…' : v.bids[1 - me] === 0 ? 'nil' : v.bids[1 - me]) + ' (took ' + v.tricks[1 - me] + ')</div>';
    if (v.trick.length) html += '<div class="spd-ptrick">' + v.trick.map(function (t) { return ArkBJ.card(t.card); }).join('') + '</div>';
    html += '<p class="spd-msg">' + message(v) + '</p>';
    if (v.phase === 'draw' && v.offer) html += '<div class="spd-offer">' + ArkBJ.card(v.offer) + '<div><button type="button" class="primary" data-keep="1">Keep it</button><button type="button" data-keep="0">Take the next</button></div></div>';
    if (v.phase === 'bid' && v.turn === me) {
      html += '<div class="spd-bidpick"><button type="button" data-step="-1">−</button><b>' + (bid === 0 ? 'Nil' : bid) + '</b><button type="button" data-step="1">+</button></div><button type="button" class="primary spd-go">Bid ' + (bid === 0 ? 'nil' : bid) + '</button>';
    }
    if (v.hand) {
      html += '<div class="spd-phand">' + v.hand.map(function (c) {
        const ok = v.legal && v.legal.includes(c);
        return '<button type="button" class="spd-pcard' + (ok ? ' ok' : '') + '" data-c="' + c + '"' + (ok ? '' : ' disabled') + '>' + ArkBJ.card(c) + '</button>';
      }).join('') + '</div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'spades', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'spd-phone';
      root.addEventListener('click', function (e) {
        if (!view) return;
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        const k = e.target.closest('[data-keep]');
        if (k) { api.send({ type: 'draw', keep: k.getAttribute('data-keep') === '1' }); api.vibrate(10); return; }
        const st = e.target.closest('[data-step]');
        if (st) { bid = Math.max(0, Math.min(13, bid + Number(st.getAttribute('data-step')))); return render(); }
        if (e.target.closest('.spd-go')) { api.send({ type: 'bid', bid: bid }); api.vibrate(15); return; }
        const c = e.target.closest('[data-c]');
        if (c && !c.disabled) { api.send({ type: 'play', card: c.getAttribute('data-c') }); api.vibrate(10); }
      });
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      gotAt = Date.now();
      if (prev && v.turn === v.you && prev.turn !== v.you) api.vibrate(30);
      render();
    },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
