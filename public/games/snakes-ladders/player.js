(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/snakes-ladders/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/snakes-ladders/board.js')]);

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;

  function onClick(e) {
    if (!view) return;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.sl-roll')) { api.send({ type: 'roll' }); api.vibrate(15); return; }
    const d = e.target.closest('[data-die]');
    if (d) { api.send({ type: 'move', die: Number(d.getAttribute('data-die')) }); api.vibrate(15); }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const won = v.result.winner === me;
      return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
    }
    if (v.turn !== me) return 'Their turn… <small>(you\'re on ' + (v.pos[me] || 'start') + ')</small>';
    if (v.phase === 'roll') return '<strong>Roll!</strong> You\'re on ' + (v.pos[me] || 'start');
    if (v.phase === 'choose') return '<strong>Which die?</strong>';
    return '';
  }

  /** What a landing square means: a ladder, a snake, a bump. */
  function tag(v, die) {
    const from = v.pos[v.you];
    let mid = from + v.dice[die];
    if (mid > 100) mid = 200 - mid;
    const to = v.options[die];
    if (v.ladders[mid]) return 'to ' + to + ' 🪜';
    if (v.snakes[mid]) return 'to ' + to + ' 🐍';
    return 'to ' + to + (to === v.pos[1 - v.you] && to > 0 ? ' 💥' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me;
    let html = '<div class="sl-ptop"><span class="p' + (me + 1) + '-text">● You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span><span>you ' + (v.pos[me] || 'start') + ' · them ' + (v.pos[1 - me] || 'start') + '</span></div>' +
      '<p class="sl-msg">' + message(v) + '</p>' + ArkSnakes.boardHtml(v, { preview: mine && v.phase === 'choose' ? v.options : null });
    if (mine && v.phase === 'roll') html += '<button type="button" class="primary sl-roll">🎲🎲 Roll</button>';
    if (mine && v.phase === 'choose') {
      html += '<div class="sl-choose">' + v.dice.map(function (d, i) {
        return '<button type="button" data-die="' + i + '">' + ArkDice.html(d) + '<small>' + tag(v, i) + '</small></button>';
      }).join('') + '</div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'snakes-ladders', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sl-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      render();
      Ark.phoneClock((v.phase === 'roll' || v.phase === 'choose') && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; },
  });
})();
