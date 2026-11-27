(function () {
  Ark.loadCss('/games/go/style.css');
  const ready = Ark.loadScript('/games/go/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const cursors = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const colour = (v, slot) => (slot === v.black ? 'b' : 'w');

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? ' ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '';
    const p = v.players[slot];
    const help = active && p.local && !p.bot ? '<small>D-pad moves · A places · X passes</small>' : '';
    return '<aside class="go-side p' + (slot + 1) + (active ? ' active' : '') + '"><div class="stone ' + colour(v, slot) + '"></div><div class="go-name">' + nameOf(v, slot) + '</div>' +
      '<div class="go-stat">' + (slot === v.black ? 'Black' : 'White (+' + v.komi + ')') + '</div>' +
      '<div class="go-stat">' + v.taken[slot] + ' taken</div>' +
      '<div class="go-turn">' + (active ? 'To play' + clock : '') + help + '</div></aside>';
  }

  function note(v) {
    if (v.phase !== 'play' || !v.lastMove) return '';
    if (v.lastMove.cell === -1) return nameOf(v, v.lastMove.by) + ' passed' + (v.passes === 1 ? ': pass again to end the game' : '');
    return '';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    const r = v.result;
    const how = r.how === 'resign' ? nameOf(v, 1 - r.winner) + ' resigned' : nameOf(v, 0) + ' ' + r.points[0] + ' · ' + nameOf(v, 1) + ' ' + r.points[1];
    return '<div class="go-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span><small>' + how + '</small></div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const p = v.phase === 'play' ? v.players[v.turn] : null;
    const local = p && p.local && !p.bot;
    const mid = Math.floor(v.size / 2) * v.size + Math.floor(v.size / 2);
    if (local && cursors[v.turn] === undefined) cursors[v.turn] = mid;
    const opts = { cursor: local ? cursors[v.turn] : null, cursorSlot: v.turn, dead: v.result ? v.result.dead : [] };
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="go-stage">' + side(v, 0) + '<div class="go-centre">' + ArkGo.boardHtml(v, opts) + banner(v) + '</div>' + side(v, 1) + '</div>' +
      '<div class="go-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'go', {
    padHint: 'D-pad (or stick) moves your ring · A places a stone · X passes · A: rematch at the end',
    sounds: function (prev, v) {
      if (prev.phase === 'play' && v.phase !== 'play') return ['fanfare'];
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (k(v) && k(v) !== k(prev)) return [v.lastMove.cell === -1 ? 'close' : v.lastMove.took ? 'knock' : 'drop'];
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      if (btn === 'X') return { type: 'pass' };
      const c = cursors[slot] === undefined ? Math.floor(v.board.length / 2) : cursors[slot];
      const d = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (d) {
        const x = Math.min(v.size - 1, Math.max(0, (c % v.size) + d[0]));
        const y = Math.min(v.size - 1, Math.max(0, Math.floor(c / v.size) + d[1]));
        cursors[slot] = y * v.size + x;
        render();
        return null;
      }
      return btn === 'A' && !v.board[c] ? { type: 'place', cell: c } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'go-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; delete cursors[0]; delete cursors[1]; },
  });
})();
