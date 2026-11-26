(function () {
  Ark.loadCss('/games/pipes/style.css');
  const ready = Ark.loadScript('/games/pipes/board.js');

  let root = null;
  let api = null;
  let view = null;
  let lockMode = false; // taps lock and unlock instead of turning
  let press = null; // { cell, timer } while a finger is down (a long press locks)

  function render() {
    const v = view;
    if (!v || !root || !window.ArkPipes) return;
    root.querySelector('.info').innerHTML =
      '<span><strong>' + v.n + '×' + v.n + '</strong>' + (v.wrap ? ' 🌀' : '') + '</span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '💧 ' + v.wet.length + '/' + v.n * v.n : 'best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.pp-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.lock').disabled = !play;
    tools.querySelector('.lock').classList.toggle('on', lockMode);
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    window.ArkPipes.draw(root.querySelector('.pp-board'), v, null);
  }

  Ark.register('player', 'pipes', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'pp-phone';
      root.innerHTML = '<div class="info"></div><div class="pp-board"></div><div class="pp-rules">Tap to turn · hold (or 🔒) to lock a piece</div>' +
        '<div class="pp-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="lock">🔒 Lock</button>' +
        '<button type="button" class="hint">💡 Hint +30 s</button><button type="button" class="pause">⏸ Pause</button></div>';
      el.appendChild(root);
      const board = root.querySelector('.pp-board');
      // A tap turns the piece; a long press (or a tap with 🔒 on) locks it.
      board.addEventListener('pointerdown', function (e) {
        const sq = e.target.closest('.pp-sq');
        if (!sq || !view || view.phase !== 'play') return;
        e.preventDefault();
        const cell = Number(sq.getAttribute('data-i'));
        press = { cell: cell, timer: setTimeout(function () {
          if (!press) return;
          api.send({ type: 'lock', cell: cell });
          api.vibrate(30);
          press = null;
        }, 450) };
      });
      const up = function () {
        if (!press) return;
        clearTimeout(press.timer);
        if (lockMode) api.send({ type: 'lock', cell: press.cell });
        else api.send({ type: 'tap', cell: press.cell });
        api.vibrate(6);
        press = null;
      };
      board.addEventListener('pointerup', up);
      board.addEventListener('pointercancel', function () { if (press) clearTimeout(press.timer); press = null; });
      board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.querySelector('.pp-tools').addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || !view) return;
        if (b.classList.contains('undo')) api.send({ type: 'undo' });
        else if (b.classList.contains('lock')) lockMode = !lockMode;
        else if (b.classList.contains('hint')) api.send({ type: 'hint' });
        else if (b.classList.contains('pause')) api.send({ type: 'pause' });
        render();
      });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      if (press) clearTimeout(press.timer);
      root = view = press = null;
      lockMode = false;
    },
  });
})();
