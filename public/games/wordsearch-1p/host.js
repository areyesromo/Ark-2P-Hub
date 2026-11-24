(function () {
  Ark.loadCss('/games/wordsearch-1p/style.css');
  const ready = Ark.loadScript('/games/wordsearch-1p/board.js');

  let root = null;
  let view = null;
  let key = '';
  let nope = 0;
  const cursor = { x: 0, y: 0 }; // a controller player's cursor
  let from = null; // the first letter picked with the controller

  function render() {
    const v = view;
    if (!v || !root || !window.ArkWordSearch) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const at = cursor.y * v.n + cursor.x;
    const k = JSON.stringify([v.grid, v.found, v.words, local && at, local && from, Math.floor(v.elapsed / 1000)]);
    if (k === key) return;
    key = k;
    const left = v.words.filter(function (w) { return !w.found; }).length;
    root.querySelector('.ws-stats').innerHTML = '<span><strong>' + left + '</strong> to find</span><span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>';
    root.querySelector('.ws-field').innerHTML = window.ArkWordSearch.html(v, local ? { cursor: at, from: from, to: at } : {});
    root.querySelector('.ws-side').innerHTML = window.ArkWordSearch.words(v);
    if (v.nope !== nope) {
      nope = v.nope;
      root.querySelector('.ws-grid').classList.add('shake');
    }
  }

  function moveCursor(dx, dy) {
    cursor.x = (cursor.x + dx + view.n) % view.n;
    cursor.y = (cursor.y + dy + view.n) % view.n;
    render();
  }

  Ark.register('host', 'wordsearch-1p', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.found.length > prev.found.length) return ['correct'];
      if (v.nope > prev.nope) return ['wrong'];
      return [];
    },
    padHint: 'D-pad move · A on the first letter, then A on the last · B let go',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP') moveCursor(0, -1);
      else if (btn === 'DOWN') moveCursor(0, 1);
      else if (btn === 'LEFT') moveCursor(-1, 0);
      else if (btn === 'RIGHT') moveCursor(1, 0);
      else if (btn === 'B') {
        from = null;
        render();
      } else if (btn === 'A') {
        const at = cursor.y * v.n + cursor.x;
        if (from === null || from === at) {
          from = from === at ? null : at;
          render();
          return null;
        }
        const input = { type: 'mark', a: from, b: at };
        from = null;
        render();
        return input;
      }
      return null;
    },
    overHtml: function (v) {
      return 'All ' + v.words.length + ' words found on the ' + v.variant + ' grid';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ws-host';
      root.innerHTML = '<div class="ws-stats"></div><div class="ws-main"><div class="ws-field"></div><div class="ws-side"></div></div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || view.n !== v.n || v.found.length < view.found.length) {
        cursor.x = cursor.y = Math.floor(v.n / 2);
        from = null;
        nope = v.nope;
      }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      from = null;
    },
  });
})();
