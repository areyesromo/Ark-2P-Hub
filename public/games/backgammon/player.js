(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/backgammon/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/backgammon/board.js')]);

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let from = null; // the picked checker's point (or 'bar')
  let buzzed = '';

  const key = (k) => (k === 'bar' || k === 'off' ? k : Number(k));

  function targetsOf(v, f) {
    return new Set(v.legal.filter(function (m) { return m.from === f; }).map(function (m) { return m.to; }));
  }

  function send(input) {
    api.send(input);
    api.vibrate(12);
  }

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      from = null;
      send({ type: b.getAttribute('data-act') });
      Ark.showPick(b, 'data-act');
      return;
    }
    const pt = e.target.closest('[data-pt]');
    if (!pt || v.phase !== 'move' || v.turn !== v.you) return;
    const k = key(pt.getAttribute('data-pt'));
    if (from !== null && targetsOf(v, from).has(k)) {
      send({ type: 'move', from: from, to: k });
      from = null;
      return;
    }
    const sources = new Set(v.legal.map(function (m) { return m.from; }));
    if (!sources.has(k)) return;
    if (from === k) { from = null; return render(); }
    const t = targetsOf(v, k);
    // Only one place it can go: off it goes.
    if (t.size === 1) { send({ type: 'move', from: k, to: [...t][0] }); from = null; return; }
    from = k;
    render();
  }

  function status(v) {
    const me = v.you;
    const mine = v.turn === me;
    if (v.phase === 'opening') return 'Rolling to see who starts…';
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win the match! 🏆</span>' : '<span class="lost big ark-result">You lose the match</span>';
    if (v.phase === 'gameEnd') {
      const r = v.result;
      const kind = { gammon: ' (a gammon!)', backgammon: ' (a backgammon!)', drop: ' (dropped the double)', single: '' }[r.kind];
      return (r.winner === me ? '<span class="won">You win the game' : '<span class="lost">They win the game') + kind + '</span> · +' + r.points;
    }
    if (v.phase === 'offer') return v.offer.by === me ? 'You doubled. Waiting for them…' : '<strong>They double to ' + v.offer.value + '!</strong> Take or drop?';
    if (!mine) return 'Their turn…';
    if (v.phase === 'roll') return '<strong>Your turn!</strong> Roll' + (v.canDouble ? ' or double' : '');
    if (v.phase === 'noMove') return 'No move with that roll';
    if (v.canDone) return 'All moved. Done?';
    return from === null ? 'Tap a checker to move' : 'Now where it goes';
  }

  function buttons(v) {
    const me = v.you;
    const btn = function (act, label, cls, off) { return '<button class="bg-btn ' + cls + '" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' + label + '</button>'; };
    if (v.phase === 'over') return '<button class="primary rematch">Rematch</button>';
    if (v.phase === 'offer' && v.offer.by !== me) return '<div class="bg-btns">' + btn('take', 'Take (×' + v.offer.value + ')', 'go') + btn('drop', 'Drop (lose ' + (v.offer.value / 2) + ')', 'stop') + '</div>';
    if (v.turn !== me) return '';
    if (v.phase === 'roll') return '<div class="bg-btns">' + btn('roll', '🎲 Roll', 'go big') + (v.cubeOn ? btn('double', 'Double ×' + v.cube.value * 2, 'minor', !v.canDouble) : '') + '</div>';
    if (v.phase === 'move') return '<div class="bg-btns">' + btn('undo', '↶ Undo', 'minor', !v.canUndo) + btn('done', 'Done', 'go', !v.canDone) + '</div>';
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'move' && v.turn === me;
    const sources = mine && from === null ? new Set(v.legal.map(function (m) { return m.from; })) : new Set();
    const targets = mine && from !== null ? targetsOf(v, from) : new Set();
    root.innerHTML =
      '<div class="bg-top"><span>' + ArkBG.checker(me) + ' You <b>' + v.scores[me] + '</b> – <b>' + v.scores[1 - me] + '</b> Them · to ' + v.matchTo + '</span>' +
      '<span>Pips ' + v.pips[me] + ' / ' + v.pips[1 - me] + '</span></div>' +
      '<p class="bg-msg">' + status(v) + (v.timed && v.timeLeftMs && v.turn === me ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '') + '</p>' +
      ArkBG.boardHtml(v, { side: me, from: from, sources: sources, targets: targets, tappable: mine, dice: ArkBG.diceHtml(v) }) +
      buttons(v);
  }

  Ark.register('player', 'backgammon', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bg-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (from !== null && !v.legal.some(function (m) { return m.from === from; })) from = null;
      if (prev && v.turn === v.you && v.phase === 'roll' && prev.phase !== 'roll') api.vibrate(40);
      if (prev && v.phase === 'offer' && prev.phase !== 'offer' && v.offer.by !== v.you) api.vibrate([40, 40, 40]);
      if ((v.phase === 'gameEnd' || v.phase === 'over') && buzzed !== v.game + v.phase) {
        buzzed = v.game + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      from = null;
      buzzed = '';
    },
  });
})();
