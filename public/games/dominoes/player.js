(function () {
  Ark.loadCss('/games/dominoes/style.css');
  const ready = Ark.loadScript('/games/dominoes/tiles.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = null; // a tile that fits both ends: which end?
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (v.phase !== 'play' || v.turn !== v.you) return;
    const act = e.target.closest('[data-act]');
    if (act) { api.send({ type: act.getAttribute('data-act') }); api.vibrate(15); act.disabled = true; return; }
    const end = e.target.closest('[data-end]');
    if (end && picked) {
      api.send({ type: 'play', tile: picked, end: end.getAttribute('data-end') });
      api.vibrate(15);
      picked = null;
      return render();
    }
    const t = e.target.closest('[data-tile]');
    if (!t) return;
    const tile = t.getAttribute('data-tile');
    const ends = v.fits[tile];
    if (!ends) return api.vibrate([20, 30, 20]);
    // Both ends, and they'd differ: ask which. Otherwise straight on.
    if (ends.length === 2 && v.ends[0] !== v.ends[1]) { picked = picked === tile ? null : tile; return render(); }
    api.send({ type: 'play', tile: tile, end: ends[0] });
    api.vibrate(15);
    t.classList.add('going');
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'handEnd') {
      const r = v.result;
      if (r.winner === null) return 'Blocked, and level: no score';
      return (r.winner === me ? '<span class="won">You win the hand' : '<span class="lost">They win the hand') + ' +' + r.points + '</span>' + (r.blocked ? ' <small>(blocked)</small>' : '');
    }
    if (v.turn !== me) return 'Their turn…';
    if (v.stuck === 'draw') return '<strong>Nothing fits:</strong> draw a tile';
    if (v.stuck === 'pass') return '<strong>Nothing fits</strong> and the boneyard is empty';
    if (picked) return 'Which end?';
    return '<strong>Your turn!</strong> Play a tile';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    const fresh = v.last && v.last.what === 'play' ? (v.last.end === 'L' ? 0 : v.line.length - 1) : -1;
    let html = '<div class="dm-top"><span>You <b>' + v.scores[me] + '</b> · Them <b>' + v.scores[1 - me] + '</b> <small>to ' + v.target + '</small></span>' +
      '<span>Them: ' + v.counts[1 - me] + ' ' + ArkDom.back('mini') + ' · Yard ' + v.yard + '</span></div>' +
      '<p class="dm-msg">' + message(v) + (v.timed && v.timeLeftMs && mine ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '') + '</p>' +
      '<div class="dm-table phone">' + ArkDom.lineHtml(v.line, 5, fresh) + '</div>';
    if (picked) {
      html += '<div class="dm-ends-pick"><button data-end="L">◀ On the ' + v.ends[0] + '</button><button data-end="R">On the ' + v.ends[1] + ' ▶</button></div>';
    }
    html += '<div class="dm-hand mine">' + v.tiles.map(function (t) {
      const h = t.split('-').map(Number);
      const can = mine && v.fits[t];
      return ArkDom.tile(h[0], h[1], 'v', (can ? 'can' : mine ? 'dim' : '') + (picked === t ? ' picked' : ''), ' data-tile="' + t + '"');
    }).join('') + '</div>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    else if (mine && v.stuck) html += '<button class="dm-act" data-act="' + v.stuck + '">' + (v.stuck === 'draw' ? 'Draw a tile' : 'Pass') + '</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'dominoes', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'dm-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (picked && !(v.fits && v.fits[picked])) picked = null;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if ((v.phase === 'handEnd' || v.phase === 'over') && buzzed !== v.hand + v.phase && v.result.winner !== null) {
        buzzed = v.hand + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      picked = null;
      buzzed = '';
    },
  });
})();
