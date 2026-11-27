(function () {
  Ark.loadCss('/games/wall-race/style.css');
  const ready = Ark.loadScript('/games/wall-race/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  // A controller player's aim: { mode: 'step' | 'wall', at: square, dir }.
  const pads = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  /** The groove crossing at the bottom-right of a square (kept on the board). */
  const crossing = (v, c) => Math.min(Math.floor(c / v.size), v.size - 2) * (v.size - 1) + Math.min(c % v.size, v.size - 2);

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? ' ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '';
    let walls = '';
    for (let k = 0; k < v.wallsLeft[slot]; k++) walls += '<i></i>';
    const p = v.players[slot];
    const local = active && p.local && !p.bot;
    const pad = pads[slot];
    const help = local ? '<small>' + (pad && pad.mode === 'wall' ? 'D-pad moves the wall · X turns it · A places · B back' : 'D-pad picks a square · A steps · Y a wall') + '</small>' : '';
    return '<aside class="wr-side p' + (slot + 1) + (active ? ' active' : '') + '"><div class="wr-name">' + nameOf(v, slot) + '</div>' +
      '<div class="wr-dist"><b>' + v.distances[slot] + '</b> steps to go</div><div class="wr-walls">' + walls + '</div><div>' + v.wallsLeft[slot] + ' walls left</div>' +
      '<div class="wr-turn">' + (active ? 'To play' + clock : '') + help + '</div></aside>';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    return '<div class="wr-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, v.result.winner) + ' gets through!</span>' +
      (v.phase === 'over' ? '<small>Rematch or back to the lobby from your phones or controllers</small>' : '') + '</div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const s = v.turn;
    const p = v.phase === 'play' ? v.players[s] : null;
    const local = p && p.local && !p.bot;
    let opts = {};
    if (local) {
      const pad = pads[s] || (pads[s] = { mode: 'step', at: v.pawns[s], dir: 'h' });
      if (pad.mode === 'step') opts = { steps: v.steps, cursor: pad.at, cursorSlot: s };
      else {
        const k = crossing(v, pad.at);
        opts = { ghost: { dir: pad.dir, k: k, ok: v.wallsLeft[s] > 0 && ArkWalls.wallOk(v, pad.dir, k) } };
      }
    }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="wr-stage">' + side(v, 0) + '<div class="wr-centre">' + ArkWalls.boardHtml(v, opts) + banner(v) + '</div>' + side(v, 1) + '</div>';
  }

  Ark.register('host', 'wall-race', {
    padHint: 'D-pad picks a square, A steps there · Y: place a wall instead (D-pad moves it, X turns it, A places, B back) · A: rematch at the end',
    sounds: function (prev, v) {
      if (prev.phase === 'play' && v.phase !== 'play') return ['fanfare'];
      const k = function (x) { return x.lastMove ? x.round + ':' + x.lastMove.n : ''; };
      if (k(v) && k(v) !== k(prev)) return [v.lastMove.kind === 'wall' ? 'lock' : v.lastMove.kind === 'pass' ? 'close' : 'drop'];
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const pad = pads[slot] || (pads[slot] = { mode: 'step', at: v.pawns[slot], dir: 'h' });
      const n = v.size;
      const d = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (d) {
        const x = Math.min(n - 1, Math.max(0, (pad.at % n) + d[0]));
        const y = Math.min(n - 1, Math.max(0, Math.floor(pad.at / n) + d[1]));
        pad.at = y * n + x;
      } else if (btn === 'Y' && v.wallsLeft[slot] > 0) pad.mode = 'wall';
      else if (btn === 'B') pad.mode = 'step';
      else if (btn === 'X' && pad.mode === 'wall') pad.dir = pad.dir === 'h' ? 'v' : 'h';
      else if (btn === 'A') {
        if (pad.mode === 'step' && v.steps.includes(pad.at)) return { type: 'step', cell: pad.at };
        if (pad.mode === 'wall') {
          const k = crossing(v, pad.at);
          if (ArkWalls.wallOk(v, pad.dir, k)) { pad.mode = 'step'; return { type: 'wall', dir: pad.dir, k: k }; }
        }
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wr-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      // A new turn: the controller's aim starts at its pawn again.
      if (view && (view.turn !== v.turn || view.round !== v.round)) { delete pads[0]; delete pads[1]; }
      view = v;
      render();
    },
    unmount: function () { root = view = null; delete pads[0]; delete pads[1]; },
  });
})();
