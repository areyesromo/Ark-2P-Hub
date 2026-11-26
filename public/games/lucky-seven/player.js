(function () {
  Ark.loadCss('/games/lucky-seven/style.css');
  const ready = Ark.loadScript('/games/lucky-seven/cards.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'roundEnd') return 'Round over: you +' + v.result.gains[me] + ', them +' + v.result.gains[1 - me];
    if (v.status[me] === 'bust') return '<span class="lost">Bust!</span> Nothing this round';
    if (v.status[me] === 'stopped') return 'Banked <b>' + v.banked[me] + '</b>. Their go…';
    if (v.status[me] === 'lucky') return '<span class="won">Lucky Seven! 🍀</span>';
    if (v.turn !== me) return 'Their go…';
    const r = ArkLucky.risk(v, me);
    return '<strong>Flip or stop?</strong> ' + (r.bad ? r.bad + ' of ' + r.of + ' would bust you' : 'nothing can bust you') + (v.timed ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me && v.phase === 'play';
    let html = '<div class="l7-ptop"><span>You <b>' + v.scores[me] + '</b></span><span>Them <b>' + v.scores[1 - me] + '</b></span><span>to ' + v.target + '</span></div>' +
      '<div class="l7-them">Them: ' + ArkLucky.hand(v.hands[1 - me]) + '</div>' +
      '<p class="l7-msg">' + message(v) + '</p>' +
      '<div class="l7-mine">' + ArkLucky.hand(v.hands[me], v.event && v.event.by === me && v.event.card) + (v.hands[me].length && v.status[me] !== 'bust' ? '<div class="l7-sum">' + v.banked[me] + '</div>' : '') + '</div>';
    if (v.phase === 'play' && v.status[me] === 'in') {
      html += '<div class="l7-btns"><button type="button" class="l7-flip" data-a="flip"' + (mine ? '' : ' disabled') + '>FLIP</button>' +
        '<button type="button" class="l7-stop" data-a="stop"' + (mine && v.flipped[me] ? '' : ' disabled') + '>STOP<small>bank ' + v.banked[me] + '</small></button></div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'lucky-seven', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'l7-phone';
      root.addEventListener('click', function (e) {
        if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
        const b = e.target.closest('[data-a]');
        if (b && !b.disabled) { api.send({ type: b.getAttribute('data-a') }); api.vibrate(12); }
      });
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.event && (!prev.event || prev.event.n !== v.event.n) && v.event.by === v.you) {
        if (v.event.what === 'bust') api.vibrate(250);
        else if (v.event.what === 'lucky') api.vibrate([60, 40, 60, 40, 60]);
      }
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(30);
      render();
    },
    unmount: function () { root = view = null; },
  });
})();
