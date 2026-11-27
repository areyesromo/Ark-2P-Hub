(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/shut-the-box/style.css');
  const ready = Ark.loadScript('/shared/dice.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = [];
  let seenN = 0;

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const r = e.target.closest('[data-roll]');
    if (r) { api.send({ type: 'roll', dice: Number(r.getAttribute('data-roll')) }); api.vibrate(15); return; }
    if (e.target.closest('.sb-go')) {
      api.send({ type: 'shut', tiles: picked.slice() });
      api.vibrate(20);
      picked = [];
      return;
    }
    const t = e.target.closest('[data-n]');
    if (t && v.phase === 'shut' && v.turn === v.you) {
      const n = Number(t.getAttribute('data-n'));
      const k = picked.indexOf(n);
      if (k >= 0) picked.splice(k, 1); else picked.push(n);
      api.vibrate(8);
      render();
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'roundEnd') {
      const r = v.result;
      return r.winner === null ? 'Level: nobody takes it' : (r.winner === me ? '<span class="won">You take the round</span>' : '<span class="lost">They take the round</span>') + ' · ' + r.scores[me] + ' to ' + r.scores[1 - me];
    }
    if (v.turn !== me) return v.scores[me] !== null ? 'You scored <b>' + v.scores[me] + '</b>. Their turn…' : 'Their turn…';
    const target = v.scores[1 - me] !== null ? '<br><small>Score to beat: ' + v.scores[1 - me] + '</small>' : '';
    if (v.phase === 'roll') return '<strong>Roll!</strong>' + target;
    if (v.phase === 'stuck') return 'Nothing adds up to ' + v.total + ': that\'s your turn';
    const sum = picked.reduce(function (a, b) { return a + b; }, 0);
    return 'Shut tiles that add up to <b>' + v.total + '</b> <small>(' + sum + ' picked)</small>' + target;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me;
    let tiles = '';
    for (let n = 1; n <= v.tiles; n++) {
      const open = v.open[me].includes(n);
      tiles += '<button type="button" class="sb-tile' + (open ? '' : ' shut') + (picked.includes(n) ? ' picked' : '') + '"' + (open && mine && v.phase === 'shut' ? ' data-n="' + n + '"' : ' disabled') + '>' + n + '</button>';
    }
    const sum = picked.reduce(function (a, b) { return a + b; }, 0);
    let html = '<div class="sb-ptop"><span>You <b>' + v.wins[me] + '</b></span><span>Round ' + v.round + ' · first to ' + v.winScore + '</span><span>Them <b>' + v.wins[1 - me] + '</b></span></div>' +
      '<div class="sb-pdice">' + (v.dice.length && mine ? v.dice.map(function (d) { return ArkDice.html(d); }).join('') : '') + '</div>' +
      '<p class="sb-msg">' + message(v) + '</p>' +
      '<div class="sb-tiles sb-ptiles" style="--n:' + v.tiles + '">' + tiles + '</div>';
    if (mine && v.phase === 'roll') html += '<div class="sb-buttons"><button type="button" class="primary" data-roll="2">🎲🎲 Roll two</button>' + (v.oneDie ? '<button type="button" data-roll="1">🎲 Roll one</button>' : '') + '</div>';
    if (mine && v.phase === 'shut') html += '<button type="button" class="primary sb-go"' + (sum === v.total ? '' : ' disabled') + '>Shut ' + (picked.length ? picked.slice().sort(function (a, b) { return a - b; }).join(' + ') : 'tiles') + '</button>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'shut-the-box', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sb-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (v.n !== seenN) { picked = []; seenN = v.n; }
      if (prev && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      render();
      Ark.phoneClock((v.phase === 'roll' || v.phase === 'shut') && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; picked = []; },
  });
})();
