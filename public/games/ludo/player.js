(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/ludo/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/ludo/board.js')]);

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (v.turn !== v.you) return;
    if (e.target.closest('.lu-roll') && v.phase === 'roll') {
      api.send({ type: 'roll' });
      api.vibrate(20);
      e.target.closest('.lu-roll').disabled = true;
      return;
    }
    const p = e.target.closest('[data-pawn]');
    if (p && v.phase === 'move') {
      api.send({ type: 'move', pawn: Number(p.getAttribute('data-pawn')) });
      api.vibrate(15);
      root.querySelectorAll('[data-pawn]').forEach(function (b) { b.removeAttribute('data-pawn'); b.disabled = true; });
    }
  }

  function where(place) {
    if (place < 0) return 'out of the yard';
    if (place === 56) return 'home!';
    if (place > 50) return 'up the home path';
    return place + ' along';
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'gameEnd') return v.result.winner === me ? '<span class="won">You take the game!</span>' : '<span class="lost">They take the game</span>';
    if (v.turn !== me) return 'Their turn…';
    if (v.phase === 'roll') return '<strong>Your roll' + (v.sixes ? ' again!' : '!') + '</strong>';
    if (v.phase === 'show') return 'No move with that';
    return '<strong>Pick a pawn</strong>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me;
    const home = function (s) { return v.pawns[s].filter(function (p) { return p === 56; }).length; };
    let html = '<div class="lu-top"><span class="p' + (me + 1) + '">You <b>' + home(me) + '/4</b> home</span><span>Them <b>' + home(1 - me) + '/4</b></span></div>' +
      '<p class="lu-msg">' + message(v) + (v.timed && v.timeLeftMs && mine ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '') + '</p>' +
      ArkLudo.boardHtml(v, { tappable: mine && v.phase === 'move' });
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    else if (mine && v.phase === 'roll') html += '<button class="lu-roll">' + (v.die ? ArkDice.html(v.die) : '') + ' Roll</button>';
    else if (mine && v.phase === 'move') {
      html += '<div class="lu-picks"><span>' + ArkDice.html(v.die) + '</span>' + v.movable.map(function (i, k) {
        return '<button class="lu-pick p' + (me + 1) + '" data-pawn="' + i + '"><b>' + (i + 1) + '</b><small>' + where(v.targets[k]) + '</small></button>';
      }).join('') + '</div>';
    } else html += '<div class="lu-picks quiet">' + (v.die ? ArkDice.html(v.die) : '') + '</div>';
    root.innerHTML = html;
  }

  Ark.register('player', 'ludo', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'lu-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.turn === v.you && v.phase === 'roll' && (prev.turn !== v.you || prev.phase !== 'roll')) api.vibrate(40);
      if (prev && v.last && v.last.hit !== null && v.last.slot !== v.you && JSON.stringify(v.last) !== JSON.stringify(prev.last)) api.vibrate(200);
      if ((v.phase === 'gameEnd' || v.phase === 'over') && buzzed !== v.game + v.phase) {
        buzzed = v.game + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      buzzed = '';
    },
  });
})();
