(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/video-poker/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let hold = [false, false, false, false, false];
  let seenHand = 0;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.vp-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : v.winner === null ? '<span class="big ark-result draw">Level!</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'reveal') {
      const r = v.result;
      return (r.winner === null ? 'Split pot' : r.winner === me ? '<span class="won">You take ' + r.pot + '</span>' : '<span class="lost">They take ' + r.pot + '</span>') + '<br><small>You: ' + Ark.escapeHtml(r.names[me]) + ' · them: ' + Ark.escapeHtml(r.names[1 - me]) + '</small>';
    }
    if (v.locked[me]) return 'Locked in. Waiting for them…';
    return '<strong>Tap the cards to hold</strong>' + (v.timed && v.timeLeftMs ? ' <small class="vp-secs">' + secsLeft() + 's</small>' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const choosing = v.phase === 'hold' && !v.locked[me];
    const cards = v.finals ? v.finals[me] : v.dealt || [];
    const shown = v.finals ? v.holds[me] : v.holds[me] || hold;
    let html = '<div class="vp-ptop"><span>You <b>' + v.chips[me].toLocaleString() + '</b></span><span>Pot <b>' + v.pot + '</b></span><span>Them <b>' + v.chips[1 - me].toLocaleString() + '</b></span></div>' +
      '<p class="vp-msg">' + message(v) + '</p>' +
      '<div class="vp-prow">' + cards.map(function (c, i) {
        return '<button type="button" class="vp-pcard' + (shown[i] ? ' held' : '') + '" data-i="' + i + '"' + (choosing ? '' : ' disabled') + '>' + ArkBJ.card(c) + (shown[i] ? '<b>HELD</b>' : '') + '</button>';
      }).join('') + '</div>';
    if (choosing) html += '<button type="button" class="primary vp-draw">Draw ' + (5 - hold.filter(Boolean).length) + '</button>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'video-poker', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'vp-phone';
      root.addEventListener('click', function (e) {
        if (!view) return;
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        if (e.target.closest('.vp-draw')) { api.send({ type: 'hold', hold: hold.slice() }); api.vibrate(15); return; }
        const b = e.target.closest('[data-i]');
        if (b && !b.disabled) { const i = Number(b.getAttribute('data-i')); hold[i] = !hold[i]; api.vibrate(5); render(); }
      });
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (v.hand !== seenHand) { hold = [false, false, false, false, false]; seenHand = v.hand; }
      view = v;
      gotAt = Date.now();
      render();
    },
    unmount: function () { clearInterval(tick); root = view = null; seenHand = 0; },
  });
})();
