(function () {
  Ark.loadCss('/games/hashi/style.css');
  const ready = Ark.loadScript('/games/hashi/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let picked = null; // the island a tap picked (the next island tapped gets the bridge)
  let drag = null; // { from, x, y } while a finger drags from an island
  let clearArmed = false;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkHashi) return;
    const done = v.counts.filter(function (c, k) { return c === v.numbers[k]; }).length;
    root.querySelector('.info').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + '</span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '🏝️ ' + done + '/' + v.islands.length : 'best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.hs-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.clear').disabled = !play;
    tools.querySelector('.clear').textContent = clearArmed ? 'Sure?' : '🧹 Clear';
    tools.querySelector('.clear').classList.toggle('armed', clearArmed);
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    const k = JSON.stringify([v.bridges, v.islands, v.hint, v.phase, picked, drag]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.hs-board');
    board.style.setProperty('--ratio', v.w / v.h);
    board.classList.toggle('won', v.won);
    board.innerHTML = window.ArkHashi.svg(v, { picked: picked, drag: drag });
  }

  /** A point on the screen in board squares. */
  function boardPoint(e) {
    const box = root.querySelector('.hs-board').getBoundingClientRect();
    return [((e.clientX - box.left) / box.width) * view.w, ((e.clientY - box.top) / box.height) * view.h];
  }

  Ark.register('player', 'hashi', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hs-phone';
      root.innerHTML = '<div class="info"></div><div class="hs-board"></div><div class="hs-rules">Drag from island to island (or tap one, then the other): again for two, again for none</div>' +
        '<div class="hs-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="hint">💡 Hint +30 s</button>' +
        '<button type="button" class="clear">🧹 Clear</button><button type="button" class="pause">⏸ Pause</button></div>';
      el.appendChild(root);
      const board = root.querySelector('.hs-board');
      board.addEventListener('pointerdown', function (e) {
        if (!view || view.phase !== 'play') return;
        const p = boardPoint(e);
        const k = window.ArkHashi.islandAt(view, p[0], p[1]);
        if (k === null) { picked = null; render(); return; }
        e.preventDefault();
        board.setPointerCapture && board.setPointerCapture(e.pointerId);
        drag = { from: k, x: p[0], y: p[1], moved: false };
      });
      board.addEventListener('pointermove', function (e) {
        if (!drag) return;
        const p = boardPoint(e);
        if (Math.hypot(p[0] - drag.x, p[1] - drag.y) > 0.4) drag.moved = true;
        drag.x = p[0];
        drag.y = p[1];
        if (drag.moved) render();
      });
      board.addEventListener('pointerup', function (e) {
        if (!drag) return;
        const d = drag;
        drag = null;
        const p = boardPoint(e);
        const k = window.ArkHashi.islandAt(view, p[0], p[1]);
        if (d.moved) {
          if (k !== null && k !== d.from) { api.send({ type: 'bridge', a: d.from, b: k }); api.vibrate(12); }
          picked = null;
        } else if (picked !== null && picked !== d.from) {
          api.send({ type: 'bridge', a: picked, b: d.from });
          api.vibrate(12);
          picked = null;
        } else picked = picked === d.from ? null : d.from;
        key = '';
        render();
      });
      board.addEventListener('pointercancel', function () { drag = null; key = ''; render(); });
      root.querySelector('.hs-tools').addEventListener('click', function (e) {
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
      root = view = drag = null;
      picked = null;
      key = '';
      clearArmed = false;
    },
  });
})();
