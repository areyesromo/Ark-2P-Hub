(function () {
  Ark.loadCss('/games/peg/style.css');
  const ready = Ark.loadScript('/games/peg/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let picked = null;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkPeg) return;
    root.querySelector('.info').innerHTML =
      '<span><strong>' + v.boardName.replace(/ \(.*\)$/, '') + '</strong></span>' +
      '<span>Pegs <strong>' + v.left + '</strong>/' + v.start + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '' : 'best ' + v.best) + '</span>';
    root.querySelector('.pg-rules').textContent = v.stuck ? 'No way down to one peg from here: undo a few' : v.busy ? 'Too many ways to look through yet: try a few more jumps' : 'Tap a peg, then the ringed hole to jump to';
    const tools = root.querySelector('.pg-tools');
    tools.querySelector('.undo').disabled = !v.canUndo;
    tools.querySelector('.hint').disabled = v.phase !== 'play';
    tools.querySelector('.restart').disabled = v.phase !== 'play' || !v.canUndo;
    const k = JSON.stringify([v.pegs, v.jumps, v.hint, v.phase, picked]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.pg-board');
    board.classList.toggle('won', v.perfect);
    board.innerHTML = window.ArkPeg.html(v, { picked: picked });
  }

  Ark.register('player', 'peg', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'pg-phone';
      root.innerHTML = '<div class="info"></div><div class="pg-board"></div><div class="pg-rules"></div>' +
        '<div class="pg-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="hint">💡 Hint</button><button type="button" class="restart">↺ Start again</button></div>';
      el.appendChild(root);
      root.addEventListener('click', function (e) {
        if (!view) return;
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-i')) {
          if (view.phase !== 'play') return;
          const i = Number(b.getAttribute('data-i'));
          if (picked !== null && view.jumps.some(function (j) { return j[0] === picked && j[1] === i; })) {
            api.send({ type: 'jump', from: picked, to: i });
            api.vibrate(15);
            picked = null;
          } else if (view.jumps.some(function (j) { return j[0] === i; })) picked = picked === i ? null : i;
          else picked = null;
        } else if (b.classList.contains('undo')) api.send({ type: 'undo' });
        else if (b.classList.contains('hint')) api.send({ type: 'hint' });
        else if (b.classList.contains('restart')) api.send({ type: 'restart' });
        render();
      });
      ready.then(render);
    },
    update: function (v) {
      if (view && JSON.stringify(view.pegs) !== JSON.stringify(v.pegs)) picked = null;
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      picked = null;
      key = '';
    },
  });
})();
