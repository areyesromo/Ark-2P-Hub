(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/farkle/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/farkle/score.js')]);
  const fmt = (n) => n.toLocaleString('en');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = [];
  let seenN = -1;

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.fk-roll')) { api.send({ type: 'roll' }); api.vibrate(15); return; }
    const go = e.target.closest('[data-then]');
    if (go && !go.disabled) {
      api.send({ type: 'keep', dice: picked.slice(), then: go.getAttribute('data-then') });
      api.vibrate(20);
      picked = [];
      return;
    }
    const d = e.target.closest('[data-i]');
    if (d && v.phase === 'pick' && v.turn === v.you) {
      const i = Number(d.getAttribute('data-i'));
      const k = picked.indexOf(i);
      if (k >= 0) picked.splice(k, 1); else picked.push(i);
      api.vibrate(8);
      render();
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="big ark-result draw">Level!</span>';
      return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    }
    if (v.phase === 'banked') return v.banked.farkle ? (v.banked.by === me ? '<span class="lost">Farkle!</span>' : 'They farkled!') : (v.banked.by === me ? 'You bank ' : 'They bank ') + fmt(v.banked.points);
    if (v.turn !== me) return 'Their turn… <small>(' + fmt(v.turnPoints) + ' this turn)</small>';
    const last = v.lastTurn === me ? '<br><small>Last turn: beat ' + fmt(v.scores[1 - me]) + '</small>' : '';
    if (v.phase === 'roll') return '<strong>Roll ' + v.left + (v.left === 1 ? ' die' : ' dice') + '</strong> · this turn ' + fmt(v.turnPoints) + last;
    if (v.phase === 'farkle') return '<span class="lost">Farkle!</span> Nothing scores';
    return 'Tap the dice to set aside' + last;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me;
    const sel = ArkFarkle.scoreOf(picked.map(function (i) { return v.dice[i]; }));
    let html = '<div class="fk-ptop"><span>You <b>' + fmt(v.scores[me]) + '</b></span><span>to ' + fmt(v.target) + '</span><span>Them <b>' + fmt(v.scores[1 - me]) + '</b></span></div>' +
      '<p class="fk-msg">' + message(v) + '</p>';
    if (mine && (v.phase === 'pick' || v.phase === 'farkle')) {
      html += '<div class="fk-pdice">' + v.dice.map(function (d, i) {
        return '<button type="button" data-i="' + i + '" class="' + (picked.includes(i) ? 'on' : '') + '">' + ArkDice.html(d, picked.includes(i) ? 'held' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (mine && v.phase === 'pick') {
      const after = v.dice.length - picked.length || 6;
      html += '<p class="fk-sel">' + (picked.length ? (sel ? 'Set aside: <b>' + fmt(sel) + '</b> · turn ' + fmt(v.turnPoints + sel) : 'Every die you set aside must score') : '&nbsp;') + '</p>' +
        '<div class="fk-buttons"><button type="button" class="primary" data-then="roll"' + (sel ? '' : ' disabled') + '>Keep and roll ' + after + '</button>' +
        '<button type="button" data-then="bank"' + (sel ? '' : ' disabled') + '>Keep and bank' + (sel ? ' ' + fmt(v.turnPoints + sel) : '') + '</button></div>';
    }
    if (mine && v.phase === 'roll') html += '<button type="button" class="primary fk-roll">🎲 Roll</button>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'farkle', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'fk-phone';
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
      Ark.phoneClock((v.phase === 'roll' || v.phase === 'pick') && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; picked = []; },
  });
})();
