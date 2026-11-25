(function () {
  Ark.loadCss('/games/tango/style.css');
  const ready = Ark.loadScript('/games/tango/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let clearArmed = false;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkTango) return;
    const T = window.ArkTango;
    root.querySelector('.info').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.n + '×' + v.n + '</span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + (v.par ? ' / ' + T.par(v.par) : '') + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '' : 'best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.tg-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.clear').disabled = !play;
    tools.querySelector('.clear').textContent = clearArmed ? 'Sure?' : '🧹 Clear';
    tools.querySelector('.clear').classList.toggle('armed', clearArmed);
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    const k = JSON.stringify([v.marks, v.signs, v.clashes, v.hint, v.phase, v.look]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.tg-board');
    board.style.setProperty('--n', v.n);
    board.classList.toggle('won', v.won);
    board.innerHTML = T.html(v, null);
    root.querySelector('.tg-rules').textContent = T.rules(v.look);
  }

  Ark.register('player', 'tango', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tg-phone';
      root.innerHTML = '<div class="info"></div><div class="tg-board"></div><div class="tg-rules"></div>' +
        '<div class="tg-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="hint">💡 Hint +30 s</button>' +
        '<button type="button" class="clear">🧹 Clear</button><button type="button" class="pause">⏸ Pause</button></div>';
      el.appendChild(root);
      // A tap goes empty → sun → moon → empty.
      root.querySelector('.tg-board').addEventListener('pointerdown', function (e) {
        const sq = e.target.closest('.tg-sq');
        if (!sq || !view || view.phase !== 'play') return;
        const i = Number(sq.getAttribute('data-i'));
        if (view.givens[i]) return api.vibrate([10, 30, 10]);
        e.preventDefault();
        api.send({ type: 'tap', cell: i });
        api.vibrate(6);
      });
      root.querySelector('.tg-tools').addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || !view) return;
        if (!b.classList.contains('clear')) clearArmed = false;
        if (b.classList.contains('undo')) api.send({ type: 'undo' });
        else if (b.classList.contains('hint')) api.send({ type: 'hint' });
        else if (b.classList.contains('pause')) api.send({ type: 'pause' });
        else if (b.classList.contains('clear')) {
          if (clearArmed) api.send({ type: 'clear' });
          clearArmed = !clearArmed;
        }
        render();
      });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      clearArmed = false;
    },
  });
})();
