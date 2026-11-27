(function () {
  Ark.loadCss('/games/wall-race/style.css');
  const ready = Ark.loadScript('/games/wall-race/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let mode = 'step';
  let ghost = null; // { k, dir } the wall being placed
  let dir = 'h';
  let buzzed = '';

  const crossing = (v, c) => Math.min(Math.floor(c / v.size), v.size - 2) * (v.size - 1) + Math.min(c % v.size, v.size - 2);

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.getAttribute('data-mode'); ghost = null; api.vibrate(8); return render(); }
    if (e.target.closest('.wr-turnwall')) { dir = dir === 'h' ? 'v' : 'h'; if (ghost) ghost.dir = dir; return render(); }
    if (e.target.closest('.wr-place') && ghost) {
      api.send({ type: 'wall', dir: ghost.dir, k: ghost.k });
      api.vibrate(20);
      ghost = null;
      mode = 'step';
      return;
    }
    const c = e.target.closest('[data-c]');
    if (!c || v.phase !== 'play' || v.turn !== v.you) return;
    const cell = Number(c.getAttribute('data-c'));
    if (mode === 'step') {
      if (!v.steps.includes(cell)) return;
      api.send({ type: 'step', cell: cell });
      api.vibrate(15);
    } else {
      ghost = { k: crossing(v, cell), dir: dir };
      api.vibrate(8);
      render();
    }
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'play') {
      if (v.turn !== me) return 'Their turn…';
      if (mode === 'wall') return ghost ? (ArkWalls.wallOk(v, ghost.dir, ghost.k) ? 'Place it, or tap elsewhere' : '<span class="lost">That wall can\'t go there</span>') : 'Tap where the wall should go';
      return '<strong>Your turn!</strong> Tap a square to step, or place a wall';
    }
    const won = v.result.winner === me;
    return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    let opts = { flip: me === 1 };
    if (mine && mode === 'step') opts.steps = v.steps;
    if (mine && mode === 'wall') {
      opts.tap = true;
      if (ghost) opts.ghost = { dir: ghost.dir, k: ghost.k, ok: ArkWalls.wallOk(v, ghost.dir, ghost.k) };
    }
    let html = '<div class="wr-top"><span class="p' + (me + 1) + '-text">● You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span><span>' + v.distances[me] + ' to go · ' + v.wallsLeft[me] + ' walls</span></div>' +
      '<p class="wr-msg">' + message(v) + '</p>' + ArkWalls.boardHtml(v, opts);
    if (mine) {
      html += '<div class="wr-modes"><button type="button" data-mode="step" class="' + (mode === 'step' ? 'on' : '') + '">🚶 Step</button>' +
        '<button type="button" data-mode="wall" class="' + (mode === 'wall' ? 'on' : '') + '"' + (v.wallsLeft[me] ? '' : ' disabled') + '>🧱 Wall</button></div>';
      if (mode === 'wall') html += '<div class="wr-wallbar"><button type="button" class="wr-turnwall">' + (dir === 'h' ? '↔︎' : '↕︎') + ' Turn</button><button type="button" class="primary wr-place"' + (ghost && ArkWalls.wallOk(v, ghost.dir, ghost.k) ? '' : ' disabled') + '>Place wall</button></div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'wall-race', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wr-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (v.turn !== v.you) { mode = 'step'; ghost = null; }
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase) {
        buzzed = v.round + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
      Ark.phoneClock(v.phase === 'play' && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; mode = 'step'; ghost = null; buzzed = ''; },
  });
})();
