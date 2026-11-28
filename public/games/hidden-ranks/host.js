(function () {
  Ark.loadCss('/games/hidden-ranks/style.css');
  const ready = Ark.loadScript('/games/hidden-ranks/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, s) {
    const active = v.phase === 'play' && v.turn === s;
    const clock = v.timed && v.timeLeftMs && (active || v.phase === 'deploy') ? ' ⏱ <span class="hr-secs">' + secsLeft() + 's</span>' : '';
    let state = '';
    if (v.phase === 'deploy') state = (v.ready[s] ? '✅ Ready' : 'Setting out…') + clock;
    else if (active) state = 'To move' + clock;
    return '<aside class="hr-side p' + (s + 1) + (active ? ' active' : '') + '"><div class="hr-name">' + nameOf(v, s) + '</div>' +
      '<div>Lost:</div><div class="hr-lost">' + v.taken[s].map(function (r) { return ArkRanks.pieceHtml({ s: s, rank: r }); }).join('') + '</div>' +
      '<div class="hr-turn">' + state + '</div></aside>';
  }

  function note(v) {
    if (v.phase === 'deploy') return 'Setting out the armies, in secret on your phones';
    const m = v.lastMove;
    if (!m) return '';
    if (m.missed) return nameOf(v, m.by) + ' ran out of time';
    if (m.fight) return ArkRanks.fightText(m.fight);
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    let banner = '';
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const r = v.result;
      const how = r.how === 'flag' ? 'took the flag' : r.how === 'stuck' ? 'left them nothing to move' : 'has the bigger army';
      banner = '<div class="hr-banner">' + (r.winner === null ? '<span class="ark-result draw">Level armies: a draw</span>' : '<span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span><small>' + how + '</small>') + '</div>';
    }
    const board = v.board ? ArkRanks.boardHtml(v, {}) : '<div class="hr-board" style="--n:' + v.n + '"></div>';
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="hr-stage">' + side(v, 0) + '<div class="hr-centre">' + board + banner + '</div>' + side(v, 1) + '</div>' +
      '<div class="hr-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'hidden-ranks', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      const m = v.lastMove;
      if (m && (!prev.lastMove || prev.lastMove.n !== m.n)) return [m.fight ? (m.fight.d === 'B' && m.fight.result === 'd' ? 'boom' : 'crash') : 'drop'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hr-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.hr-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
