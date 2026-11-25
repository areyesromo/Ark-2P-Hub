(function () {
  Ark.loadCss('/games/tango/style.css');
  const ready = Ark.loadScript('/games/tango/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0; // a controller's square

  function render() {
    const v = view;
    if (!v || !root || !window.ArkTango) return;
    const T = window.ArkTango;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.tg-top').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.n + ' × ' + v.n + '</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong>' + (v.par ? ' / par ' + T.par(v.par) : '') + '</span>' +
      '<span><strong>' + v.filled + '</strong> / ' + v.n * v.n + '</span>' +
      (v.phase === 'paused' ? '<span class="tg-paused">⏸ Paused</span>' : '');
    const k = JSON.stringify([v.marks, v.signs, v.clashes, v.hint, v.phase, v.look, local && cursor]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.tg-board');
    board.style.setProperty('--n', v.n);
    board.classList.toggle('won', v.won);
    board.innerHTML = T.html(v, { cursor: local ? cursor : null });
    root.querySelector('.tg-rules').textContent = T.rules(v.look);
  }

  Ark.register('host', 'tango', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.clashes.length > prev.clashes.length) return ['wrong'];
      if (JSON.stringify(v.marks) !== JSON.stringify(prev.marks)) return ['tick'];
      return [];
    },
    padHint: 'D-pad move · A sun / moon / empty · B empty · X (Q) hint +30 s · Y (E) undo · Start (P) pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      const n = v.n;
      const x = cursor % n;
      const y = Math.floor(cursor / n);
      if (btn === 'LEFT') cursor = y * n + ((x + n - 1) % n);
      else if (btn === 'RIGHT') cursor = y * n + ((x + 1) % n);
      else if (btn === 'UP') cursor = ((y + n - 1) % n) * n + x;
      else if (btn === 'DOWN') cursor = ((y + 1) % n) * n + x;
      else if (btn === 'A') return { type: 'tap', cell: cursor };
      else if (btn === 'B') return { type: 'mark', cell: cursor, mark: 0 };
      else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'Y') return { type: 'undo' };
      render();
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play') return null;
      // 1 / 2 put a sun or a moon on the cursor's square, 0 empties it.
      if (k === '1' || k === '2' || k === '0') return { type: 'mark', cell: cursor, mark: Number(k) };
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      const help = v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '';
      if (!v.level) return 'In perfect balance' + help + ' ☀️🌙';
      const par = v.elapsed <= v.par * 1000 ? ', inside par! 🎉' : '';
      return 'Level ' + v.level + ' solved' + help + par + (v.level < v.levels ? ' · Level ' + (v.level + 1) + ' is open now' : ' · that was the last one! 🏆');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'tg-host';
      root.innerHTML = '<div class="tg-top"></div><div class="tg-wrap"><div class="tg-board"></div></div><div class="tg-rules"></div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || v.n !== view.n) cursor = Math.floor((v.n * v.n) / 2);
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
