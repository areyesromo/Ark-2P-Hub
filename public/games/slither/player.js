(function () {
  Ark.loadCss('/games/slither/style.css');
  const ready = Ark.loadScript('/games/slither/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let clearArmed = false;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkSlither) return;
    root.querySelector('.info').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.w + '×' + v.h + '</span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '' : 'best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.sl-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.clear').disabled = !play;
    tools.querySelector('.clear').textContent = clearArmed ? 'Sure?' : '🧹 Clear';
    tools.querySelector('.clear').classList.toggle('armed', clearArmed);
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    const k = JSON.stringify([v.marks, v.clues, v.badCells, v.badDots, v.hint, v.phase]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.sl-board');
    board.style.setProperty('--ratio', (v.w + 1) / (v.h + 1));
    board.classList.toggle('won', v.won);
    board.innerHTML = window.ArkSlither.svg(v, null);
  }

  Ark.register('player', 'slither', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sl-phone';
      root.innerHTML = '<div class="info"></div><div class="sl-board"></div><div class="sl-rules">Tap a line to draw it · again for ✕ · again to clear</div>' +
        '<div class="sl-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="hint">💡 Hint +30 s</button>' +
        '<button type="button" class="clear">🧹 Clear</button><button type="button" class="pause">⏸ Pause</button></div>';
      el.appendChild(root);
      root.querySelector('.sl-board').addEventListener('pointerdown', function (e) {
        const hit = e.target.closest('[data-e]');
        if (!hit || !view || view.phase !== 'play') return;
        e.preventDefault();
        api.send({ type: 'tap', edge: Number(hit.getAttribute('data-e')) });
        api.vibrate(5);
      });
      root.querySelector('.sl-tools').addEventListener('click', function (e) {
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
