(function () {
  Ark.loadCss('/games/pipes/style.css');
  const ready = Ark.loadScript('/games/pipes/board.js');

  let root = null;
  let view = null;
  let cursor = 0;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkPipes) return;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.pp-top').innerHTML =
      '<span><strong>' + v.n + ' × ' + v.n + '</strong>' + (v.wrap ? ' · 🌀 wrap round' : '') + '</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span>💧 <strong>' + v.wet.length + '</strong> / ' + v.n * v.n + '</span>' +
      (v.phase === 'paused' ? '<span class="pp-paused">⏸ Paused</span>' : '');
    window.ArkPipes.draw(root.querySelector('.pp-board'), v, { cursor: local ? cursor : null });
  }

  Ark.register('host', 'pipes', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.wet.length > prev.wet.length) return ['splash'];
      if (JSON.stringify(v.rots) !== JSON.stringify(prev.rots)) return ['tick'];
      return [];
    },
    padHint: 'D-pad move · A turn ↻ · B turn ↺ · LB (L) lock · X (Q) hint +30 s · Y (E) undo · Start (P) pause',
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
      else if (btn === 'B') return { type: 'tap', cell: cursor, back: true };
      else if (btn === 'LB' || btn === 'RB') return { type: 'lock', cell: cursor };
      else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'Y') return { type: 'undo' };
      render();
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play') return null;
      if (k === 'l' || k === 'L') return { type: 'lock', cell: cursor };
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      return 'The water reaches every pipe' + (v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '') + ' 🚰';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'pp-host';
      root.innerHTML = '<div class="pp-top"></div><div class="pp-wrap"><div class="pp-board"></div></div><div class="pp-rules">Turn the pieces · the water must reach every pipe · no open ends</div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || v.n !== view.n) cursor = v.tap;
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
    },
  });
})();
