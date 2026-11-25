(function () {
  Ark.loadCss('/games/zip/style.css');
  const ready = Ark.loadScript('/games/zip/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let clearArmed = false;
  let drag = null; // the last square a finger asked for, while it's down on the board

  function render() {
    const v = view;
    if (!v || !root || !window.ArkZip) return;
    const Z = window.ArkZip;
    root.querySelector('.info').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.n + '×' + v.n + '</span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + (v.par ? ' / ' + Z.par(v.par) : '') + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '' : 'best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.zp-tools');
    tools.querySelector('.back').disabled = !play || v.filled < 2;
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.clear').disabled = !play || v.filled < 2;
    tools.querySelector('.clear').textContent = clearArmed ? 'Sure?' : '🧹 Clear';
    tools.querySelector('.clear').classList.toggle('armed', clearArmed);
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    const k = JSON.stringify([v.path, v.numbers, v.walls, v.hint, v.phase]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.zp-board');
    board.style.setProperty('--n', v.n);
    board.classList.toggle('won', v.won);
    board.innerHTML = Z.html(v, null);
  }

  /** The square under a point on the board (worked out from its box: the path's SVG covers the squares). */
  function cellAt(x, y) {
    const box = root.querySelector('.zp-board').getBoundingClientRect();
    const n = view.n;
    const cx = Math.floor(((x - box.left) / box.width) * n);
    const cy = Math.floor(((y - box.top) / box.height) * n);
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return null;
    return cy * n + cx;
  }

  /** Asks for every square between the last one and `to`, one step at a time (a quick finger skips some). */
  function walkTo(to) {
    const n = view.n;
    let c = drag;
    let guard = 0;
    while (c !== to && guard++ < 2 * n) {
      const dx = (to % n) - (c % n);
      const dy = Math.floor(to / n) - Math.floor(c / n);
      c += Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * n;
      api.send({ type: 'to', cell: c });
    }
    drag = to;
  }

  Ark.register('player', 'zip', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'zp-phone';
      root.innerHTML = '<div class="info"></div><div class="zp-board"></div><div class="zp-rules"></div>' +
        '<div class="zp-tools"><button type="button" class="back">↶ Back</button><button type="button" class="hint">💡 Hint +30 s</button>' +
        '<button type="button" class="clear">🧹 Clear</button><button type="button" class="pause">⏸ Pause</button></div>';
      el.appendChild(root);
      const board = root.querySelector('.zp-board');
      board.addEventListener('pointerdown', function (e) {
        if (!view || view.phase !== 'play') return;
        const c = cellAt(e.clientX, e.clientY);
        if (c === null) return;
        e.preventDefault();
        board.setPointerCapture && board.setPointerCapture(e.pointerId);
        // From the path's end, or from a square on the path (which takes it back to there).
        api.send({ type: 'to', cell: c });
        drag = c;
      });
      board.addEventListener('pointermove', function (e) {
        if (drag === null || !view) return;
        const c = cellAt(e.clientX, e.clientY);
        if (c === null || c === drag) return;
        walkTo(c);
        api.vibrate(3);
      });
      const end = function () { drag = null; };
      board.addEventListener('pointerup', end);
      board.addEventListener('pointercancel', end);
      root.querySelector('.zp-tools').addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || !view) return;
        if (!b.classList.contains('clear')) clearArmed = false;
        if (b.classList.contains('back')) api.send({ type: 'back' });
        else if (b.classList.contains('hint')) api.send({ type: 'hint' });
        else if (b.classList.contains('pause')) api.send({ type: 'pause' });
        else if (b.classList.contains('clear')) {
          if (clearArmed) api.send({ type: 'clear' });
          clearArmed = !clearArmed;
        }
        render();
      });
      ready.then(function () {
        root.querySelector('.zp-rules').textContent = window.ArkZip.RULES;
        render();
      });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      drag = null;
      key = '';
      clearArmed = false;
    },
  });
})();
