(function () {
  Ark.loadCss('/games/mahjong/style.css');
  const ready = Ark.loadScript('/games/mahjong/board.js');

  let root = null;
  let board = null;
  let area = null;
  let info = null;
  let api = null;
  let view = null;
  let giveUpArmed = false;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkMahjong) return;
    if (!board) board = window.ArkMahjong.create(area);
    board.update(v, { selected: v.selected, hint: v.hint });
    info.innerHTML = '⏱ ' + Ark.clock(v.elapsed) + ' · ' + v.left + ' left · ' +
      (v.pairsOpen ? v.pairsOpen + ' pairs open' : v.left ? '<span class="mj-stuck">no pairs: undo or shuffle</span>' : '') +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best));
    root.querySelector('.undo').disabled = !v.canUndo;
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
  }

  Ark.register('player', 'mahjong', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mj-phone';
      root.innerHTML = '<div class="info"></div><div class="mj-board"></div>' +
        '<div class="mj-tools"><button class="ghost undo">↶ Undo</button><button class="ghost hint">💡 Hint</button>' +
        '<button class="ghost shuffle">🔀 Shuffle</button><button class="ghost pause">⏸ Pause</button><button class="ghost give-up">Give up</button></div>';
      el.appendChild(root);
      area = root.querySelector('.mj-board');
      info = root.querySelector('.info');
      area.addEventListener('click', function (e) {
        const t = e.target.closest('[data-tile]');
        if (!t || !view || view.phase !== 'play') return;
        api.send({ type: 'pick', tile: Number(t.getAttribute('data-tile')) });
        api.vibrate(6);
      });
      root.querySelector('.undo').addEventListener('click', function () { api.send({ type: 'undo' }); });
      root.querySelector('.hint').addEventListener('click', function () { api.send({ type: 'hint' }); });
      root.querySelector('.shuffle').addEventListener('click', function () { api.send({ type: 'shuffle' }); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
      const giveUp = root.querySelector('.give-up');
      giveUp.addEventListener('click', function () {
        if (!giveUpArmed) {
          giveUpArmed = true;
          giveUp.textContent = 'Tap again';
          setTimeout(function () { giveUpArmed = false; if (root) giveUp.textContent = 'Give up'; }, 3000);
          return;
        }
        api.send({ type: 'give-up' });
      });
      ready.then(render);
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      if (view && v.nope > view.nope) api.vibrate([30, 30, 30]);
      view = v;
      render();
    },
    unmount: function () {
      root = board = area = info = view = api = null;
      giveUpArmed = false;
    },
  });
})();
