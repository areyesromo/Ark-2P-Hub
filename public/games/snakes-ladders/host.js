(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/snakes-ladders/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/snakes-ladders/board.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const active = v.turn === slot && (v.phase === 'roll' || v.phase === 'choose');
    const p = v.players[slot];
    const local = active && p.local && !p.bot;
    const clock = active && v.timed && v.timeLeftMs ? ' ⏱ <span class="sl-secs">' + secsLeft() + 's</span>' : '';
    let dice = '';
    if (v.turn === slot && v.dice.length) dice = v.dice.map(function (d) { return ArkDice.html(d); }).join('');
    let turn = '';
    if (active) turn = (v.phase === 'roll' ? 'To roll' : 'Choose a die') + clock + (local ? '<small>' + (v.phase === 'roll' ? 'A rolls' : 'X the left die · B the right') + '</small>' : '');
    return '<aside class="sl-side p' + (slot + 1) + (active ? ' active' : '') + '"><div class="sl-name">' + nameOf(v, slot) + '</div>' +
      '<div class="sl-at">on <b>' + (v.pos[slot] || 'start') + '</b></div><div class="sl-dice">' + dice + '</div><div class="sl-turn">' + turn + '</div></aside>';
  }

  function note(v) {
    const m = v.lastMove;
    if (!m || v.phase === 'over' || v.phase === 'roundEnd') return '';
    if (m.missed) return nameOf(v, m.by) + ' ran out of time and stays put';
    let s = nameOf(v, m.by) + ' moves ' + m.steps;
    if (m.via === 'ladder') s += ' and climbs a ladder to ' + m.to + '! 🪜';
    else if (m.via === 'snake') s += ', lands on a snake and slides to ' + m.to + ' 🐍';
    else s += ' to ' + m.to;
    if (m.bumped) s += ' · bump! ' + nameOf(v, 1 - m.by) + ' goes back 10';
    return s;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const banner = v.phase === 'over' || v.phase === 'roundEnd' ? '<div class="sl-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, v.result.winner) + ' reaches 100!</span></div>' : '';
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="sl-stage">' + side(v, 0) + '<div class="sl-centre">' + ArkSnakes.boardHtml(v, { preview: v.phase === 'choose' ? v.options : null }) + banner + '</div>' + side(v, 1) + '</div>' +
      '<div class="sl-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'snakes-ladders', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      const m = v.lastMove;
      if (m && (!prev.lastMove || prev.lastMove.n !== m.n)) return [m.via === 'ladder' ? 'correct' : m.via === 'snake' ? 'wrong' : m.bumped ? 'knock' : 'drop'];
      if (v.phase === 'choose' && prev.phase === 'roll') return ['tick'];
      return [];
    },
    padHint: 'A rolls the dice · X moves by the left die, B by the right · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.turn !== slot) return null;
      if (v.phase === 'roll' && btn === 'A') return { type: 'roll' };
      if (v.phase === 'choose' && (btn === 'X' || btn === 'B')) return { type: 'move', die: btn === 'X' ? 0 : 1 };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sl-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.sl-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
