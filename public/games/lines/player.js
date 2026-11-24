(function () {
  Ark.loadCss('/games/lines/style.css');
  const ready = Ark.loadScript('/games/lines/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let sel = -1;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkLines) return;
    if (v.phase !== 'play' || (sel >= 0 && v.board[sel] === null)) sel = -1;
    const k = JSON.stringify([v.board, v.next, v.points, v.phase, sel, v.best]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = '<span>Points <strong>' + v.points + '</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best) + '</span><span class="ln-next">' + window.ArkLines.next(v) + '</span>';
    root.querySelector('.ln-board').innerHTML = window.ArkLines.board(v, sel, -1);
  }

  Ark.register('player', 'lines', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ln-phone';
      root.innerHTML = '<div class="info"></div><div class="ln-board"></div>';
      el.appendChild(root);
      // Tap a ball, then tap an empty square for it to walk to. Tapping another ball switches.
      root.addEventListener('pointerdown', function (e) {
        const b = e.target.closest('[data-i]');
        if (!b || !view || view.phase !== 'play') return;
        e.preventDefault();
        const i = Number(b.getAttribute('data-i'));
        if (view.board[i] !== null) sel = i === sel ? -1 : i;
        else if (sel >= 0) {
          api.send({ type: 'move', from: sel, to: i });
          api.vibrate(8);
          sel = -1;
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
      sel = -1;
    },
  });
})();
