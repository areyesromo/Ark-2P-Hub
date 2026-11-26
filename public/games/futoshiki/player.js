(function () {
  Ark.loadCss('/games/futoshiki/style.css');
  const ready = Ark.loadScript('/games/futoshiki/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let pencil = false;
  let clearArmed = false;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkFutoshiki) return;
    root.querySelector('.info').innerHTML =
      '<span><strong>' + v.n + '×' + v.n + '</strong></span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? v.filled + '/' + v.n * v.n : 'best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    let keys = '';
    for (let d = 1; d <= v.n; d++) keys += '<button type="button" data-v="' + d + '"' + (play ? '' : ' disabled') + '>' + d + '</button>';
    keys += '<button type="button" data-v="0" class="rub"' + (play ? '' : ' disabled') + '>✕</button>';
    keys += '<button type="button" class="pen' + (pencil ? ' on' : '') + '"' + (play ? '' : ' disabled') + '>✏️</button>';
    const pad = root.querySelector('.ft-keys');
    pad.style.setProperty('--k', v.n + 2);
    pad.innerHTML = keys;
    const tools = root.querySelector('.ft-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.clear').disabled = !play;
    tools.querySelector('.clear').textContent = clearArmed ? 'Sure?' : '🧹 Clear';
    tools.querySelector('.clear').classList.toggle('armed', clearArmed);
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    const k = JSON.stringify([v.grid, v.notes, v.signs, v.clashes, v.selected, v.hint, v.phase]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.ft-board');
    board.style.setProperty('--n', v.n);
    board.classList.toggle('won', v.won);
    board.innerHTML = window.ArkFutoshiki.html(v);
  }

  Ark.register('player', 'futoshiki', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ft-phone';
      root.innerHTML = '<div class="info"></div><div class="ft-board"></div><div class="ft-keys"></div>' +
        '<div class="ft-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="hint">💡 Hint +30 s</button>' +
        '<button type="button" class="clear">🧹 Clear</button><button type="button" class="pause">⏸ Pause</button></div>' +
        '<p class="ft-rules">Tap a square, then a number · ✏️ for pencil marks</p>';
      el.appendChild(root);
      root.addEventListener('click', function (e) {
        if (!view) return;
        const b = e.target.closest('button');
        if (!b) return;
        if (!b.classList.contains('clear')) clearArmed = false;
        if (b.hasAttribute('data-cell')) {
          if (view.phase === 'play') api.send({ type: 'select', cell: Number(b.getAttribute('data-cell')) });
          return;
        }
        if (b.hasAttribute('data-v')) {
          const value = Number(b.getAttribute('data-v'));
          api.send(pencil && value ? { type: 'note', cell: view.selected, value: value } : { type: 'set', cell: view.selected, value: value });
          api.vibrate(6);
        } else if (b.classList.contains('pen')) pencil = !pencil;
        else if (b.classList.contains('undo')) api.send({ type: 'undo' });
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
      pencil = clearArmed = false;
    },
  });
})();
