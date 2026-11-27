(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/farkle/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/farkle/score.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const pads = {}; // a controller player's cursor and picked dice: { at, picked: [] }

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const fmt = (n) => n.toLocaleString('en');

  function bar(v, slot) {
    const pct = Math.min(100, (v.scores[slot] / v.target) * 100);
    const live = v.turn === slot && v.turnPoints ? Math.min(100 - pct, (v.turnPoints / v.target) * 100) : 0;
    return '<div class="fk-player p' + (slot + 1) + (v.turn === slot ? ' turn' : '') + '"><header>' + nameOf(v, slot) + '<b>' + fmt(v.scores[slot]) + '</b></header>' +
      '<div class="fk-bar"><i style="width:' + pct + '%"></i><em style="left:' + pct + '%;width:' + live + '%"></em></div></div>';
  }

  function middle(v) {
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="ark-result draw">Level! A draw</span>';
      return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins!</span>';
    }
    if (v.phase === 'banked') {
      const b = v.banked;
      return b.farkle ? '<div class="fk-big bad">Farkle!</div>' : '<div class="fk-big">' + nameOf(v, b.by) + ' banks <b>' + fmt(b.points) + '</b></div>';
    }
    const p = v.players[v.turn];
    const local = p.local && !p.bot;
    const pad = pads[v.turn];
    const clock = v.timed && v.timeLeftMs ? ' · ⏱ <span class="fk-secs">' + secsLeft() + 's</span>' : '';
    const kept = v.kept.map(function (set) { return '<span class="fk-set">' + set.map(function (d) { return ArkDice.html(d); }).join('') + '</span>'; }).join('');
    let dice = '';
    if (v.dice.length) {
      dice = v.dice.map(function (d, i) {
        const cls = (local && pad && pad.picked.includes(i) ? 'held' : '') + (local && pad && pad.at === i ? ' fk-aim' : '');
        return ArkDice.html(d, cls);
      }).join('');
    }
    let note = '';
    if (v.phase === 'roll') note = nameOf(v, v.turn) + ' to roll ' + v.left + (v.left === 1 ? ' die' : ' dice') + clock + (local ? '<small>B roll</small>' : '');
    else if (v.phase === 'pick') note = 'Set aside scoring dice, then roll on or bank' + clock + (local ? '<small>◀ ▶ A pick · X keep and roll · Y keep and bank</small>' : '');
    else if (v.phase === 'farkle') note = '<span class="fk-big bad">Farkle!</span> Nothing scores: the turn\'s ' + fmt(v.turnPoints) + ' is lost';
    return (v.lastTurn !== null ? '<div class="fk-last">Last turn for ' + nameOf(v, v.lastTurn) + ': beat ' + fmt(v.scores[1 - v.lastTurn]) + '</div>' : '') +
      '<div class="fk-kept">' + kept + '</div>' +
      '<div class="fk-turn">This turn: <b>' + fmt(v.turnPoints) + '</b></div>' +
      '<div class="fk-dice">' + dice + '</div><div class="fk-note">' + note + '</div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = '<div class="fk-head">First to <strong>' + fmt(v.target) + '</strong></div>' +
      '<div class="fk-players">' + bar(v, 0) + bar(v, 1) + '</div>' +
      '<div class="fk-table">' + middle(v) + '</div>';
  }

  Ark.register('host', 'farkle', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      if (v.phase === 'farkle' && prev.phase !== 'farkle') return ['wrong'];
      if (v.phase === 'banked' && prev.phase !== 'banked' && !v.banked.farkle) return ['point'];
      if (v.phase === 'pick' && v.n !== prev.n) return ['drop'];
      return [];
    },
    padHint: 'B rolls · ◀ ▶ picks a die, A marks it · X keeps them and rolls on · Y keeps them and banks · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.turn !== slot) return null;
      if (v.phase === 'roll') return btn === 'B' ? { type: 'roll' } : null;
      if (v.phase !== 'pick') return null;
      const pad = pads[slot] || (pads[slot] = { at: 0, picked: [] });
      if (btn === 'LEFT') pad.at = Math.max(0, pad.at - 1);
      else if (btn === 'RIGHT') pad.at = Math.min(v.dice.length - 1, pad.at + 1);
      else if (btn === 'A') {
        const k = pad.picked.indexOf(pad.at);
        if (k >= 0) pad.picked.splice(k, 1); else pad.picked.push(pad.at);
      } else if ((btn === 'X' || btn === 'Y') && ArkFarkle.scoreOf(pad.picked.map(function (i) { return v.dice[i]; }))) {
        const dice = pad.picked.slice();
        delete pads[slot];
        return { type: 'keep', dice: dice, then: btn === 'X' ? 'roll' : 'bank' };
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'fk-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.fk-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) {
      if (view && view.n !== v.n) { delete pads[0]; delete pads[1]; }
      view = v;
      gotAt = Date.now();
      render();
    },
    unmount: function () { clearInterval(tick); root = view = null; delete pads[0]; delete pads[1]; },
  });
})();
