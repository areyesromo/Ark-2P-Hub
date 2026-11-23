(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/ludo/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/ludo/board.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const aim = {}; // controller players: slot -> which of the movable pawns

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const homeCount = (v, slot) => v.pawns[slot].filter(function (p) { return p === 56; }).length;

  function status(v) {
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins!</span><small>Rematch or back to the lobby</small>';
    if (v.phase === 'gameEnd') return '<span>' + nameOf(v, v.result.winner) + ' takes the game</span>';
    const who = nameOf(v, v.turn);
    if (v.phase === 'roll') return '<span>' + who + ' to roll' + (v.sixes ? ' again' : '') + '</span>';
    if (v.phase === 'show') return v.sixes === 0 && v.die === 6 ? 'Three 6s: turn over' : 'No move';
    return '<span>' + who + ' picks a pawn</span>';
  }

  function corner(v) {
    const clock = v.timed && v.timeLeftMs ? '<small class="lu-clock">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '';
    const dice = '<div class="lu-dice p' + (v.turn + 1) + '">' + (v.die ? ArkDice.html(v.die, 'roll' + (v.rollNo % 2)) : ArkDice.html(0)) + '</div>' + clock;
    const sides = [0, 1].map(function (s) { return '<div class="lu-who p' + (s + 1) + (v.turn === s ? ' on' : '') + '">' + nameOf(v, s) + ' <b>' + homeCount(v, s) + '/4</b></div>'; }).join('');
    return [dice, '<div class="lu-status">' + status(v) + '</div>' + sides];
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const p = v.players[v.turn];
    const local = v.phase === 'move' && p.local && !p.bot;
    const cur = local ? v.movable[Math.min(aim[v.turn] || 0, v.movable.length - 1)] : null;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.game) +
      '<div class="lu-stage">' + ArkLudo.boardHtml(v, { cursor: cur, corner: corner(v) }) + '</div>';
  }

  Ark.register('host', 'ludo', {
    padHint: 'A rolls · ◀ ▶ picks a pawn, A moves it',
    sounds: function (prev, v) {
      const out = [];
      if (v.rollNo !== prev.rollNo) out.push('knock');
      if (v.last && JSON.stringify(v.last) !== JSON.stringify(prev.last)) out.push(v.last.hit !== null ? 'boom' : v.last.to === 56 ? 'correct' : 'drop');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.turn !== slot) return null;
      if (v.phase === 'roll') return btn === 'A' ? { type: 'roll' } : null;
      if (v.phase !== 'move') return null;
      const n = v.movable.length;
      const at = Math.min(aim[slot] || 0, n - 1);
      if (btn === 'LEFT' || btn === 'RIGHT') { aim[slot] = (at + (btn === 'LEFT' ? -1 : 1) + n) % n; render(); return null; }
      return btn === 'A' ? { type: 'move', pawn: v.movable[at] } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'lu-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      delete aim[0];
      delete aim[1];
    },
  });
})();
