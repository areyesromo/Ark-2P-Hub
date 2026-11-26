(function () {
  Ark.loadCss('/games/ultimate-ttt/style.css');
  const ready = Ark.loadScript('/games/ultimate-ttt/board.js');
  const MARK = ['✕', '◯'];
  const WHERE = ['top-left', 'top', 'top-right', 'left', 'middle', 'right', 'bottom-left', 'bottom', 'bottom-right'];

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let aim = null; // the square tapped once (tap it again to place)
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.ut-place') && aim !== null) return place();
    const p = e.target.closest('[data-c]');
    if (!p || v.phase !== 'play' || v.turn !== v.you) return;
    const c = Number(p.getAttribute('data-c'));
    if (aim === c) return place();
    aim = c;
    api.vibrate(8);
    render();
  }

  function place() {
    api.send({ type: 'place', cell: aim });
    api.vibrate(15);
    // Screen first: the mark shows at once (the next view confirms it).
    const cells = view.cells.slice();
    cells[aim] = view.you + 1;
    view = Object.assign({}, view, { cells: cells, turn: 1 - view.you });
    aim = null;
    render();
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'play') {
      if (v.turn !== me) return 'Their turn…';
      if (aim !== null) return 'Tap it again (or Place) to put your ' + MARK[me] + ' there';
      return '<strong>Your turn!</strong> ' + (v.next < 0 ? 'Any open board' : 'The ' + WHERE[v.next] + ' board');
    }
    const r = v.result;
    if (r.winner === null) return 'No line left: a draw';
    const won = r.winner === me;
    return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    root.innerHTML = '<div class="ut-top"><span class="p' + (me + 1) + '-text">' + MARK[me] + ' You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span>' +
      (v.timed && mine ? '<span>' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '') + '</div>' +
      '<p class="ut-msg">' + message(v) + '</p>' +
      ArkUttt.boardHtml(v, { tappable: mine, aim: mine ? aim : null, aimSlot: me }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '<button class="ut-place"' + (mine && aim !== null ? '' : ' disabled') + '>Place</button>');
  }

  Ark.register('player', 'ultimate-ttt', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ut-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (aim !== null && (v.cells[aim] || v.turn !== v.you)) aim = null;
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.phase !== 'play' && buzzed !== v.round + v.phase && v.result.winner !== null) {
        buzzed = v.round + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () { root = view = null; aim = null; buzzed = ''; },
  });
})();
