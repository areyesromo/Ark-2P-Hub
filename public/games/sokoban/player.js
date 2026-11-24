(function () {
  Ark.loadCss('/games/sokoban/style.css');
  const ready = Ark.loadScript('/games/sokoban/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let start = null;

  function send(input) {
    if (!view || view.phase !== 'play') return;
    api.send(input);
    api.vibrate(6);
  }

  function render() {
    const v = view;
    if (!v || !root || !window.ArkSokoban) return;
    const k = JSON.stringify([v.boxes, v.worker, v.moves, v.phase]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = 'Level ' + v.levelNo + ' · <strong>' + v.moves + '</strong> moves · par ' + v.par;
    root.querySelector('.sk-field').innerHTML = window.ArkSokoban.html(v);
  }

  Ark.register('player', 'sokoban', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sk-phone';
      root.innerHTML = '<div class="info"></div><div class="sk-field"></div>' +
        '<div class="sk-pad"><button data-dir="up">▲</button><button data-dir="left">◀</button><button data-dir="right">▶</button><button data-dir="down">▼</button></div>' +
        '<div class="sk-tools"><button class="ghost undo">↶ Undo</button><button class="ghost restart">↺ Start again</button></div>';
      el.appendChild(root);
      root.querySelector('.sk-pad').addEventListener('pointerdown', function (e) {
        const b = e.target.closest('[data-dir]');
        if (!b) return;
        e.preventDefault();
        send({ type: 'move', dir: b.getAttribute('data-dir') });
      });
      // A swipe on the board walks too.
      const field = root.querySelector('.sk-field');
      field.addEventListener('pointerdown', function (e) { start = { x: e.clientX, y: e.clientY }; });
      field.addEventListener('pointerup', function (e) {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        start = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        send({ type: 'move', dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up' });
      });
      root.querySelector('.undo').addEventListener('click', function () { send({ type: 'undo' }); });
      root.querySelector('.restart').addEventListener('click', function () { send({ type: 'restart' }); });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
